import {
  ACHIEVEMENTS,
  DAILY_MISSION_COUNT,
  DAILY_MISSION_POOL,
  LOGIN_REWARD_CALENDAR,
  OFFLINE_EARNINGS_MAX_SECONDS,
  OFFLINE_EARNINGS_MIN_SECONDS,
  SKILL_ORDER,
  TANK_MILESTONES,
  WEEKLY_MISSION_COUNT,
  WEEKLY_MISSION_POOL,
  getLocalDateKey,
  getWaveClearBonus,
  getWeekStartDateKey,
} from './config';
import { addChest, addCurrencies } from './economy';
import { generateEquipment } from './forge';
import { computeEffectiveDps } from './progression';
import type {
  AchievementDefinition,
  ChestInventory,
  DailyMissionsState,
  DungeonProgressMap,
  EquipmentItem,
  EquipmentRarity,
  EquippedGearMap,
  LifetimeStats,
  LoginCalendarState,
  LoginRewardDay,
  MissionDefinition,
  MissionItem,
  MissionObjectiveType,
  OfflineEarningsSummary,
  ProgressionRewardBundle,
  SkillCollection,
  TankMilestoneDefinition,
  TankStats,
  Wallet,
  WeeklyMissionsState,
} from './types';

function hashDateString(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toMissionItem(def: MissionDefinition): MissionItem {
  return {
    id: def.id,
    objective: def.objective,
    title: def.title,
    description: def.description,
    target: def.target,
    progress: 0,
    claimed: false,
    rewards: def.rewards,
  };
}

// ---------------- DAILY & WEEKLY MISSIONS ----------------

export function generateDailyMissions(dateKey: string): DailyMissionsState {
  const pool = [...DAILY_MISSION_POOL];
  let seed = hashDateString(dateKey);

  // Deterministic Fisher-Yates shuffle based on calendar date key
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return {
    dateKey,
    missions: pool.slice(0, DAILY_MISSION_COUNT).map(toMissionItem),
  };
}

export function refreshDailyMissions(
  state: DailyMissionsState,
  nowMs: number = Date.now(),
): DailyMissionsState {
  const today = getLocalDateKey(nowMs);
  if (state.dateKey === today && state.missions.length === DAILY_MISSION_COUNT) {
    return state;
  }
  return generateDailyMissions(today);
}

export function generateWeeklyMissions(weekStartDate: string): WeeklyMissionsState {
  return {
    weekStartDate,
    missions: WEEKLY_MISSION_POOL.slice(0, WEEKLY_MISSION_COUNT).map(toMissionItem),
  };
}

export function refreshWeeklyMissions(
  state: WeeklyMissionsState,
  nowMs: number = Date.now(),
): WeeklyMissionsState {
  const currentWeek = getWeekStartDateKey(nowMs);
  if (state.weekStartDate === currentWeek && state.missions.length === WEEKLY_MISSION_COUNT) {
    return state;
  }
  return generateWeeklyMissions(currentWeek);
}

export function recordMissionProgress(params: {
  daily: DailyMissionsState;
  weekly: WeeklyMissionsState;
  objective: MissionObjectiveType;
  amount: number;
  nowMs?: number;
}): { daily: DailyMissionsState; weekly: WeeklyMissionsState } {
  const nowMs = params.nowMs ?? Date.now();
  const daily = refreshDailyMissions(params.daily, nowMs);
  const weekly = refreshWeeklyMissions(params.weekly, nowMs);

  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { daily, weekly };
  }
  const inc = Math.floor(params.amount);

  const updateList = (list: MissionItem[]): MissionItem[] =>
    list.map((m) => {
      if (m.objective !== params.objective || m.claimed) {
        return m;
      }
      const nextProgress = Math.min(m.target, m.progress + inc);
      if (nextProgress === m.progress) return m;
      return { ...m, progress: nextProgress };
    });

  return {
    daily: { ...daily, missions: updateList(daily.missions) },
    weekly: { ...weekly, missions: updateList(weekly.missions) },
  };
}

export function claimDailyMission(
  state: DailyMissionsState,
  missionId: string,
  nowMs: number = Date.now(),
): {
  success: boolean;
  state: DailyMissionsState;
  rewards: ProgressionRewardBundle | null;
} {
  const refreshed = refreshDailyMissions(state, nowMs);
  const idx = refreshed.missions.findIndex((m) => m.id === missionId);
  if (idx === -1) {
    return { success: false, state: refreshed, rewards: null };
  }
  const target = refreshed.missions[idx];
  if (target.claimed || target.progress < target.target) {
    return { success: false, state: refreshed, rewards: null };
  }

  const nextMissions = refreshed.missions.map((m, i) =>
    i === idx ? { ...m, claimed: true } : m,
  );
  return {
    success: true,
    state: { ...refreshed, missions: nextMissions },
    rewards: target.rewards,
  };
}

export function claimWeeklyMission(
  state: WeeklyMissionsState,
  missionId: string,
  nowMs: number = Date.now(),
): {
  success: boolean;
  state: WeeklyMissionsState;
  rewards: ProgressionRewardBundle | null;
} {
  const refreshed = refreshWeeklyMissions(state, nowMs);
  const idx = refreshed.missions.findIndex((m) => m.id === missionId);
  if (idx === -1) {
    return { success: false, state: refreshed, rewards: null };
  }
  const target = refreshed.missions[idx];
  if (target.claimed || target.progress < target.target) {
    return { success: false, state: refreshed, rewards: null };
  }

  const nextMissions = refreshed.missions.map((m, i) =>
    i === idx ? { ...m, claimed: true } : m,
  );
  return {
    success: true,
    state: { ...refreshed, missions: nextMissions },
    rewards: target.rewards,
  };
}

// ---------------- 7-DAY DAILY LOGIN REWARDS ----------------

export function canClaimLoginReward(
  state: LoginCalendarState,
  nowMs: number = Date.now(),
): boolean {
  const today = getLocalDateKey(nowMs);
  return state.lastClaimDate !== today;
}

export function getNextLoginDayNumber(
  state: LoginCalendarState,
  nowMs: number = Date.now(),
): number {
  const canClaimToday = canClaimLoginReward(state, nowMs);
  if (state.claimedDays >= 7) {
    return canClaimToday ? 1 : 7;
  }
  if (!canClaimToday) {
    return Math.max(1, state.claimedDays);
  }
  return state.claimedDays + 1;
}

export function claimLoginReward(
  state: LoginCalendarState,
  nowMs: number = Date.now(),
): {
  success: boolean;
  state: LoginCalendarState;
  rewardDay: LoginRewardDay | null;
} {
  const today = getLocalDateKey(nowMs);
  if (state.lastClaimDate === today) {
    return { success: false, state, rewardDay: null };
  }

  // Restart cycle back to Day 1 after completing Day 7
  const nextDayNumber = state.claimedDays >= 7 ? 1 : state.claimedDays + 1;
  const rewardDay =
    LOGIN_REWARD_CALENDAR.find((d) => d.day === nextDayNumber) ??
    LOGIN_REWARD_CALENDAR[0];

  return {
    success: true,
    state: {
      claimedDays: nextDayNumber,
      lastClaimDate: today,
    },
    rewardDay,
  };
}

// ---------------- ACHIEVEMENTS ----------------

export interface AchievementContext {
  lifetimeStats: LifetimeStats;
  equippedGear: EquippedGearMap;
  equipmentInventory: EquipmentItem[];
  skills: SkillCollection;
  dungeonProgress: DungeonProgressMap;
  tankLevel: number;
  highestStage: number;
  totalKills: number;
}

export function getAchievementProgress(
  def: AchievementDefinition,
  ctx: AchievementContext,
): number {
  switch (def.metric) {
    case 'enemiesDefeated':
      return Math.max(ctx.lifetimeStats.enemiesDefeated, ctx.totalKills);
    case 'bossesDefeated':
      return ctx.lifetimeStats.bossesDefeated;
    case 'equippedSlotsCount':
      return Object.values(ctx.equippedGear).filter(Boolean).length;
    case 'prototypeObtained': {
      const hasPrototypeEquipped = Object.values(ctx.equippedGear).some(
        (item) => item?.rarity === 'prototype',
      );
      const hasPrototypeStored = ctx.equipmentInventory.some(
        (item) => item.rarity === 'prototype',
      );
      return ctx.lifetimeStats.prototypeObtained || hasPrototypeEquipped || hasPrototypeStored
        ? 1
        : 0;
    }
    case 'equipmentUpgraded':
      return ctx.lifetimeStats.equipmentUpgraded;
    case 'itemsForged':
      return ctx.lifetimeStats.itemsForged;
    case 'unlockedSkillsCount':
      return SKILL_ORDER.filter((id) => ctx.skills[id]?.unlocked).length;
    case 'skillsActivated':
      return ctx.lifetimeStats.skillsActivated;
    case 'maxSkillLevel':
      return Math.max(
        1,
        ...SKILL_ORDER.map((id) => (ctx.skills[id]?.unlocked ? ctx.skills[id].level : 1)),
      );
    case 'dungeonsCompleted': {
      const totalFromProgress = Object.values(ctx.dungeonProgress).reduce(
        (acc, p) => acc + p.clears,
        0,
      );
      return Math.max(ctx.lifetimeStats.dungeonsCompleted, totalFromProgress);
    }
    case 'completedAllStagesDungeonsCount':
      return Object.values(ctx.dungeonProgress).filter((p) => p.highestClearedStage >= 10)
        .length;
    case 'dungeonBossesDefeated': {
      const totalFromProgress = Object.values(ctx.dungeonProgress).reduce(
        (acc, p) => acc + p.bossClears,
        0,
      );
      return Math.max(ctx.lifetimeStats.dungeonBossesDefeated, totalFromProgress);
    }
    case 'tankLevel':
      return ctx.tankLevel;
    case 'highestStage':
      return ctx.highestStage;
  }
}

export function claimAchievement(
  achievementId: string,
  claimedIds: string[],
  ctx: AchievementContext,
): {
  success: boolean;
  claimedIds: string[];
  definition: AchievementDefinition | null;
} {
  if (claimedIds.includes(achievementId)) {
    return { success: false, claimedIds, definition: null };
  }
  const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!def) {
    return { success: false, claimedIds, definition: null };
  }
  const current = getAchievementProgress(def, ctx);
  if (current < def.target) {
    return { success: false, claimedIds, definition: null };
  }
  return {
    success: true,
    claimedIds: [...claimedIds, def.id],
    definition: def,
  };
}

// ---------------- TANK PROGRESSION MILESTONES ----------------

export function claimTankMilestone(
  level: number,
  claimedLevels: number[],
  tankLevel: number,
): {
  success: boolean;
  claimedLevels: number[];
  milestone: TankMilestoneDefinition | null;
} {
  if (claimedLevels.includes(level)) {
    return { success: false, claimedLevels, milestone: null };
  }
  const milestone = TANK_MILESTONES.find((m) => m.level === level);
  if (!milestone || tankLevel < milestone.level) {
    return { success: false, claimedLevels, milestone: null };
  }
  return {
    success: true,
    claimedLevels: [...claimedLevels, milestone.level].sort((a, b) => a - b),
    milestone,
  };
}

// ---------------- SHARED REWARD APPLICATION ----------------

export function grantProgressionRewardBundle(params: {
  rewards: ProgressionRewardBundle;
  wallet: Wallet;
  chests: ChestInventory;
  inventory: EquipmentItem[];
  tankLevel: number;
  rng?: () => number;
}): {
  wallet: Wallet;
  chests: ChestInventory;
  inventory: EquipmentItem[];
  droppedEquipment: EquipmentItem | null;
  obtainedPrototype: boolean;
} {
  const rng = params.rng ?? Math.random;
  let nextWallet = addCurrencies(params.wallet, {
    scrap: params.rewards.scrap,
    forgeCores: params.rewards.forgeCores,
    skillTech: params.rewards.skillTech,
    alloyPlates: params.rewards.alloyPlates,
  });

  let nextChests = { ...params.chests };
  if (params.rewards.chests) {
    if (params.rewards.chests.standard) {
      nextChests = addChest(nextChests, 'standard', params.rewards.chests.standard);
    }
    if (params.rewards.chests.advanced) {
      nextChests = addChest(nextChests, 'advanced', params.rewards.chests.advanced);
    }
    if (params.rewards.chests.elite) {
      nextChests = addChest(nextChests, 'elite', params.rewards.chests.elite);
    }
  }

  let nextInventory = params.inventory;
  let droppedEquipment: EquipmentItem | null = null;
  let obtainedPrototype = false;

  if (params.rewards.equipmentChest) {
    let rarity: EquipmentRarity;
    const roll = rng();
    if (params.rewards.equipmentChest === 'premium') {
      rarity = roll < 0.28 ? 'prototype' : roll < 0.78 ? 'elite' : 'advanced';
    } else {
      rarity = roll < 0.35 ? 'advanced' : 'military';
    }
    const item = generateEquipment(rarity, Math.max(1, params.tankLevel));
    droppedEquipment = item;
    obtainedPrototype = item.rarity === 'prototype';
    nextInventory = [item, ...nextInventory];
  }

  return {
    wallet: nextWallet,
    chests: nextChests,
    inventory: nextInventory,
    droppedEquipment,
    obtainedPrototype,
  };
}

// ---------------- OFFLINE EARNINGS (SCRAP ONLY, 8H CAP) ----------------

export function estimateOfflineScrapPerHour(
  tankStats: TankStats,
  highestStage: number,
): number {
  const stage = Math.max(1, highestStage);
  const waveAvgBonus = getWaveClearBonus(stage, 2);
  const baseStageScrapPerMin = (24 + stage * 14 + waveAvgBonus * 0.85);
  const dpsFactor = Math.min(2.4, Math.max(0.85, Math.sqrt(Math.max(30, computeEffectiveDps(tankStats)) / 65)));
  const scrapBonusMult = 1 + Math.max(0, tankStats.scrapBonusRatio);
  // Offline rate sits around ~65% of active frontline clear efficiency
  return Math.max(120, Math.round(baseStageScrapPerMin * 60 * 0.65 * dpsFactor * scrapBonusMult));
}

export function calculateOfflineEarnings(params: {
  lastActiveAt: number;
  nowMs?: number;
  tankStats: TankStats;
  highestStage: number;
}): OfflineEarningsSummary | null {
  const nowMs = params.nowMs ?? Date.now();
  if (!Number.isFinite(params.lastActiveAt) || params.lastActiveAt <= 0) {
    return null;
  }

  const rawElapsedSec = Math.floor((nowMs - params.lastActiveAt) / 1000);
  if (rawElapsedSec < OFFLINE_EARNINGS_MIN_SECONDS) {
    return null;
  }

  const cappedSeconds = Math.min(OFFLINE_EARNINGS_MAX_SECONDS, rawElapsedSec);
  const wasCapped = rawElapsedSec > OFFLINE_EARNINGS_MAX_SECONDS;
  const scrapPerHour = estimateOfflineScrapPerHour(params.tankStats, params.highestStage);
  const scrapEarned = Math.max(1, Math.round((scrapPerHour * cappedSeconds) / 3600));

  return {
    elapsedSeconds: rawElapsedSec,
    cappedSeconds,
    wasCapped,
    scrapEarned,
  };
}

export function formatDurationShort(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${Math.max(1, minutes)}m`;
}
