import {
  CHEST_CONFIGS,
  MAX_SKILL_LEVEL,
  SKILL_DEFINITIONS,
  SKILL_DUPLICATE_COSTS,
  SKILL_ORDER,
} from './config';
import { addChest, addCurrency, consumeChest, spendCurrency } from './economy';
import type {
  ChestInventory,
  ChestReward,
  ChestTierId,
  SkillCollection,
  SkillId,
  SkillRarity,
  Wallet,
} from './types';

export const CHEST_CRAFT_TECH_COST = 25;

export interface SkillMilestone {
  level: number;
  label: string;
}

export interface SkillComputedStats {
  damageMult: number;
  projectileCount: number;
  homingTurnRate: number;
  shellCount: number;
  blastRadius: number;
  deployCount: number;
  maxActiveMines: number;
  mineDuration: number;
  maxPierce: number;
  armorPen: number;
  beamWidth: number;
  healRatio: number;
  duration: number;
  pulseInterval: number;
  stunDuration: number;
  empRadius: number;
  armorShred: number;
  attackSpeedBonus: number;
  moveSpeedBonus: number;
  rocketCount: number;
  splashRadius: number;
  milestones: SkillMilestone[];
  statLines: { label: string; value: string }[];
}

export function clampSkillLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 1;
  return Math.min(MAX_SKILL_LEVEL, Math.floor(level));
}

export function getRequiredDuplicatesForNextLevel(currentLevel: number): number | null {
  const lvl = clampSkillLevel(currentLevel);
  if (lvl >= MAX_SKILL_LEVEL) return null;
  return SKILL_DUPLICATE_COSTS[lvl - 1] ?? null;
}

export function canUpgradeSkillWithDuplicates(
  skillId: SkillId,
  skills: SkillCollection,
): boolean {
  const entry = skills[skillId];
  if (!entry || !entry.unlocked || entry.level >= MAX_SKILL_LEVEL) return false;
  const req = getRequiredDuplicatesForNextLevel(entry.level);
  return req !== null && entry.duplicates >= req;
}

export function getSkillPower(id: SkillId, level: number): number {
  const def = SKILL_DEFINITIONS[id];
  const lvl = clampSkillLevel(level);
  return Number((def.basePower + (lvl - 1) * def.powerPerLevel).toFixed(3));
}

export function getSkillCooldown(id: SkillId, skillHasteRatio = 0): number {
  const def = SKILL_DEFINITIONS[id];
  return Math.max(2.5, Number((def.cooldown * (1 - Math.min(0.5, skillHasteRatio))).toFixed(2)));
}

export function getSkillComputedStats(id: SkillId, level: number): SkillComputedStats {
  const lvl = clampSkillLevel(level);
  const power = getSkillPower(id, lvl);

  const stats: SkillComputedStats = {
    damageMult: power,
    projectileCount: 0,
    homingTurnRate: 0,
    shellCount: 0,
    blastRadius: 0,
    deployCount: 0,
    maxActiveMines: 0,
    mineDuration: 0,
    maxPierce: 0,
    armorPen: 0,
    beamWidth: 0,
    healRatio: 0,
    duration: SKILL_DEFINITIONS[id].duration ?? 0,
    pulseInterval: 0.4,
    stunDuration: 0,
    empRadius: 0,
    armorShred: 0,
    attackSpeedBonus: 0,
    moveSpeedBonus: 0,
    rocketCount: 0,
    splashRadius: 0,
    milestones: [],
    statLines: [],
  };

  switch (id) {
    case 'missile_barrage': {
      stats.projectileCount =
        4 + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0) + (lvl >= 9 ? 2 : 0);
      stats.homingTurnRate = Number((6.2 + (lvl - 1) * 0.45).toFixed(2));
      stats.milestones = [
        { level: 3, label: '+1 Homing Missile (5 total)' },
        { level: 6, label: '+1 Homing Missile (6 total)' },
        { level: 9, label: '+2 Homing Missiles (8 total)' },
      ];
      stats.statLines = [
        { label: 'Missile Damage', value: `${Math.round(stats.damageMult * 100)}% ATK` },
        { label: 'Missiles Fired', value: `${stats.projectileCount}` },
        { label: 'Tracking Agility', value: `${stats.homingTurnRate.toFixed(1)} rad/s` },
      ];
      break;
    }

    case 'artillery_strike': {
      stats.shellCount = 3 + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0) + (lvl >= 9 ? 1 : 0);
      stats.blastRadius = Math.round(66 + (lvl - 1) * 4);
      stats.milestones = [
        { level: 3, label: '+1 Artillery Shell (4 total)' },
        { level: 6, label: '+1 Artillery Shell (5 total)' },
        { level: 9, label: '+1 Artillery Shell (6 total)' },
      ];
      stats.statLines = [
        { label: 'Shell Damage', value: `${Math.round(stats.damageMult * 100)}% ATK` },
        { label: 'Salvo Shells', value: `${stats.shellCount}` },
        { label: 'Blast Radius', value: `${stats.blastRadius} px` },
      ];
      break;
    }

    case 'mine_deployment': {
      stats.deployCount = 4 + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0) + (lvl >= 9 ? 2 : 0);
      stats.maxActiveMines = 10 + (lvl >= 5 ? 4 : 0) + (lvl >= 9 ? 4 : 0);
      stats.mineDuration = Number((14 + (lvl - 1) * 1.2).toFixed(1));
      stats.blastRadius = Math.round(62 + (lvl - 1) * 2.5);
      stats.milestones = [
        { level: 3, label: '+1 Mine per Cast (5)' },
        { level: 5, label: '+4 Max Active Mines (14)' },
        { level: 6, label: '+1 Mine per Cast (6)' },
        { level: 9, label: '+2 Mines & +4 Capacity' },
      ];
      stats.statLines = [
        { label: 'Mine Damage', value: `${Math.round(stats.damageMult * 100)}% ATK` },
        { label: 'Mines Deployed', value: `${stats.deployCount} (Max ${stats.maxActiveMines})` },
        { label: 'Mine Duration', value: `${stats.mineDuration.toFixed(1)}s` },
      ];
      break;
    }

    case 'railgun_shot': {
      stats.maxPierce = 3 + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 2 : 0) + (lvl >= 9 ? 2 : 0);
      stats.armorPen = Math.min(1, 0.5 + (lvl >= 5 ? 0.25 : 0) + (lvl >= 9 ? 0.25 : 0));
      stats.beamWidth = Number((14 + (lvl - 1) * 1.2).toFixed(1));
      stats.milestones = [
        { level: 3, label: '+1 Max Pierce Target (4)' },
        { level: 5, label: '75% Armor Penetration' },
        { level: 6, label: '+2 Max Pierce Targets (6)' },
        { level: 9, label: '100% Armor Pierce & 8 Targets' },
      ];
      stats.statLines = [
        { label: 'Beam Damage', value: `${Math.round(stats.damageMult * 100)}% ATK` },
        { label: 'Max Pierce', value: `${stats.maxPierce} Targets` },
        { label: 'Armor Ignore', value: `${Math.round(stats.armorPen * 100)}%` },
      ];
      break;
    }

    case 'repair_drone': {
      stats.healRatio = stats.damageMult;
      stats.duration = Number((5.0 + (lvl >= 4 ? 1.0 : 0) + (lvl >= 8 ? 1.5 : 0)).toFixed(1));
      stats.pulseInterval = Number(Math.max(0.22, 0.45 - (lvl - 1) * 0.025).toFixed(2));
      stats.milestones = [
        { level: 4, label: '+1.0s Drone Duration (6.0s)' },
        { level: 8, label: '+1.5s Duration & Rapid Pulses' },
      ];
      stats.statLines = [
        { label: 'Total Hull Repair', value: `${Math.round(stats.healRatio * 100)}% Max HP` },
        { label: 'Drone Duration', value: `${stats.duration.toFixed(1)}s` },
        { label: 'Pulse Interval', value: `${stats.pulseInterval.toFixed(2)}s` },
      ];
      break;
    }

    case 'emp_pulse': {
      stats.stunDuration = Number((2.2 + (lvl - 1) * 0.22).toFixed(2));
      stats.empRadius = Math.round(250 + (lvl - 1) * 12 + (lvl >= 5 ? 25 : 0));
      stats.armorShred = lvl >= 7 ? 0.2 : 0;
      stats.milestones = [
        { level: 5, label: '+25px Shockwave Radius' },
        { level: 7, label: 'Applies -20% Enemy Armor Shred' },
      ];
      stats.statLines = [
        { label: 'Pulse Damage', value: `${Math.round(stats.damageMult * 100)}% ATK` },
        { label: 'Disrupt Duration', value: `${stats.stunDuration.toFixed(2)}s` },
        { label: 'Shockwave Radius', value: `${stats.empRadius} px` },
      ];
      break;
    }

    case 'overdrive': {
      stats.attackSpeedBonus = stats.damageMult;
      stats.moveSpeedBonus = Number((0.35 + (lvl - 1) * 0.06).toFixed(2));
      stats.duration = Number((5.0 + (lvl >= 3 ? 1.0 : 0) + (lvl >= 7 ? 1.5 : 0)).toFixed(1));
      stats.milestones = [
        { level: 3, label: '+1.0s Overdrive Duration (6.0s)' },
        { level: 7, label: '+1.5s Overdrive Duration (7.5s)' },
      ];
      stats.statLines = [
        { label: 'Attack Speed', value: `+${Math.round(stats.attackSpeedBonus * 100)}%` },
        { label: 'Movement Speed', value: `+${Math.round(stats.moveSpeedBonus * 100)}%` },
        { label: 'Duration', value: `${stats.duration.toFixed(1)}s` },
      ];
      break;
    }

    case 'rocket_salvo': {
      stats.rocketCount = 4 + (lvl >= 3 ? 2 : 0) + (lvl >= 6 ? 2 : 0) + (lvl >= 9 ? 2 : 0);
      stats.splashRadius = Math.round(56 + (lvl - 1) * 3.5);
      stats.milestones = [
        { level: 3, label: '+2 Rockets in Salvo (6 total)' },
        { level: 6, label: '+2 Rockets in Salvo (8 total)' },
        { level: 9, label: '+2 Rockets in Salvo (10 total)' },
      ];
      stats.statLines = [
        { label: 'Rocket Damage', value: `${Math.round(stats.damageMult * 100)}% ATK` },
        { label: 'Salvo Sequence', value: `${stats.rocketCount} Rockets` },
        { label: 'Splash Radius', value: `${stats.splashRadius} px` },
      ];
      break;
    }
  }

  return stats;
}

export function getSkillNextLevelPreview(id: SkillId, currentLevel: number): string[] {
  const lvl = clampSkillLevel(currentLevel);
  if (lvl >= MAX_SKILL_LEVEL) return ['Maximum mastery reached (Lv. 10)'];

  const cur = getSkillComputedStats(id, lvl);
  const nxt = getSkillComputedStats(id, lvl + 1);
  const changes: string[] = [];

  for (let i = 0; i < cur.statLines.length; i++) {
    if (cur.statLines[i].value !== nxt.statLines[i].value) {
      changes.push(`${cur.statLines[i].label}: ${cur.statLines[i].value} -> ${nxt.statLines[i].value}`);
    }
  }

  const milestone = nxt.milestones.find((m) => m.level === lvl + 1);
  if (milestone) {
    changes.push(`Milestone Lv.${lvl + 1}: ${milestone.label}`);
  }
  return changes;
}

export function unlockSkillWithTech(
  skillId: SkillId,
  skills: SkillCollection,
  wallet: Wallet,
): { success: boolean; skills: SkillCollection; wallet: Wallet } {
  const current = skills[skillId];
  if (!current || current.unlocked) {
    return { success: false, skills, wallet };
  }

  const cost = SKILL_DEFINITIONS[skillId].unlockTechCost;
  const spendRes = spendCurrency(wallet, 'skillTech', cost);
  if (!spendRes.success) {
    return { success: false, skills, wallet };
  }

  return {
    success: true,
    wallet: spendRes.wallet,
    skills: {
      ...skills,
      [skillId]: {
        ...current,
        unlocked: true,
        level: clampSkillLevel(current.level),
      },
    },
  };
}

export function upgradeSkillWithDuplicates(
  skillId: SkillId,
  skills: SkillCollection,
): { success: boolean; skills: SkillCollection; consumedDuplicates: number } {
  const current = skills[skillId];
  if (!current || !current.unlocked || current.level >= MAX_SKILL_LEVEL) {
    return { success: false, skills, consumedDuplicates: 0 };
  }

  const required = getRequiredDuplicatesForNextLevel(current.level);
  if (required === null || current.duplicates < required) {
    return { success: false, skills, consumedDuplicates: 0 };
  }

  return {
    success: true,
    consumedDuplicates: required,
    skills: {
      ...skills,
      [skillId]: {
        ...current,
        level: current.level + 1,
        duplicates: current.duplicates - required,
      },
    },
  };
}

export function craftChestWithSkillTech(
  chests: ChestInventory,
  wallet: Wallet,
): { success: boolean; chests: ChestInventory; wallet: Wallet } {
  const spendRes = spendCurrency(wallet, 'skillTech', CHEST_CRAFT_TECH_COST);
  if (!spendRes.success) {
    return { success: false, chests, wallet };
  }
  return {
    success: true,
    wallet: spendRes.wallet,
    chests: addChest(chests, 'standard', 1),
  };
}

function rollSkillRarityFromWeights(
  weights: Record<SkillRarity, number>,
  rng: () => number = Math.random,
): SkillRarity {
  const order: SkillRarity[] = ['common', 'rare', 'epic', 'legendary'];
  const total = order.reduce((sum, r) => sum + Math.max(0, weights[r] ?? 0), 0);
  if (total <= 0) return 'common';

  let roll = rng() * total;
  for (const r of order) {
    const w = Math.max(0, weights[r] ?? 0);
    if (roll < w) return r;
    roll -= w;
  }
  return 'common';
}

export function openSkillChest(params: {
  tier: ChestTierId;
  chests: ChestInventory;
  skills: SkillCollection;
  wallet: Wallet;
  rng?: () => number;
}): {
  success: boolean;
  chests: ChestInventory;
  skills: SkillCollection;
  wallet: Wallet;
  reward: ChestReward | null;
} {
  const consumeRes = consumeChest(params.chests, params.tier);
  if (!consumeRes.success) {
    return {
      success: false,
      chests: params.chests,
      skills: params.skills,
      wallet: params.wallet,
      reward: null,
    };
  }

  const rng = params.rng ?? Math.random;
  const cfg = CHEST_CONFIGS[params.tier];
  const rolledRarity = rollSkillRarityFromWeights(cfg.rarityWeights, rng);

  const matching = SKILL_ORDER.filter((id) => SKILL_DEFINITIONS[id].rarity === rolledRarity);
  const candidates = matching.length > 0 ? matching : SKILL_ORDER;
  const lockedCandidates = candidates.filter((id) => !params.skills[id].unlocked);
  const pool = lockedCandidates.length > 0 && rng() < 0.68 ? lockedCandidates : candidates;
  const chosenId = pool[Math.floor(rng() * pool.length)];

  const existing = params.skills[chosenId];
  const isNewUnlock = !existing.unlocked;
  const duplicatesGranted = isNewUnlock ? 0 : cfg.duplicatesPerDrop;

  const bonusTech = Math.round(
    cfg.bonusTechMin + rng() * (cfg.bonusTechMax - cfg.bonusTechMin),
  );

  const nextSkills: SkillCollection = {
    ...params.skills,
    [chosenId]: {
      id: chosenId,
      unlocked: true,
      level: clampSkillLevel(existing.level),
      duplicates: existing.duplicates + duplicatesGranted,
    },
  };

  const nextWallet = addCurrency(params.wallet, 'skillTech', bonusTech);

  return {
    success: true,
    chests: consumeRes.chests,
    skills: nextSkills,
    wallet: nextWallet,
    reward: {
      chestTier: params.tier,
      skillId: chosenId,
      rarity: SKILL_DEFINITIONS[chosenId].rarity,
      isNewUnlock,
      duplicatesGranted,
      bonusSkillTech: bonusTech,
    },
  };
}
