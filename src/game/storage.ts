import {
  ACHIEVEMENTS,
  DAILY_DUNGEON_ENTRIES,
  DAILY_MISSION_POOL,
  DEFAULT_AUTO_FORGE_SETTINGS,
  DEFAULT_CHEST_INVENTORY,
  DEFAULT_EQUIPPED_GEAR,
  DEFAULT_UPGRADE_LEVELS,
  DUNGEON_ORDER,
  EQUIPMENT_RARITY_META,
  EQUIPMENT_SLOTS,
  MAX_DUNGEON_STAGE,
  MAX_EQUIPMENT_INVENTORY,
  MAX_EQUIPPED_SKILLS,
  MAX_SKILL_LEVEL,
  SAVE_STORAGE_KEY,
  SAVE_VERSION,
  SKILL_ORDER,
  TANK_MILESTONES,
  WEEKLY_MISSION_POOL,
  createDefaultDailyDungeonEntries,
  createDefaultDungeonProgress,
  createDefaultLifetimeStats,
  createDefaultLoginCalendar,
  createDefaultSkills,
  getLocalDateKey,
  getWeekStartDateKey,
} from './config';
import { refreshDailyDungeonEntries } from './dungeons';
import { createInitialChests, createInitialWallet } from './economy';
import { sanitizeUpgradeLevels } from './progression';
import {
  generateDailyMissions,
  generateWeeklyMissions,
  refreshDailyMissions,
  refreshWeeklyMissions,
} from './progressionSystems';
import type {
  AutoForgeSettings,
  ChestInventory,
  DailyDungeonEntries,
  DailyMissionsState,
  DungeonProgressMap,
  EquipmentItem,
  EquippedGearMap,
  LifetimeStats,
  LoginCalendarState,
  MissionItem,
  SaveData,
  SkillCollection,
  SkillId,
  WeeklyMissionsState,
} from './types';

const LEGACY_SKILL_ID_MAP: Record<string, SkillId> = {
  minefield: 'mine_deployment',
  napalm_strike: 'rocket_salvo',
  air_support: 'railgun_shot',
};

function mapSkillId(rawId: unknown): SkillId | null {
  if (typeof rawId !== 'string') return null;
  if (SKILL_ORDER.includes(rawId as SkillId)) return rawId as SkillId;
  return LEGACY_SKILL_ID_MAP[rawId] ?? null;
}

export function createDefaultSaveData(): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    wallet: createInitialWallet(),
    chests: createInitialChests(),
    upgradeLevels: { ...DEFAULT_UPGRADE_LEVELS },
    tankLevel: 1,
    tankXp: 0,
    equippedGear: { ...DEFAULT_EQUIPPED_GEAR },
    equipmentInventory: [],
    skills: createDefaultSkills(),
    equippedSkillIds: ['missile_barrage', 'repair_drone', null],
    autoSkillsEnabled: true,
    autoForge: { ...DEFAULT_AUTO_FORGE_SETTINGS },
    dungeonProgress: createDefaultDungeonProgress(),
    dungeonEntries: createDefaultDailyDungeonEntries(now),
    dailyMissions: generateDailyMissions(getLocalDateKey(now)),
    weeklyMissions: generateWeeklyMissions(getWeekStartDateKey(now)),
    loginCalendar: createDefaultLoginCalendar(),
    claimedAchievements: [],
    claimedMilestones: [],
    lifetimeStats: createDefaultLifetimeStats(),
    apexSkinEnabled: true,
    lastActiveAt: now,
    stage: 1,
    highestStage: 1,
    totalKills: 0,
    muted: false,
    savedAt: now,
  };
}

function isValidEquipmentItem(item: unknown): item is EquipmentItem {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Partial<EquipmentItem>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.level === 'number' &&
    typeof candidate.powerScore === 'number' &&
    EQUIPMENT_SLOTS.some((s) => s.id === candidate.slot) &&
    candidate.rarity !== undefined &&
    candidate.rarity in EQUIPMENT_RARITY_META &&
    typeof candidate.bonuses === 'object' &&
    candidate.bonuses !== null
  );
}

function sanitizeEquippedGear(raw: unknown): EquippedGearMap {
  const result: EquippedGearMap = { ...DEFAULT_EQUIPPED_GEAR };
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  for (const slot of EQUIPMENT_SLOTS) {
    const val = obj[slot.id];
    if (isValidEquipmentItem(val) && val.slot === slot.id) {
      result[slot.id] = val;
    }
  }
  return result;
}

function sanitizeSkills(raw: unknown): SkillCollection {
  const base = createDefaultSkills();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  for (const [rawKey, rawVal] of Object.entries(obj)) {
    const mappedId = mapSkillId(rawKey);
    if (!mappedId || !rawVal || typeof rawVal !== 'object') continue;
    const entry = rawVal as {
      unlocked?: unknown;
      level?: unknown;
      duplicates?: unknown;
      shards?: unknown;
    };
    const rawDup =
      typeof entry.duplicates === 'number' && Number.isFinite(entry.duplicates)
        ? entry.duplicates
        : typeof entry.shards === 'number' && Number.isFinite(entry.shards)
          ? entry.shards
          : 0;
    const rawLvl =
      typeof entry.level === 'number' && Number.isFinite(entry.level) && entry.level >= 1
        ? Math.min(MAX_SKILL_LEVEL, Math.floor(entry.level))
        : 1;

    base[mappedId] = {
      id: mappedId,
      unlocked: Boolean(entry.unlocked) || base[mappedId].unlocked,
      level: rawLvl,
      duplicates: Math.max(0, Math.floor(rawDup)),
    };
  }
  return base;
}

function sanitizeEquippedSkillIds(
  raw: unknown,
  skills: SkillCollection,
): (SkillId | null)[] {
  const slots: (SkillId | null)[] = [null, null, null];
  if (!Array.isArray(raw)) {
    return ['missile_barrage', 'repair_drone', null];
  }
  const seen = new Set<SkillId>();
  for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
    const mapped = mapSkillId(raw[i]);
    if (mapped && skills[mapped]?.unlocked && !seen.has(mapped)) {
      slots[i] = mapped;
      seen.add(mapped);
    }
  }
  return slots;
}

function sanitizeAutoForge(raw: unknown): AutoForgeSettings {
  const base = { ...DEFAULT_AUTO_FORGE_SETTINGS };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<AutoForgeSettings>;
  return {
    enabled: Boolean(obj.enabled),
    targetRarity:
      obj.targetRarity && obj.targetRarity in EQUIPMENT_RARITY_META
        ? obj.targetRarity
        : base.targetRarity,
    tierId:
      obj.tierId === 'standard' || obj.tierId === 'tactical' || obj.tierId === 'prototype'
        ? obj.tierId
        : base.tierId,
    autoSalvageLower: Boolean(obj.autoSalvageLower),
  };
}

function sanitizeDungeonProgress(raw: unknown): DungeonProgressMap {
  const base = createDefaultDungeonProgress();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const id of DUNGEON_ORDER) {
    const entry = obj[id] as
      | { highestClearedStage?: unknown; clears?: unknown; bossClears?: unknown }
      | undefined;
    if (entry && typeof entry === 'object') {
      const clears =
        typeof entry.clears === 'number' && Number.isFinite(entry.clears) && entry.clears >= 0
          ? Math.floor(entry.clears)
          : 0;
      const highestClearedStage =
        typeof entry.highestClearedStage === 'number' &&
        Number.isFinite(entry.highestClearedStage)
          ? Math.max(0, Math.min(MAX_DUNGEON_STAGE, Math.floor(entry.highestClearedStage)))
          : clears > 0
            ? Math.min(MAX_DUNGEON_STAGE, clears)
            : 0;
      const bossClears =
        typeof entry.bossClears === 'number' &&
        Number.isFinite(entry.bossClears) &&
        entry.bossClears >= 0
          ? Math.floor(entry.bossClears)
          : clears;
      base[id] = {
        highestClearedStage,
        clears,
        bossClears,
      };
    }
  }
  return base;
}

function sanitizeDungeonEntries(raw: unknown): DailyDungeonEntries {
  const base = createDefaultDailyDungeonEntries();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<DailyDungeonEntries>;
  const lastResetDate =
    typeof obj.lastResetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.lastResetDate)
      ? obj.lastResetDate
      : getLocalDateKey();
  const remaining =
    typeof obj.remaining === 'number' && Number.isFinite(obj.remaining)
      ? Math.max(0, Math.min(DAILY_DUNGEON_ENTRIES, Math.floor(obj.remaining)))
      : DAILY_DUNGEON_ENTRIES;
  return refreshDailyDungeonEntries({
    remaining,
    max: DAILY_DUNGEON_ENTRIES,
    lastResetDate,
  });
}

function sanitizeMissionList(
  rawList: unknown,
  pool: typeof DAILY_MISSION_POOL,
): MissionItem[] | null {
  if (!Array.isArray(rawList) || rawList.length === 0) return null;
  const result: MissionItem[] = [];
  for (const rawItem of rawList) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const candidate = rawItem as Partial<MissionItem>;
    const def = pool.find((p) => p.id === candidate.id);
    if (!def) continue;
    const progress =
      typeof candidate.progress === 'number' && Number.isFinite(candidate.progress)
        ? Math.max(0, Math.min(def.target, Math.floor(candidate.progress)))
        : 0;
    result.push({
      id: def.id,
      objective: def.objective,
      title: def.title,
      description: def.description,
      target: def.target,
      progress,
      claimed: Boolean(candidate.claimed),
      rewards: def.rewards,
    });
  }
  return result.length === 5 ? result : null;
}

function sanitizeDailyMissions(raw: unknown): DailyMissionsState {
  const today = getLocalDateKey();
  const base = generateDailyMissions(today);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<DailyMissionsState>;
  const dateKey =
    typeof obj.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.dateKey)
      ? obj.dateKey
      : today;
  const sanitized = sanitizeMissionList(obj.missions, DAILY_MISSION_POOL);
  if (!sanitized) return base;
  return refreshDailyMissions({ dateKey, missions: sanitized });
}

function sanitizeWeeklyMissions(raw: unknown): WeeklyMissionsState {
  const thisWeek = getWeekStartDateKey();
  const base = generateWeeklyMissions(thisWeek);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<WeeklyMissionsState>;
  const weekStartDate =
    typeof obj.weekStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.weekStartDate)
      ? obj.weekStartDate
      : thisWeek;
  const sanitized = sanitizeMissionList(obj.missions, WEEKLY_MISSION_POOL);
  if (!sanitized) return base;
  return refreshWeeklyMissions({ weekStartDate, missions: sanitized });
}

function sanitizeLoginCalendar(raw: unknown): LoginCalendarState {
  const base = createDefaultLoginCalendar();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<LoginCalendarState>;
  const claimedDays =
    typeof obj.claimedDays === 'number' && Number.isFinite(obj.claimedDays)
      ? Math.max(0, Math.min(7, Math.floor(obj.claimedDays)))
      : 0;
  const lastClaimDate =
    typeof obj.lastClaimDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.lastClaimDate)
      ? obj.lastClaimDate
      : null;
  return { claimedDays, lastClaimDate };
}

function sanitizeLifetimeStats(
  raw: unknown,
  totalKills: number,
  dungeonProgress: DungeonProgressMap,
): LifetimeStats {
  const base = createDefaultLifetimeStats();
  const dungeonClears = Object.values(dungeonProgress).reduce((acc, p) => acc + p.clears, 0);
  const dungeonBossClears = Object.values(dungeonProgress).reduce(
    (acc, p) => acc + p.bossClears,
    0,
  );
  if (!raw || typeof raw !== 'object') {
    return {
      ...base,
      enemiesDefeated: totalKills,
      dungeonsCompleted: dungeonClears,
      dungeonBossesDefeated: dungeonBossClears,
      bossesDefeated: dungeonBossClears,
    };
  }
  const obj = raw as Partial<LifetimeStats>;
  const intOr = (v: unknown, def = 0) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
  return {
    enemiesDefeated: Math.max(totalKills, intOr(obj.enemiesDefeated, totalKills)),
    bossesDefeated: Math.max(dungeonBossClears, intOr(obj.bossesDefeated, 0)),
    dungeonBossesDefeated: Math.max(dungeonBossClears, intOr(obj.dungeonBossesDefeated, 0)),
    dungeonsCompleted: Math.max(dungeonClears, intOr(obj.dungeonsCompleted, 0)),
    itemsForged: intOr(obj.itemsForged, 0),
    equipmentUpgraded: intOr(obj.equipmentUpgraded, 0),
    skillsActivated: intOr(obj.skillsActivated, 0),
    skillsUpgraded: intOr(obj.skillsUpgraded, 0),
    scrapCollected: intOr(obj.scrapCollected, 0),
    prototypeObtained: Boolean(obj.prototypeObtained),
  };
}

export function loadSaveData(): SaveData {
  const fallback = createDefaultSaveData();
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }

    const stage =
      typeof parsed.stage === 'number' && Number.isFinite(parsed.stage) && parsed.stage >= 1
        ? Math.floor(parsed.stage)
        : 1;

    const highestStage =
      typeof parsed.highestStage === 'number' &&
      Number.isFinite(parsed.highestStage) &&
      parsed.highestStage >= stage
        ? Math.floor(parsed.highestStage)
        : stage;

    const totalKills =
      typeof parsed.totalKills === 'number' &&
      Number.isFinite(parsed.totalKills) &&
      parsed.totalKills >= 0
        ? Math.floor(parsed.totalKills)
        : 0;

    const nonNegInt = (val: unknown, def: number) =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 ? Math.floor(val) : def;

    const wallet = {
      scrap: nonNegInt(parsed.wallet?.scrap, fallback.wallet.scrap),
      forgeCores: nonNegInt(parsed.wallet?.forgeCores, fallback.wallet.forgeCores),
      skillTech: nonNegInt(parsed.wallet?.skillTech, fallback.wallet.skillTech),
      alloyPlates: nonNegInt(parsed.wallet?.alloyPlates, fallback.wallet.alloyPlates),
    };

    const chests: ChestInventory = {
      standard: nonNegInt(parsed.chests?.standard, DEFAULT_CHEST_INVENTORY.standard),
      advanced: nonNegInt(parsed.chests?.advanced, DEFAULT_CHEST_INVENTORY.advanced),
      elite: nonNegInt(parsed.chests?.elite, DEFAULT_CHEST_INVENTORY.elite),
    };

    const tankLevel =
      typeof parsed.tankLevel === 'number' &&
      Number.isFinite(parsed.tankLevel) &&
      parsed.tankLevel >= 1
        ? Math.floor(parsed.tankLevel)
        : 1;

    const tankXp = nonNegInt(parsed.tankXp, 0);
    const equippedGear = sanitizeEquippedGear(parsed.equippedGear);
    const equipmentInventory = Array.isArray(parsed.equipmentInventory)
      ? parsed.equipmentInventory.filter(isValidEquipmentItem).slice(0, MAX_EQUIPMENT_INVENTORY + 8)
      : [];
    const skills = sanitizeSkills(parsed.skills);
    const equippedSkillIds = sanitizeEquippedSkillIds(parsed.equippedSkillIds, skills);
    const dungeonProgress = sanitizeDungeonProgress(parsed.dungeonProgress);

    const validAchIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    const claimedAchievements = Array.isArray(parsed.claimedAchievements)
      ? Array.from(
          new Set(
            parsed.claimedAchievements.filter(
              (id): id is string => typeof id === 'string' && validAchIds.has(id),
            ),
          ),
        )
      : [];

    const validMilestoneLevels = new Set(TANK_MILESTONES.map((m) => m.level));
    const claimedMilestones = Array.isArray(parsed.claimedMilestones)
      ? Array.from(
          new Set(
            parsed.claimedMilestones.filter(
              (lvl): lvl is number => typeof lvl === 'number' && validMilestoneLevels.has(lvl),
            ),
          ),
        ).sort((a, b) => a - b)
      : [];

    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
    const lastActiveAt =
      typeof parsed.lastActiveAt === 'number' && Number.isFinite(parsed.lastActiveAt)
        ? parsed.lastActiveAt
        : savedAt;

    return {
      version: SAVE_VERSION,
      wallet,
      chests,
      upgradeLevels: sanitizeUpgradeLevels(parsed.upgradeLevels),
      tankLevel,
      tankXp,
      equippedGear,
      equipmentInventory,
      skills,
      equippedSkillIds,
      autoSkillsEnabled:
        typeof parsed.autoSkillsEnabled === 'boolean' ? parsed.autoSkillsEnabled : true,
      autoForge: sanitizeAutoForge(parsed.autoForge),
      dungeonProgress,
      dungeonEntries: sanitizeDungeonEntries(parsed.dungeonEntries),
      dailyMissions: sanitizeDailyMissions(parsed.dailyMissions),
      weeklyMissions: sanitizeWeeklyMissions(parsed.weeklyMissions),
      loginCalendar: sanitizeLoginCalendar(parsed.loginCalendar),
      claimedAchievements,
      claimedMilestones,
      lifetimeStats: sanitizeLifetimeStats(parsed.lifetimeStats, totalKills, dungeonProgress),
      apexSkinEnabled:
        typeof parsed.apexSkinEnabled === 'boolean' ? parsed.apexSkinEnabled : true,
      lastActiveAt,
      stage,
      highestStage,
      totalKills,
      muted: Boolean(parsed.muted),
      savedAt,
    };
  } catch {
    return fallback;
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const now = Date.now();
    const payload: SaveData = {
      ...data,
      version: SAVE_VERSION,
      lastActiveAt: now,
      savedAt: now,
    };
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage restriction errors gracefully
  }
}

export function clearSaveData(): SaveData {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SAVE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors
  }
  return createDefaultSaveData();
}
