import {
  AUTO_FORGE_UNLOCK_LEVEL,
  EQUIPMENT_PASSIVE_POOL,
  EQUIPMENT_RARITY_META,
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_SLOTS,
  FORGE_TIERS,
  MAX_EQUIPMENT_INVENTORY,
} from './config';
import { addCurrencies, canAffordAll, spendCurrencies } from './economy';
import type {
  AutoForgeSettings,
  EquipmentItem,
  EquipmentPassive,
  EquipmentRarity,
  EquipmentSlot,
  EquipmentStatBonus,
  ForgeTierId,
  Wallet,
} from './types';

let eqCounter = 1;

export function isAutoForgeUnlocked(tankLevel: number): boolean {
  return tankLevel >= AUTO_FORGE_UNLOCK_LEVEL;
}

export function getRarityRank(rarity: EquipmentRarity): number {
  return EQUIPMENT_RARITY_META[rarity].rank;
}

export function meetsTargetRarity(
  rolled: EquipmentRarity,
  target: EquipmentRarity,
): boolean {
  return getRarityRank(rolled) >= getRarityRank(target);
}

export function rollForgeRarity(
  weights: Record<EquipmentRarity, number>,
  rng: () => number = Math.random,
): EquipmentRarity {
  let total = 0;
  for (const r of EQUIPMENT_RARITY_ORDER) {
    total += Math.max(0, weights[r] ?? 0);
  }
  if (total <= 0) return 'scrap';

  let roll = rng() * total;
  for (const r of EQUIPMENT_RARITY_ORDER) {
    const w = Math.max(0, weights[r] ?? 0);
    if (roll < w) return r;
    roll -= w;
  }
  return 'scrap';
}

export function computeEquipmentPower(item: {
  bonuses: EquipmentStatBonus;
  passive: EquipmentPassive | null;
}): number {
  const b = item.bonuses;
  let score = 0;
  score += (b.maxHp ?? 0) * 0.35;
  score += (b.attackDamage ?? 0) * 3.1;
  score += (b.attackSpeed ?? 0) * 140;
  score += (b.armor ?? 0) * 5.2;
  score += (b.critChance ?? 0) * 450;
  score += (b.critDamage ?? 0) * 90;
  if (item.passive) {
    score += 35 + item.passive.value * 260;
  }
  return Math.round(score);
}

function buildStatAmount(
  stat: keyof EquipmentStatBonus,
  rarityMult: number,
  tankLevel: number,
  isPrimary: boolean,
): number {
  const levelMult = 1 + Math.max(0, tankLevel - 1) * 0.08;
  const weight = isPrimary ? 1.0 : 0.55;
  const variance = 0.92 + Math.random() * 0.16;

  switch (stat) {
    case 'maxHp':
      return Math.round(28 * rarityMult * levelMult * weight * variance);
    case 'attackDamage':
      return Math.round(5 * rarityMult * levelMult * weight * variance);
    case 'attackSpeed':
      return Number(Math.min(0.45, 0.045 * Math.pow(rarityMult, 0.65) * weight * variance).toFixed(2));
    case 'armor':
      return Math.round(2.5 * rarityMult * Math.pow(levelMult, 0.75) * weight * variance);
    case 'critChance':
      return Number(Math.min(0.18, 0.012 * Math.pow(rarityMult, 0.72) * weight * variance).toFixed(3));
    case 'critDamage':
      return Number((0.08 * Math.pow(rarityMult, 0.75) * weight * variance).toFixed(2));
  }
}

export function generateEquipment(
  rarity: EquipmentRarity,
  tankLevel: number,
  forcedSlot?: EquipmentSlot,
): EquipmentItem {
  const slotMeta =
    EQUIPMENT_SLOTS.find((s) => s.id === forcedSlot) ??
    EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
  const rarityMeta = EQUIPMENT_RARITY_META[rarity];

  const bonuses: EquipmentStatBonus = {};
  bonuses[slotMeta.primaryStat] = buildStatAmount(
    slotMeta.primaryStat,
    rarityMeta.multiplier,
    tankLevel,
    true,
  );

  // Add secondary stats based on rarity tier
  const secondaryCount = rarityMeta.rank >= 5 ? 2 : rarityMeta.rank >= 2 ? 1 : 0;
  const otherStats = (
    ['maxHp', 'attackDamage', 'attackSpeed', 'armor', 'critChance', 'critDamage'] as const
  ).filter((s) => s !== slotMeta.primaryStat);

  for (let i = 0; i < secondaryCount; i++) {
    const pickIdx = Math.floor(Math.random() * otherStats.length);
    const stat = otherStats.splice(pickIdx, 1)[0];
    bonuses[stat] = buildStatAmount(stat, rarityMeta.multiplier, tankLevel, false);
  }

  // Passive roll
  let passive: EquipmentPassive | null = null;
  if (Math.random() < rarityMeta.passiveChance) {
    const poolItem =
      EQUIPMENT_PASSIVE_POOL[Math.floor(Math.random() * EQUIPMENT_PASSIVE_POOL.length)];
    const val = Number((poolItem.baseValue + (rarityMeta.rank - 1) * poolItem.perRank).toFixed(3));
    passive = {
      id: poolItem.id,
      label: poolItem.label,
      description: poolItem.formatDesc(val),
      value: val,
    };
  }

  const nameBase =
    slotMeta.names[Math.min(slotMeta.names.length - 1, Math.floor((rarityMeta.rank - 1) / 1.5))];

  const item: EquipmentItem = {
    id: `eq_${Date.now()}_${eqCounter++}`,
    name: `${rarityMeta.label} ${nameBase}`,
    slot: slotMeta.id,
    rarity,
    level: 1,
    powerScore: 0,
    bonuses,
    passive,
    createdAt: Date.now(),
  };
  item.powerScore = computeEquipmentPower(item);
  return item;
}

export function getForgeProbabilityList(tierId: ForgeTierId): {
  rarity: EquipmentRarity;
  label: string;
  chancePercent: number;
}[] {
  const tier = FORGE_TIERS[tierId];
  const total = EQUIPMENT_RARITY_ORDER.reduce(
    (acc, r) => acc + Math.max(0, tier.rarityWeights[r] ?? 0),
    0,
  );
  return EQUIPMENT_RARITY_ORDER.map((r) => ({
    rarity: r,
    label: EQUIPMENT_RARITY_META[r].label,
    chancePercent: total > 0 ? Number((((tier.rarityWeights[r] ?? 0) / total) * 100).toFixed(1)) : 0,
  }));
}

export function forgeSingleItem(params: {
  wallet: Wallet;
  tierId: ForgeTierId;
  tankLevel: number;
  forcedSlot?: EquipmentSlot;
  rng?: () => number;
}): {
  success: boolean;
  wallet: Wallet;
  item: EquipmentItem | null;
  scrapSpent: number;
  coresSpent: number;
  error?: string;
} {
  const tier = FORGE_TIERS[params.tierId];
  const costs = { scrap: tier.scrapCost, forgeCores: tier.coreCost };

  if (!canAffordAll(params.wallet, costs)) {
    return {
      success: false,
      wallet: params.wallet,
      item: null,
      scrapSpent: 0,
      coresSpent: 0,
      error: 'Insufficient Scrap or Forge Cores',
    };
  }

  const spendRes = spendCurrencies(params.wallet, costs);
  if (!spendRes.success) {
    return {
      success: false,
      wallet: params.wallet,
      item: null,
      scrapSpent: 0,
      coresSpent: 0,
      error: 'Insufficient resources',
    };
  }

  const rarity = rollForgeRarity(tier.rarityWeights, params.rng);
  const item = generateEquipment(rarity, params.tankLevel, params.forcedSlot);

  return {
    success: true,
    wallet: spendRes.wallet,
    item,
    scrapSpent: tier.scrapCost,
    coresSpent: tier.coreCost,
  };
}

export function getEquipmentUpgradeCost(item: EquipmentItem): {
  scrap: number;
  alloyPlates: number;
} {
  const rank = EQUIPMENT_RARITY_META[item.rarity].rank;
  return {
    scrap: Math.round((16 + item.level * 12) * (1 + rank * 0.35)),
    alloyPlates: Math.max(1, Math.round((1 + item.level * 0.8) * (1 + (rank - 1) * 0.45))),
  };
}

export function upgradeEquipmentItem(
  item: EquipmentItem,
  wallet: Wallet,
): { success: boolean; item: EquipmentItem; wallet: Wallet } {
  const costs = getEquipmentUpgradeCost(item);
  const spendRes = spendCurrencies(wallet, costs);
  if (!spendRes.success) {
    return { success: false, item, wallet };
  }

  const scaleFactor = 1.12;
  const nextBonuses: EquipmentStatBonus = {};
  if (item.bonuses.maxHp) nextBonuses.maxHp = Math.round(item.bonuses.maxHp * scaleFactor + 6);
  if (item.bonuses.attackDamage)
    nextBonuses.attackDamage = Math.round(item.bonuses.attackDamage * scaleFactor + 2);
  if (item.bonuses.attackSpeed)
    nextBonuses.attackSpeed = Number((item.bonuses.attackSpeed + 0.01).toFixed(2));
  if (item.bonuses.armor) nextBonuses.armor = Math.round(item.bonuses.armor * scaleFactor + 1);
  if (item.bonuses.critChance)
    nextBonuses.critChance = Number((item.bonuses.critChance + 0.004).toFixed(3));
  if (item.bonuses.critDamage)
    nextBonuses.critDamage = Number((item.bonuses.critDamage + 0.02).toFixed(2));

  const upgraded: EquipmentItem = {
    ...item,
    level: item.level + 1,
    bonuses: nextBonuses,
    powerScore: 0,
  };
  upgraded.powerScore = computeEquipmentPower(upgraded);

  return { success: true, item: upgraded, wallet: spendRes.wallet };
}

export function getEquipmentSalvageYield(item: EquipmentItem): {
  scrap: number;
  alloyPlates: number;
} {
  const meta = EQUIPMENT_RARITY_META[item.rarity];
  return {
    scrap: Math.round(meta.salvageScrap * (1 + (item.level - 1) * 0.35)),
    alloyPlates: Math.max(1, meta.salvageAlloys + Math.floor((item.level - 1) * 0.5)),
  };
}

export function salvageEquipmentItem(
  item: EquipmentItem,
  wallet: Wallet,
): Wallet {
  const yieldRes = getEquipmentSalvageYield(item);
  return addCurrencies(wallet, yieldRes);
}

export interface AutoForgeStepResult {
  continueLoop: boolean;
  stopReason: string | null;
  wallet: Wallet;
  inventory: EquipmentItem[];
  forgedItem: EquipmentItem | null;
  salvaged: boolean;
  scrapSpent: number;
  coresSpent: number;
}

export function runAutoForgeStep(params: {
  settings: AutoForgeSettings;
  tankLevel: number;
  wallet: Wallet;
  inventory: EquipmentItem[];
  rng?: () => number;
}): AutoForgeStepResult {
  if (!isAutoForgeUnlocked(params.tankLevel)) {
    return {
      continueLoop: false,
      stopReason: `Locked until Tank Level ${AUTO_FORGE_UNLOCK_LEVEL}`,
      wallet: params.wallet,
      inventory: params.inventory,
      forgedItem: null,
      salvaged: false,
      scrapSpent: 0,
      coresSpent: 0,
    };
  }

  // Never discard valuable equipment when inventory is full unless explicitly auto-salvaging lower
  if (params.inventory.length >= MAX_EQUIPMENT_INVENTORY && !params.settings.autoSalvageLower) {
    return {
      continueLoop: false,
      stopReason: 'Armory inventory full — salvage or equip gear to continue',
      wallet: params.wallet,
      inventory: params.inventory,
      forgedItem: null,
      salvaged: false,
      scrapSpent: 0,
      coresSpent: 0,
    };
  }

  const forgeRes = forgeSingleItem({
    wallet: params.wallet,
    tierId: params.settings.tierId,
    tankLevel: params.tankLevel,
    rng: params.rng,
  });

  if (!forgeRes.success || !forgeRes.item) {
    return {
      continueLoop: false,
      stopReason: 'Stopped: insufficient Scrap or Forge Cores',
      wallet: params.wallet,
      inventory: params.inventory,
      forgedItem: null,
      salvaged: false,
      scrapSpent: 0,
      coresSpent: 0,
    };
  }

  const item = forgeRes.item;
  const hitTarget = meetsTargetRarity(item.rarity, params.settings.targetRarity);

  if (hitTarget) {
    if (params.inventory.length >= MAX_EQUIPMENT_INVENTORY) {
      // Keep the target item at top even if inventory is full by stopping and letting player inspect;
      // actually prepend safely or cap cleanly only when under limit:
      return {
        continueLoop: false,
        stopReason: `Target reached: ${EQUIPMENT_RARITY_META[item.rarity].label} gear forged!`,
        wallet: forgeRes.wallet,
        inventory: [item, ...params.inventory.slice(0, MAX_EQUIPMENT_INVENTORY - 1)],
        forgedItem: item,
        salvaged: false,
        scrapSpent: forgeRes.scrapSpent,
        coresSpent: forgeRes.coresSpent,
      };
    }

    return {
      continueLoop: false,
      stopReason: `Target reached: ${EQUIPMENT_RARITY_META[item.rarity].label} gear forged!`,
      wallet: forgeRes.wallet,
      inventory: [item, ...params.inventory],
      forgedItem: item,
      salvaged: false,
      scrapSpent: forgeRes.scrapSpent,
      coresSpent: forgeRes.coresSpent,
    };
  }

  // Below target rarity
  if (params.settings.autoSalvageLower) {
    const walletAfterSalvage = salvageEquipmentItem(item, forgeRes.wallet);
    return {
      continueLoop: true,
      stopReason: null,
      wallet: walletAfterSalvage,
      inventory: params.inventory,
      forgedItem: item,
      salvaged: true,
      scrapSpent: forgeRes.scrapSpent,
      coresSpent: forgeRes.coresSpent,
    };
  }

  if (params.inventory.length + 1 >= MAX_EQUIPMENT_INVENTORY) {
    return {
      continueLoop: false,
      stopReason: 'Armory inventory full — stopped to preserve forged gear',
      wallet: forgeRes.wallet,
      inventory: [item, ...params.inventory],
      forgedItem: item,
      salvaged: false,
      scrapSpent: forgeRes.scrapSpent,
      coresSpent: forgeRes.coresSpent,
    };
  }

  return {
    continueLoop: true,
    stopReason: null,
    wallet: forgeRes.wallet,
    inventory: [item, ...params.inventory],
    forgedItem: item,
    salvaged: false,
    scrapSpent: forgeRes.scrapSpent,
    coresSpent: forgeRes.coresSpent,
  };
}
