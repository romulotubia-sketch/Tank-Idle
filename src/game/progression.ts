import {
  DEFAULT_EQUIPPED_GEAR,
  DEFAULT_UPGRADE_LEVELS,
  UPGRADE_DEFINITIONS,
  getXpForNextLevel,
} from './config';
import type {
  EquippedGearMap,
  TankStats,
  UpgradeKey,
  UpgradeLevels,
} from './types';

export function getStatValueAtLevel(key: UpgradeKey, level: number): number {
  const def = UPGRADE_DEFINITIONS[key];
  const effectiveLevel = Math.max(1, level);
  return def.baseValue + (effectiveLevel - 1) * def.incrementPerLevel;
}

export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number {
  const def = UPGRADE_DEFINITIONS[key];
  const lvl = Math.max(1, currentLevel);
  return Math.round(def.baseCost * Math.pow(def.costMultiplier, lvl - 1));
}

export function isUpgradeMaxed(key: UpgradeKey, currentLevel: number): boolean {
  const def = UPGRADE_DEFINITIONS[key];
  return def.maxLevel !== null && currentLevel >= def.maxLevel;
}

export function applyTankXp(
  currentLevel: number,
  currentXp: number,
  gainedXp: number,
): { tankLevel: number; tankXp: number; levelsGained: number } {
  let lvl = Math.max(1, Math.floor(currentLevel));
  let xp = Math.max(0, Math.floor(currentXp + Math.max(0, gainedXp)));
  let levelsGained = 0;

  while (xp >= getXpForNextLevel(lvl)) {
    xp -= getXpForNextLevel(lvl);
    lvl += 1;
    levelsGained += 1;
  }

  return { tankLevel: lvl, tankXp: xp, levelsGained };
}

export function computeTankStats(
  levels: UpgradeLevels,
  equippedGear: EquippedGearMap = DEFAULT_EQUIPPED_GEAR,
  tankLevel = 1,
): TankStats {
  // Subtle baseline chassis readiness from Tank Level (+2% HP & +1.5% ATK per level above 1)
  const levelBonusHpMult = 1 + Math.max(0, tankLevel - 1) * 0.02;
  const levelBonusAtkMult = 1 + Math.max(0, tankLevel - 1) * 0.015;

  let maxHp = getStatValueAtLevel('maxHp', levels.maxHp) * levelBonusHpMult;
  let attackDamage = getStatValueAtLevel('attackDamage', levels.attackDamage) * levelBonusAtkMult;
  let attackSpeed = getStatValueAtLevel('attackSpeed', levels.attackSpeed);
  let armor = getStatValueAtLevel('armor', levels.armor);
  let critChance = getStatValueAtLevel('critChance', levels.critChance);
  let critDamage = getStatValueAtLevel('critDamage', levels.critDamage);

  let lifestealOnKillRatio = 0;
  let armorPenetrationRatio = 0;
  let splashDamageRatio = 0;
  let skillHasteRatio = 0;
  let scrapBonusRatio = 0;

  for (const item of Object.values(equippedGear)) {
    if (!item) continue;
    const b = item.bonuses;
    if (b.maxHp) maxHp += b.maxHp;
    if (b.attackDamage) attackDamage += b.attackDamage;
    if (b.attackSpeed) attackSpeed += b.attackSpeed;
    if (b.armor) armor += b.armor;
    if (b.critChance) critChance += b.critChance;
    if (b.critDamage) critDamage += b.critDamage;

    if (item.passive) {
      switch (item.passive.id) {
        case 'vampiric_shells':
          lifestealOnKillRatio += item.passive.value;
          break;
        case 'piercing_rounds':
          armorPenetrationRatio += item.passive.value;
          break;
        case 'blast_splash':
          splashDamageRatio += item.passive.value;
          break;
        case 'cooldown_haste':
          skillHasteRatio += item.passive.value;
          break;
        case 'scrap_magnet':
          scrapBonusRatio += item.passive.value;
          break;
      }
    }
  }

  return {
    maxHp: Math.round(maxHp),
    attackDamage: Math.round(attackDamage),
    attackSpeed: Number(attackSpeed.toFixed(2)),
    armor: Number(armor.toFixed(1)),
    critChance: Math.min(0.92, Number(critChance.toFixed(4))),
    critDamage: Number(critDamage.toFixed(2)),
    lifestealOnKillRatio: Math.min(0.25, lifestealOnKillRatio),
    armorPenetrationRatio: Math.min(0.85, armorPenetrationRatio),
    splashDamageRatio: Math.min(0.9, splashDamageRatio),
    skillHasteRatio: Math.min(0.5, skillHasteRatio),
    scrapBonusRatio: Math.min(1.5, scrapBonusRatio),
  };
}

export function computeEffectiveDps(stats: TankStats): number {
  const avgMultiplier = 1 + stats.critChance * (stats.critDamage - 1);
  return stats.attackDamage * stats.attackSpeed * avgMultiplier;
}

export function computeTankPower(stats: TankStats): number {
  const dps = computeEffectiveDps(stats);
  const survivability = stats.maxHp * 0.25 + stats.armor * 4.5;
  const passiveBonus =
    (stats.armorPenetrationRatio +
      stats.splashDamageRatio +
      stats.lifestealOnKillRatio +
      stats.skillHasteRatio) *
    180;
  return Math.round(dps * 2.2 + survivability + passiveBonus);
}

/**
 * Diminishing-returns armor mitigation with optional armor penetration.
 */
export function calculateMitigatedDamage(
  rawDamage: number,
  targetArmor: number,
  armorPenetrationRatio = 0,
): number {
  const effectiveArmor = Math.max(0, targetArmor * (1 - Math.max(0, Math.min(0.9, armorPenetrationRatio))));
  const mitigationRatio = effectiveArmor / (effectiveArmor + 32);
  const multiplier = Math.max(0.15, 1 - mitigationRatio);
  return Math.max(1, Math.round(rawDamage * multiplier));
}

export function sanitizeUpgradeLevels(input?: Partial<UpgradeLevels> | null): UpgradeLevels {
  const result: UpgradeLevels = { ...DEFAULT_UPGRADE_LEVELS };
  if (!input) return result;
  (Object.keys(DEFAULT_UPGRADE_LEVELS) as UpgradeKey[]).forEach((key) => {
    const raw = input[key];
    const maxLvl = UPGRADE_DEFINITIONS[key].maxLevel;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
      const floored = Math.floor(raw);
      result[key] = maxLvl !== null ? Math.min(maxLvl, floored) : floored;
    }
  });
  return result;
}
