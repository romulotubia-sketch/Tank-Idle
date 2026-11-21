import {
  DAILY_DUNGEON_ENTRIES,
  DUNGEON_CONFIGS,
  MAX_DUNGEON_STAGE,
  MAX_EQUIPMENT_INVENTORY,
  getLocalDateKey,
} from './config';
import { addChest, addCurrencies } from './economy';
import { generateEquipment } from './forge';
import type {
  ChestInventory,
  DailyDungeonEntries,
  DungeonId,
  DungeonProgressMap,
  DungeonRewardBundle,
  EquipmentItem,
  EquipmentRarity,
  Wallet,
} from './types';

export function refreshDailyDungeonEntries(
  entries: DailyDungeonEntries,
  nowMs: number = Date.now(),
): DailyDungeonEntries {
  const today = getLocalDateKey(nowMs);
  if (entries.lastResetDate !== today) {
    return {
      remaining: DAILY_DUNGEON_ENTRIES,
      max: DAILY_DUNGEON_ENTRIES,
      lastResetDate: today,
    };
  }
  const clampedRemaining = Math.max(0, Math.min(DAILY_DUNGEON_ENTRIES, Math.floor(entries.remaining)));
  if (clampedRemaining !== entries.remaining || entries.max !== DAILY_DUNGEON_ENTRIES) {
    return {
      remaining: clampedRemaining,
      max: DAILY_DUNGEON_ENTRIES,
      lastResetDate: today,
    };
  }
  return entries;
}

export function isDungeonStageUnlocked(
  dungeonId: DungeonId,
  stage: number,
  progress: DungeonProgressMap,
): boolean {
  if (!Number.isInteger(stage) || stage < 1 || stage > MAX_DUNGEON_STAGE) {
    return false;
  }
  const highestCleared = progress[dungeonId]?.highestClearedStage ?? 0;
  return stage <= Math.min(MAX_DUNGEON_STAGE, highestCleared + 1);
}

export function canEnterDungeonStage(
  dungeonId: DungeonId,
  stage: number,
  progress: DungeonProgressMap,
  entries: DailyDungeonEntries,
  nowMs: number = Date.now(),
): {
  allowed: boolean;
  reason: string | null;
  refreshedEntries: DailyDungeonEntries;
} {
  const refreshedEntries = refreshDailyDungeonEntries(entries, nowMs);
  if (!(dungeonId in DUNGEON_CONFIGS)) {
    return { allowed: false, reason: 'Invalid dungeon sector.', refreshedEntries };
  }
  if (!isDungeonStageUnlocked(dungeonId, stage, progress)) {
    return {
      allowed: false,
      reason: `Clear Stage ${Math.max(1, stage - 1)} first to unlock Stage ${stage}.`,
      refreshedEntries,
    };
  }
  if (refreshedEntries.remaining <= 0) {
    return {
      allowed: false,
      reason: 'Daily dungeon entries depleted (0/5). Resets tomorrow.',
      refreshedEntries,
    };
  }
  return { allowed: true, reason: null, refreshedEntries };
}

export function consumeDailyDungeonEntry(
  entries: DailyDungeonEntries,
  nowMs: number = Date.now(),
): {
  success: boolean;
  entries: DailyDungeonEntries;
} {
  const refreshed = refreshDailyDungeonEntries(entries, nowMs);
  if (refreshed.remaining <= 0) {
    return { success: false, entries: refreshed };
  }
  return {
    success: true,
    entries: {
      ...refreshed,
      remaining: refreshed.remaining - 1,
    },
  };
}

export function recordDungeonCompletion(
  dungeonId: DungeonId,
  stage: number,
  victory: boolean,
  progress: DungeonProgressMap,
): {
  progress: DungeonProgressMap;
  newlyUnlockedStage: number | null;
} {
  if (!victory) {
    return { progress, newlyUnlockedStage: null };
  }
  const current = progress[dungeonId] ?? { highestClearedStage: 0, clears: 0, bossClears: 0 };
  const clampedStage = Math.max(1, Math.min(MAX_DUNGEON_STAGE, stage));
  const nextHighest = Math.max(current.highestClearedStage, clampedStage);
  const newlyUnlockedStage =
    clampedStage > current.highestClearedStage && clampedStage < MAX_DUNGEON_STAGE
      ? clampedStage + 1
      : null;

  return {
    progress: {
      ...progress,
      [dungeonId]: {
        highestClearedStage: nextHighest,
        clears: current.clears + 1,
        bossClears: current.bossClears + 1,
      },
    },
    newlyUnlockedStage,
  };
}

function rollEquipmentRarityForStronghold(stage: number, rng: () => number): EquipmentRarity {
  const r = rng();
  if (stage <= 2) {
    return r < 0.3 ? 'military' : 'reinforced';
  }
  if (stage <= 4) {
    return r < 0.14 ? 'advanced' : r < 0.58 ? 'military' : 'reinforced';
  }
  if (stage <= 7) {
    return r < 0.18 ? 'elite' : r < 0.56 ? 'advanced' : 'military';
  }
  if (stage <= 9) {
    return r < 0.14 ? 'prototype' : r < 0.5 ? 'elite' : 'advanced';
  }
  // Stage 10 high-tier Stronghold drop
  return r < 0.3 ? 'prototype' : r < 0.78 ? 'elite' : 'advanced';
}

function rollBonusEquipmentRarity(stage: number, rng: () => number): EquipmentRarity {
  const r = rng();
  if (stage <= 3) return r < 0.25 ? 'reinforced' : 'scrap';
  if (stage <= 6) return r < 0.35 ? 'military' : 'reinforced';
  if (stage <= 9) return r < 0.28 ? 'advanced' : 'military';
  return r < 0.22 ? 'elite' : 'advanced';
}

export interface DungeonStagePreviewRewards {
  scrapEstimate: number;
  forgeCoresEstimate: number;
  skillTechEstimate: number;
  alloyPlatesEstimate: number;
  equipmentSummary: string;
  skillChestSummary: string;
}

export function getDungeonStagePreviewRewards(
  dungeonId: DungeonId,
  stage: number,
): DungeonStagePreviewRewards {
  const s = Math.max(1, Math.min(MAX_DUNGEON_STAGE, stage));
  const finalMult = s === MAX_DUNGEON_STAGE ? 1.35 : 1;

  if (dungeonId === 'salvage_yard') {
    const baseScrap = Math.round((85 + s * 44) * finalMult);
    const bossScrap = Math.round((40 + s * 20) * finalMult);
    const dropPct = Math.min(45, 16 + s * 3);
    return {
      scrapEstimate: baseScrap + bossScrap,
      forgeCoresEstimate: 0,
      skillTechEstimate: 0,
      alloyPlatesEstimate: 0,
      equipmentSummary: `${dropPct}% Gear Drop Chance`,
      skillChestSummary: 'None',
    };
  }

  if (dungeonId === 'arsenal_depot') {
    const baseCores = Math.round((5 + s * 1.4) * finalMult);
    const bossCores = Math.round((2 + Math.floor(s / 3)) * finalMult);
    const dropPct = Math.min(45, 18 + s * 2.5);
    return {
      scrapEstimate: Math.round((45 + s * 22) * finalMult),
      forgeCoresEstimate: baseCores + bossCores,
      skillTechEstimate: 0,
      alloyPlatesEstimate: 0,
      equipmentSummary: `${dropPct}% Gear Drop Chance`,
      skillChestSummary: 'None',
    };
  }

  if (dungeonId === 'armored_stronghold') {
    const tierHint =
      s <= 2
        ? 'Reinforced–Military'
        : s <= 4
          ? 'Reinforced–Advanced'
          : s <= 7
            ? 'Military–Elite'
            : s <= 9
              ? 'Advanced–Prototype'
              : 'Elite–Prototype';
    return {
      scrapEstimate: Math.round((40 + s * 20) * finalMult),
      forgeCoresEstimate: Math.round((2 + Math.floor(s * 0.6)) * finalMult),
      skillTechEstimate: 0,
      alloyPlatesEstimate: Math.round((3 + s) * finalMult),
      equipmentSummary: `Guaranteed Chest (${tierHint})${s >= 6 ? ` · +${15 + s * 3}% 2nd Drop` : ''}`,
      skillChestSummary: 'None',
    };
  }

  // experimental_grounds
  const chestName = s <= 4 ? 'Standard Skill Chest' : s <= 8 ? 'Advanced Skill Chest' : 'Elite Skill Chest';
  const extraPct = Math.min(65, 15 + s * 5);
  return {
    scrapEstimate: Math.round((45 + s * 24) * finalMult),
    forgeCoresEstimate: Math.round((3 + Math.floor(s * 0.8)) * finalMult),
    skillTechEstimate: Math.round((10 + s * 3) * finalMult),
    alloyPlatesEstimate: 0,
    equipmentSummary: 'None',
    skillChestSummary: `${chestName} · +${extraPct}% Extra Chest`,
  };
}

export function generateDungeonRewards(params: {
  dungeonId: DungeonId;
  stage: number;
  tankLevel: number;
  victory: boolean;
  wavesCleared: number;
  totalWaves: number;
  rng?: () => number;
}): DungeonRewardBundle {
  const { dungeonId, stage, tankLevel, victory, rng = Math.random } = params;

  const emptyBundle: DungeonRewardBundle = {
    scrap: 0,
    forgeCores: 0,
    skillTech: 0,
    alloyPlates: 0,
    chests: {},
    equipment: [],
  };

  // Strict Stage 2C rule: Grant rewards ONLY after successful completion
  if (!victory) {
    return emptyBundle;
  }

  const s = Math.max(1, Math.min(MAX_DUNGEON_STAGE, stage));
  const finalMult = s === MAX_DUNGEON_STAGE ? 1.35 : 1;
  const effectiveItemLevel = Math.max(tankLevel, s * 3);
  const bundle: DungeonRewardBundle = { ...emptyBundle, chests: {}, equipment: [] };

  if (dungeonId === 'salvage_yard') {
    const baseScrap = Math.round((85 + s * 44) * finalMult);
    const bossBonusScrap = Math.round((40 + s * 20) * finalMult);
    bundle.scrap = baseScrap + bossBonusScrap;
    const dropChance = Math.min(0.45, 0.16 + s * 0.03);
    if (rng() < dropChance) {
      const rarity = rollBonusEquipmentRarity(s, rng);
      bundle.equipment.push(generateEquipment(rarity, effectiveItemLevel));
    }
  } else if (dungeonId === 'arsenal_depot') {
    const baseCores = Math.round((5 + s * 1.4) * finalMult);
    const bossBonusCores = Math.round((2 + Math.floor(s / 3)) * finalMult);
    bundle.forgeCores = baseCores + bossBonusCores;
    bundle.scrap = Math.round((45 + s * 22) * finalMult);
    const dropChance = Math.min(0.45, 0.18 + s * 0.025);
    if (rng() < dropChance) {
      const rarity = rollBonusEquipmentRarity(s, rng);
      bundle.equipment.push(generateEquipment(rarity, effectiveItemLevel));
    }
  } else if (dungeonId === 'armored_stronghold') {
    bundle.scrap = Math.round((40 + s * 20) * finalMult);
    bundle.forgeCores = Math.round((2 + Math.floor(s * 0.6)) * finalMult);
    bundle.alloyPlates = Math.round((3 + s) * finalMult);
    const primaryRarity = rollEquipmentRarityForStronghold(s, rng);
    bundle.equipment.push(generateEquipment(primaryRarity, effectiveItemLevel));
    if (s >= 6 && rng() < 0.15 + s * 0.03) {
      const secondaryRarity = rollEquipmentRarityForStronghold(s, rng);
      bundle.equipment.push(generateEquipment(secondaryRarity, effectiveItemLevel));
    }
  } else if (dungeonId === 'experimental_grounds') {
    bundle.scrap = Math.round((45 + s * 24) * finalMult);
    bundle.forgeCores = Math.round((3 + Math.floor(s * 0.8)) * finalMult);
    bundle.skillTech = Math.round((10 + s * 3) * finalMult);
    if (s <= 4) {
      bundle.chests.standard = 1;
    } else if (s <= 8) {
      bundle.chests.advanced = 1;
    } else {
      bundle.chests.elite = 1;
    }
    const extraChestChance = Math.min(0.65, 0.15 + s * 0.05);
    if (rng() < extraChestChance) {
      if (s <= 5) {
        bundle.chests.standard = (bundle.chests.standard ?? 0) + 1;
      } else {
        bundle.chests.advanced = (bundle.chests.advanced ?? 0) + 1;
      }
    }
  }

  return bundle;
}

export function applyDungeonRewards(params: {
  wallet: Wallet;
  chests: ChestInventory;
  inventory: EquipmentItem[];
  rewards: DungeonRewardBundle;
}): {
  wallet: Wallet;
  chests: ChestInventory;
  inventory: EquipmentItem[];
} {
  const nextWallet = addCurrencies(params.wallet, {
    scrap: params.rewards.scrap,
    forgeCores: params.rewards.forgeCores,
    skillTech: params.rewards.skillTech,
    alloyPlates: params.rewards.alloyPlates,
  });

  let nextChests = { ...params.chests };
  if (params.rewards.chests.standard) {
    nextChests = addChest(nextChests, 'standard', params.rewards.chests.standard);
  }
  if (params.rewards.chests.advanced) {
    nextChests = addChest(nextChests, 'advanced', params.rewards.chests.advanced);
  }
  if (params.rewards.chests.elite) {
    nextChests = addChest(nextChests, 'elite', params.rewards.chests.elite);
  }

  const nextInventory =
    params.rewards.equipment.length > 0
      ? [...params.rewards.equipment, ...params.inventory].slice(0, MAX_EQUIPMENT_INVENTORY)
      : params.inventory;

  return {
    wallet: nextWallet,
    chests: nextChests,
    inventory: nextInventory,
  };
}
