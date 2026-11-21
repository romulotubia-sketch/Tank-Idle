import type {
  AchievementCategory,
  AchievementDefinition,
  AutoForgeSettings,
  ChestInventory,
  ChestTierId,
  DailyDungeonEntries,
  DungeonConfig,
  DungeonId,
  DungeonProgressMap,
  EliteVariantId,
  EnemyArchetypeConfig,
  EnemyArchetypeId,
  EquipmentPassiveId,
  EquipmentRarity,
  EquipmentSlot,
  EquippedGearMap,
  ForgeTierConfig,
  ForgeTierId,
  LifetimeStats,
  LoginCalendarState,
  LoginRewardDay,
  MissionDefinition,
  SkillCollection,
  SkillDefinition,
  SkillId,
  SkillRarity,
  StageTheme,
  TankMilestoneDefinition,
  UpgradeDefinition,
  UpgradeKey,
  UpgradeLevels,
} from './types';

export const SAVE_STORAGE_KEY = 'ironclad_vanguard_save_v1';
export const SAVE_VERSION = 2;

export const WORLD_WIDTH = 900;
export const WORLD_HEIGHT = 640;

export const WAVES_PER_STAGE = 3;
export const BOSS_STAGE_INTERVAL = 5;
export const AUTO_FORGE_UNLOCK_LEVEL = 25;
export const MAX_EQUIPMENT_INVENTORY = 24;
export const MAX_EQUIPPED_SKILLS = 3;

export const DEFAULT_UPGRADE_LEVELS: UpgradeLevels = {
  maxHp: 1,
  attackDamage: 1,
  attackSpeed: 1,
  armor: 1,
  critChance: 1,
  critDamage: 1,
};

export const UPGRADE_ORDER: UpgradeKey[] = [
  'maxHp',
  'attackDamage',
  'attackSpeed',
  'armor',
  'critChance',
  'critDamage',
];

export const UPGRADE_DEFINITIONS: Record<UpgradeKey, UpgradeDefinition> = {
  maxHp: {
    key: 'maxHp',
    label: 'Chassis Hull',
    shortLabel: 'MAX HP',
    description: 'Reinforces composite plating to increase maximum hull integrity.',
    baseValue: 220,
    incrementPerLevel: 45,
    baseCost: 18,
    costMultiplier: 1.24,
    maxLevel: null,
    unit: 'HP',
    formatValue: (v) => `${Math.round(v)}`,
    formatDelta: (d) => `+${Math.round(d)} HP`,
  },
  attackDamage: {
    key: 'attackDamage',
    label: 'Main Cannon',
    shortLabel: 'ATK DMG',
    description: 'Upgrades propellant charge and shell caliber for higher damage.',
    baseValue: 28,
    incrementPerLevel: 7,
    baseCost: 20,
    costMultiplier: 1.26,
    maxLevel: null,
    unit: 'DMG',
    formatValue: (v) => `${Math.round(v)}`,
    formatDelta: (d) => `+${Math.round(d)} DMG`,
  },
  attackSpeed: {
    key: 'attackSpeed',
    label: 'Autoloader',
    shortLabel: 'ATK SPD',
    description: 'Accelerates breech cycling for faster turret fire rate.',
    baseValue: 1.15,
    incrementPerLevel: 0.08,
    baseCost: 24,
    costMultiplier: 1.3,
    maxLevel: 60,
    unit: '/s',
    formatValue: (v) => `${v.toFixed(2)}/s`,
    formatDelta: (d) => `+${d.toFixed(2)}/s`,
  },
  armor: {
    key: 'armor',
    label: 'Reactive Armor',
    shortLabel: 'ARMOR',
    description: 'Absorbs incoming kinetic impact and reduces enemy shell damage.',
    baseValue: 4,
    incrementPerLevel: 2.5,
    baseCost: 22,
    costMultiplier: 1.25,
    maxLevel: null,
    unit: 'ARM',
    formatValue: (v) => `${Math.round(v)}`,
    formatDelta: (d) => `+${d.toFixed(1)} ARM`,
  },
  critChance: {
    key: 'critChance',
    label: 'Ballistic Optics',
    shortLabel: 'CRIT %',
    description: 'Improves weak-spot targeting precision for critical strikes.',
    baseValue: 0.08,
    incrementPerLevel: 0.015,
    baseCost: 28,
    costMultiplier: 1.32,
    maxLevel: 45,
    unit: '%',
    formatValue: (v) => `${(v * 100).toFixed(1)}%`,
    formatDelta: (d) => `+${(d * 100).toFixed(1)}%`,
  },
  critDamage: {
    key: 'critDamage',
    label: 'APFSDS Sabot',
    shortLabel: 'CRIT DMG',
    description: 'Increases armor-piercing multiplier on critical hits.',
    baseValue: 1.65,
    incrementPerLevel: 0.12,
    baseCost: 30,
    costMultiplier: 1.28,
    maxLevel: null,
    unit: '%',
    formatValue: (v) => `${Math.round(v * 100)}%`,
    formatDelta: (d) => `+${Math.round(d * 100)}%`,
  },
};

// ---------------- TANK LEVEL & XP ----------------

export function getXpForNextLevel(level: number): number {
  const lvl = Math.max(1, level);
  return Math.round(55 * Math.pow(1.13, lvl - 1) + lvl * 12);
}

// ---------------- EQUIPMENT & FORGE CONFIG ----------------

export const EQUIPMENT_SLOTS: {
  id: EquipmentSlot;
  label: string;
  primaryStat: 'attackDamage' | 'attackSpeed' | 'maxHp' | 'armor' | 'critChance' | 'critDamage';
  names: string[];
}[] = [
  {
    id: 'cannon',
    label: 'Main Barrel',
    primaryStat: 'attackDamage',
    names: ['Smoothbore Cannon', 'Rifled Howitzer', 'Rail-Assisted Barrel', 'Heavy Siege Gun'],
  },
  {
    id: 'turret',
    label: 'Turret Gyro',
    primaryStat: 'attackSpeed',
    names: ['Breech Autoloader', 'Servo Turret Ring', 'Twin-Feed Carousel', 'Hyper-Cycle Drum'],
  },
  {
    id: 'hull',
    label: 'Chassis Frame',
    primaryStat: 'maxHp',
    names: ['Welded Steel Hull', 'Composite Monocoque', 'Reinforced Subframe', 'Titanium Bulkhead'],
  },
  {
    id: 'armor',
    label: 'Armor Skirt',
    primaryStat: 'armor',
    names: ['Sloped Glacis Plate', 'ERA Brick Array', 'Chobham Matrix', 'Kinetic Reactive Shield'],
  },
  {
    id: 'optics',
    label: 'Fire Optics',
    primaryStat: 'critChance',
    names: ['Laser Rangefinder', 'Thermal Ballistic Sight', 'Predictive FCS', 'Quantum Targeter'],
  },
  {
    id: 'treads',
    label: 'Drive Assembly',
    primaryStat: 'critDamage',
    names: ['Torsion Track Links', 'High-Torque Sprocket', 'Stabilized Bogie', 'Overdrive Powerpack'],
  },
];

export const EQUIPMENT_RARITY_ORDER: EquipmentRarity[] = [
  'scrap',
  'reinforced',
  'military',
  'advanced',
  'elite',
  'prototype',
];

export const EQUIPMENT_RARITY_META: Record<
  EquipmentRarity,
  {
    label: string;
    rank: number;
    multiplier: number;
    color: string;
    borderClass: string;
    bgClass: string;
    textClass: string;
    glowClass: string;
    salvageScrap: number;
    salvageAlloys: number;
    passiveChance: number;
  }
> = {
  scrap: {
    label: 'Scrap',
    rank: 1,
    multiplier: 1.0,
    color: '#9ca3af',
    borderClass: 'border-zinc-600/80',
    bgClass: 'bg-zinc-900/75',
    textClass: 'text-zinc-300',
    glowClass: '',
    salvageScrap: 12,
    salvageAlloys: 1,
    passiveChance: 0,
  },
  reinforced: {
    label: 'Reinforced',
    rank: 2,
    multiplier: 1.55,
    color: '#4ade80',
    borderClass: 'border-emerald-700/80',
    bgClass: 'bg-emerald-950/35',
    textClass: 'text-emerald-300',
    glowClass: '',
    salvageScrap: 25,
    salvageAlloys: 2,
    passiveChance: 0.25,
  },
  military: {
    label: 'Military',
    rank: 3,
    multiplier: 2.3,
    color: '#60a5fa',
    borderClass: 'border-sky-700/80',
    bgClass: 'bg-sky-950/35',
    textClass: 'text-sky-300',
    glowClass: '',
    salvageScrap: 55,
    salvageAlloys: 4,
    passiveChance: 0.55,
  },
  advanced: {
    label: 'Advanced',
    rank: 4,
    multiplier: 3.4,
    color: '#c084fc',
    borderClass: 'border-purple-700/80',
    bgClass: 'bg-purple-950/35',
    textClass: 'text-purple-300',
    glowClass: '',
    salvageScrap: 110,
    salvageAlloys: 8,
    passiveChance: 0.85,
  },
  elite: {
    label: 'Elite',
    rank: 5,
    multiplier: 5.1,
    color: '#fb923c',
    borderClass: 'border-orange-700/85',
    bgClass: 'bg-orange-950/35',
    textClass: 'text-orange-300',
    glowClass: '',
    salvageScrap: 220,
    salvageAlloys: 15,
    passiveChance: 1.0,
  },
  prototype: {
    label: 'Prototype',
    rank: 6,
    multiplier: 7.8,
    color: '#facc15',
    borderClass: 'border-amber-500/85',
    bgClass: 'bg-amber-950/40',
    textClass: 'text-amber-300',
    glowClass: '',
    salvageScrap: 450,
    salvageAlloys: 30,
    passiveChance: 1.0,
  },
};

export const EQUIPMENT_PASSIVE_POOL: {
  id: EquipmentPassiveId;
  label: string;
  baseValue: number;
  perRank: number;
  formatDesc: (val: number) => string;
}[] = [
  {
    id: 'vampiric_shells',
    label: 'Salvage Siphon',
    baseValue: 0.012,
    perRank: 0.005,
    formatDesc: (v) => `Restores ${(v * 100).toFixed(1)}% Max HP on enemy kill`,
  },
  {
    id: 'piercing_rounds',
    label: 'Depleted Sabot',
    baseValue: 0.1,
    perRank: 0.05,
    formatDesc: (v) => `Ignores ${Math.round(v * 100)}% of enemy armor`,
  },
  {
    id: 'blast_splash',
    label: 'HE Fragmentation',
    baseValue: 0.12,
    perRank: 0.05,
    formatDesc: (v) => `Deals ${Math.round(v * 100)}% splash damage near impact`,
  },
  {
    id: 'cooldown_haste',
    label: 'Tactical Capacitor',
    baseValue: 0.06,
    perRank: 0.03,
    formatDesc: (v) => `Accelerates skill cooldowns by ${Math.round(v * 100)}%`,
  },
  {
    id: 'scrap_magnet',
    label: 'Recovery Magnet',
    baseValue: 0.08,
    perRank: 0.04,
    formatDesc: (v) => `+${Math.round(v * 100)}% bonus Scrap from defeated enemies`,
  },
];

export const FORGE_TIERS: Record<ForgeTierId, ForgeTierConfig> = {
  standard: {
    id: 'standard',
    name: 'Field Forge',
    description: 'Low-cost fabrication suited for early gear and salvage parts.',
    scrapCost: 35,
    coreCost: 2,
    rarityWeights: {
      scrap: 48,
      reinforced: 30,
      military: 15,
      advanced: 5.5,
      elite: 1.3,
      prototype: 0.2,
    },
  },
  tactical: {
    id: 'tactical',
    name: 'Tactical Foundry',
    description: 'Balanced core infusion for Military and Advanced components.',
    scrapCost: 110,
    coreCost: 6,
    rarityWeights: {
      scrap: 14,
      reinforced: 32,
      military: 31,
      advanced: 16,
      elite: 5.8,
      prototype: 1.2,
    },
  },
  prototype: {
    id: 'prototype',
    name: 'Prototype Crucible',
    description: 'High-energy forging with elevated Elite and Prototype yields.',
    scrapCost: 280,
    coreCost: 15,
    rarityWeights: {
      scrap: 0,
      reinforced: 12,
      military: 34,
      advanced: 31,
      elite: 17,
      prototype: 6,
    },
  },
};

export const DEFAULT_EQUIPPED_GEAR: EquippedGearMap = {
  cannon: null,
  turret: null,
  hull: null,
  armor: null,
  optics: null,
  treads: null,
};

export const DEFAULT_AUTO_FORGE_SETTINGS: AutoForgeSettings = {
  enabled: false,
  targetRarity: 'military',
  tierId: 'standard',
  autoSalvageLower: false,
};

// ---------------- TANK SKILLS & CHESTS ----------------

export const MAX_SKILL_LEVEL = 10;

// Duplicates required to upgrade from level (index + 1) to level (index + 2)
export const SKILL_DUPLICATE_COSTS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 10];

export const SKILL_ORDER: SkillId[] = [
  'missile_barrage',
  'artillery_strike',
  'mine_deployment',
  'railgun_shot',
  'repair_drone',
  'emp_pulse',
  'overdrive',
  'rocket_salvo',
];

export const SKILL_RARITY_META: Record<
  SkillRarity,
  { label: string; textClass: string; borderClass: string; bgClass: string; color: string }
> = {
  common: {
    label: 'Standard',
    textClass: 'text-zinc-300',
    borderClass: 'border-zinc-600/80',
    bgClass: 'bg-zinc-900/75',
    color: '#a1a1aa',
  },
  rare: {
    label: 'Tactical',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-700/80',
    bgClass: 'bg-sky-950/35',
    color: '#38bdf8',
  },
  epic: {
    label: 'Heavy Ops',
    textClass: 'text-purple-300',
    borderClass: 'border-purple-700/80',
    bgClass: 'bg-purple-950/35',
    color: '#c084fc',
  },
  legendary: {
    label: 'Prototype',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-600/85',
    bgClass: 'bg-amber-950/35',
    color: '#f59e0b',
  },
};

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  missile_barrage: {
    id: 'missile_barrage',
    name: 'Missile Barrage',
    rarity: 'common',
    description: 'Launches multiple homing missiles that auto-lock onto nearby enemy tanks.',
    cooldown: 7.5,
    unlockTechCost: 15,
    basePower: 1.35,
    powerPerLevel: 0.22,
    accentColor: '#f59e0b',
  },
  artillery_strike: {
    id: 'artillery_strike',
    name: 'Artillery Strike',
    rarity: 'epic',
    description: 'Calls down heavy howitzer bombardment on clustered enemy zones for area damage.',
    cooldown: 11.5,
    unlockTechCost: 40,
    basePower: 2.45,
    powerPerLevel: 0.34,
    accentColor: '#fb923c',
  },
  mine_deployment: {
    id: 'mine_deployment',
    name: 'Mine Deployment',
    rarity: 'rare',
    description: 'Deploys explosive proximity mines around the tank that detonate on enemy approach.',
    cooldown: 11,
    unlockTechCost: 25,
    basePower: 2.0,
    powerPerLevel: 0.3,
    duration: 14,
    accentColor: '#f43f5e',
  },
  railgun_shot: {
    id: 'railgun_shot',
    name: 'Railgun Shot',
    rarity: 'legendary',
    description: 'Fires a high-velocity piercing energy beam that penetrates multiple enemies in line.',
    cooldown: 10.5,
    unlockTechCost: 60,
    basePower: 2.65,
    powerPerLevel: 0.38,
    accentColor: '#a855f7',
  },
  repair_drone: {
    id: 'repair_drone',
    name: 'Repair Drone',
    rarity: 'common',
    description: 'Deploys an autonomous support drone that restores hull integrity over its duration.',
    cooldown: 11,
    unlockTechCost: 15,
    basePower: 0.24,
    powerPerLevel: 0.04,
    duration: 5.0,
    accentColor: '#10b981',
  },
  emp_pulse: {
    id: 'emp_pulse',
    name: 'EMP Pulse',
    rarity: 'rare',
    description: 'Emits an electromagnetic wave around the tank, stunning and damaging nearby enemies.',
    cooldown: 10,
    unlockTechCost: 25,
    basePower: 1.45,
    powerPerLevel: 0.24,
    duration: 2.2,
    accentColor: '#38bdf8',
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    rarity: 'epic',
    description: 'Supercharges engine and autoloader to boost both attack speed and movement speed.',
    cooldown: 12.5,
    unlockTechCost: 40,
    basePower: 0.55,
    powerPerLevel: 0.08,
    duration: 5.0,
    accentColor: '#eab308',
  },
  rocket_salvo: {
    id: 'rocket_salvo',
    name: 'Rocket Salvo',
    rarity: 'epic',
    description: 'Fires a staggered sequence of high-explosive rockets dealing area splash damage.',
    cooldown: 9.5,
    unlockTechCost: 40,
    basePower: 1.25,
    powerPerLevel: 0.2,
    accentColor: '#ec4899',
  },
};

export function createDefaultSkills(): SkillCollection {
  return {
    missile_barrage: { id: 'missile_barrage', unlocked: true, level: 1, duplicates: 0 },
    repair_drone: { id: 'repair_drone', unlocked: true, level: 1, duplicates: 0 },
    mine_deployment: { id: 'mine_deployment', unlocked: false, level: 1, duplicates: 0 },
    emp_pulse: { id: 'emp_pulse', unlocked: false, level: 1, duplicates: 0 },
    artillery_strike: { id: 'artillery_strike', unlocked: false, level: 1, duplicates: 0 },
    rocket_salvo: { id: 'rocket_salvo', unlocked: false, level: 1, duplicates: 0 },
    overdrive: { id: 'overdrive', unlocked: false, level: 1, duplicates: 0 },
    railgun_shot: { id: 'railgun_shot', unlocked: false, level: 1, duplicates: 0 },
  };
}

export const CHEST_CONFIGS: Record<
  ChestTierId,
  {
    id: ChestTierId;
    name: string;
    description: string;
    rarityWeights: Record<SkillRarity, number>;
    bonusTechMin: number;
    bonusTechMax: number;
    duplicatesPerDrop: number;
    accentColor: string;
  }
> = {
  standard: {
    id: 'standard',
    name: 'Standard Skill Chest',
    description: 'Field supply crate containing tank skills or duplicate upgrade modules.',
    rarityWeights: { common: 52, rare: 32, epic: 13, legendary: 3 },
    bonusTechMin: 6,
    bonusTechMax: 12,
    duplicatesPerDrop: 1,
    accentColor: '#94a3b8',
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced Skill Chest',
    description: 'Armored munitions crate with elevated Tactical and Heavy Ops skill odds.',
    rarityWeights: { common: 22, rare: 40, epic: 29, legendary: 9 },
    bonusTechMin: 14,
    bonusTechMax: 24,
    duplicatesPerDrop: 1,
    accentColor: '#38bdf8',
  },
  elite: {
    id: 'elite',
    name: 'Elite Skill Chest',
    description: 'Classified command crate guaranteed Tactical+ with high Prototype odds.',
    rarityWeights: { common: 0, rare: 34, epic: 44, legendary: 22 },
    bonusTechMin: 28,
    bonusTechMax: 45,
    duplicatesPerDrop: 1,
    accentColor: '#f59e0b',
  },
};

export const DEFAULT_CHEST_INVENTORY: ChestInventory = {
  standard: 1,
  advanced: 0,
  elite: 0,
};

// ---------------- DUNGEONS CONFIG ----------------

export const DAILY_DUNGEON_ENTRIES = 5;
export const MAX_DUNGEON_STAGE = 10;

export function getLocalDateKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultDailyDungeonEntries(
  nowMs: number = Date.now(),
): DailyDungeonEntries {
  return {
    remaining: DAILY_DUNGEON_ENTRIES,
    max: DAILY_DUNGEON_ENTRIES,
    lastResetDate: getLocalDateKey(nowMs),
  };
}

export const DUNGEON_ORDER: DungeonId[] = [
  'salvage_yard',
  'arsenal_depot',
  'armored_stronghold',
  'experimental_grounds',
];

export const DUNGEON_CONFIGS: Record<DungeonId, DungeonConfig> = {
  salvage_yard: {
    id: 'salvage_yard',
    name: 'Salvage Yard',
    subtitle: 'Industrial Scrapyard Sector',
    purpose: 'Scrap farming with rare equipment salvage opportunities.',
    maxStages: MAX_DUNGEON_STAGE,
    baseRecommendedPower: 110,
    bossName: 'Scrap Titan',
    finalBossName: 'Scrap Titan · Apex Dredger',
    difficultyScale: 1.0,
    mainRewardType: 'Scrap',
    primaryRewardLabel: 'Scrap Hoard',
    secondaryRewardLabel: 'Equipment Drop Chance',
    bossBonusLabel: 'Bonus Scrap on Boss Clear',
    enemies: [
      {
        name: 'Scrap Scavenger',
        roleLabel: 'Fast Raider',
        archetype: 'light',
        ability: 'none',
        hpMult: 0.9,
        damageMult: 0.92,
        armorMult: 0.8,
        speedMult: 1.15,
        radius: 17,
        hullColor: '#6b4f35',
        hullAccent: '#d97706',
        turretColor: '#7c5d3f',
      },
      {
        name: 'Rust Tank',
        roleLabel: 'Scrap Bruiser',
        archetype: 'medium',
        ability: 'none',
        hpMult: 1.05,
        damageMult: 1.0,
        armorMult: 1.0,
        speedMult: 0.96,
        radius: 21,
        hullColor: '#6d3927',
        hullAccent: '#c2410c',
        turretColor: '#824630',
      },
      {
        name: 'Salvage Hauler',
        roleLabel: 'Armored Carrier',
        archetype: 'assault',
        ability: 'none',
        hpMult: 1.18,
        damageMult: 1.08,
        armorMult: 1.1,
        speedMult: 1.04,
        radius: 22,
        hullColor: '#5c5338',
        hullAccent: '#ca8a04',
        turretColor: '#706546',
      },
      {
        name: 'Scrap Crusher',
        roleLabel: 'Heavy Shredder',
        archetype: 'heavy',
        ability: 'none',
        hpMult: 1.35,
        damageMult: 1.18,
        armorMult: 1.25,
        speedMult: 0.88,
        radius: 26,
        hullColor: '#4e2c21',
        hullAccent: '#ea580c',
        turretColor: '#63382a',
      },
    ],
    bossSpec: {
      name: 'Scrap Titan',
      roleLabel: 'Yard Juggernaut',
      archetype: 'boss',
      ability: 'none',
      hpMult: 1.0,
      damageMult: 0.95,
      armorMult: 1.0,
      speedMult: 1.0,
      radius: 38,
      hullColor: '#4a2e1d',
      hullAccent: '#d97706',
      turretColor: '#7c2d12',
    },
    finalBossSpec: {
      name: 'Scrap Titan · Apex Dredger',
      roleLabel: 'Stage 10 Overlord',
      archetype: 'boss',
      ability: 'shield',
      hpMult: 1.45,
      damageMult: 1.25,
      armorMult: 1.3,
      speedMult: 1.1,
      radius: 42,
      hullColor: '#3f2317',
      hullAccent: '#eab308',
      turretColor: '#991b1b',
    },
    theme: {
      id: 'dungeon-salvage',
      name: 'Dungeon · Salvage Yard',
      groundBase: '#1f1915',
      groundAccent: '#28201b',
      gridColor: 'rgba(180, 115, 70, 0.12)',
      borderHazard: '#c2410c',
    },
  },
  arsenal_depot: {
    id: 'arsenal_depot',
    name: 'Arsenal Depot',
    subtitle: 'Fortified Munitions Facility',
    purpose: 'Forge Core farming with Scrap and equipment drops.',
    maxStages: MAX_DUNGEON_STAGE,
    baseRecommendedPower: 165,
    bossName: 'Arsenal Commander',
    finalBossName: 'Arsenal Commander · Warlord',
    difficultyScale: 1.35,
    mainRewardType: 'Forge Cores',
    primaryRewardLabel: 'Forge Cores',
    secondaryRewardLabel: 'Scrap & Gear Chance',
    bossBonusLabel: 'Bonus Forge Cores on Boss Clear',
    enemies: [
      {
        name: 'Assault Tank',
        roleLabel: 'Vanguard Striker',
        archetype: 'assault',
        ability: 'none',
        hpMult: 0.96,
        damageMult: 1.08,
        armorMult: 0.95,
        speedMult: 1.08,
        radius: 21,
        hullColor: '#692c32',
        hullAccent: '#dc2626',
        turretColor: '#7f363d',
      },
      {
        name: 'Missile Carrier',
        roleLabel: 'Salvo Launcher',
        archetype: 'medium',
        ability: 'surge',
        hpMult: 1.02,
        damageMult: 1.15,
        armorMult: 0.95,
        speedMult: 1.0,
        radius: 22,
        hullColor: '#384659',
        hullAccent: '#64748b',
        turretColor: '#47586e',
      },
      {
        name: 'Artillery Tank',
        roleLabel: 'Long-Range Siege',
        archetype: 'heavy',
        ability: 'none',
        hpMult: 1.16,
        damageMult: 1.24,
        armorMult: 1.1,
        speedMult: 0.85,
        radius: 25,
        hullColor: '#3a424d',
        hullAccent: '#94a3b8',
        turretColor: '#495361',
      },
      {
        name: 'Heavy Gunner',
        roleLabel: 'Suppression Armor',
        archetype: 'heavy',
        ability: 'none',
        hpMult: 1.32,
        damageMult: 1.16,
        armorMult: 1.25,
        speedMult: 0.92,
        radius: 26,
        hullColor: '#3a4a42',
        hullAccent: '#6b7280',
        turretColor: '#485c52',
      },
    ],
    bossSpec: {
      name: 'Arsenal Commander',
      roleLabel: 'Ordnance Warleader',
      archetype: 'boss',
      ability: 'none',
      hpMult: 1.08,
      damageMult: 1.05,
      armorMult: 1.05,
      speedMult: 1.0,
      radius: 38,
      hullColor: '#313a47',
      hullAccent: '#d97706',
      turretColor: '#9a3412',
    },
    finalBossSpec: {
      name: 'Arsenal Commander · Warlord',
      roleLabel: 'Stage 10 Overlord',
      archetype: 'boss',
      ability: 'plasma',
      hpMult: 1.5,
      damageMult: 1.3,
      armorMult: 1.3,
      speedMult: 1.08,
      radius: 42,
      hullColor: '#262b36',
      hullAccent: '#eab308',
      turretColor: '#7f1d1d',
    },
    theme: {
      id: 'dungeon-arsenal',
      name: 'Dungeon · Arsenal Depot',
      groundBase: '#161b22',
      groundAccent: '#1c232c',
      gridColor: 'rgba(148, 163, 184, 0.11)',
      borderHazard: '#d97706',
    },
  },
  armored_stronghold: {
    id: 'armored_stronghold',
    name: 'Armored Stronghold',
    subtitle: 'Heavy Bastion Fortress',
    purpose: 'Equipment Chest farming with higher rarity at higher stages.',
    maxStages: MAX_DUNGEON_STAGE,
    baseRecommendedPower: 230,
    bossName: 'Fortress Guardian',
    finalBossName: 'Fortress Guardian · Iron Bastion',
    difficultyScale: 1.72,
    mainRewardType: 'Equipment Chests',
    primaryRewardLabel: 'Equipment Chests',
    secondaryRewardLabel: 'Scrap & Forge Cores',
    bossBonusLabel: 'Higher Rarity Odds on Later Stages',
    enemies: [
      {
        name: 'Reinforced Tank',
        roleLabel: 'Composite Vanguard',
        archetype: 'medium',
        ability: 'none',
        hpMult: 1.15,
        damageMult: 1.0,
        armorMult: 1.35,
        speedMult: 0.94,
        radius: 22,
        hullColor: '#3f4456',
        hullAccent: '#818cf8',
        turretColor: '#4c5268',
      },
      {
        name: 'Siege Tank',
        roleLabel: 'Heavy Bombardier',
        archetype: 'heavy',
        ability: 'none',
        hpMult: 1.3,
        damageMult: 1.18,
        armorMult: 1.45,
        speedMult: 0.84,
        radius: 26,
        hullColor: '#423c54',
        hullAccent: '#a78bfa',
        turretColor: '#524b69',
      },
      {
        name: 'Shield Tank',
        roleLabel: 'Barrier Projector',
        archetype: 'heavy',
        ability: 'shield',
        hpMult: 1.36,
        damageMult: 1.02,
        armorMult: 1.5,
        speedMult: 0.88,
        radius: 27,
        hullColor: '#364552',
        hullAccent: '#60a5fa',
        turretColor: '#445766',
      },
      {
        name: 'Elite Defender',
        roleLabel: 'Bastion Warden',
        archetype: 'assault',
        ability: 'shield',
        hpMult: 1.28,
        damageMult: 1.16,
        armorMult: 1.4,
        speedMult: 1.0,
        radius: 24,
        hullColor: '#3b374a',
        hullAccent: '#d97706',
        turretColor: '#4f4963',
      },
    ],
    bossSpec: {
      name: 'Fortress Guardian',
      roleLabel: 'Aegis Dreadnought',
      archetype: 'boss',
      ability: 'shield',
      hpMult: 1.15,
      damageMult: 1.05,
      armorMult: 1.35,
      speedMult: 0.96,
      radius: 39,
      hullColor: '#312e3f',
      hullAccent: '#818cf8',
      turretColor: '#475569',
    },
    finalBossSpec: {
      name: 'Fortress Guardian · Iron Bastion',
      roleLabel: 'Stage 10 Overlord',
      archetype: 'boss',
      ability: 'shield',
      hpMult: 1.6,
      damageMult: 1.32,
      armorMult: 1.6,
      speedMult: 1.05,
      radius: 43,
      hullColor: '#272530',
      hullAccent: '#eab308',
      turretColor: '#3f3f46',
    },
    theme: {
      id: 'dungeon-stronghold',
      name: 'Dungeon · Armored Stronghold',
      groundBase: '#181820',
      groundAccent: '#1f1f29',
      gridColor: 'rgba(148, 163, 184, 0.1)',
      borderHazard: '#64748b',
    },
  },
  experimental_grounds: {
    id: 'experimental_grounds',
    name: 'Experimental Grounds',
    subtitle: 'Classified Proving Sector',
    purpose: 'Skill Chest farming with bonus chests on higher stages.',
    maxStages: MAX_DUNGEON_STAGE,
    baseRecommendedPower: 310,
    bossName: 'Experimental Colossus',
    finalBossName: 'Experimental Colossus · Omega Core',
    difficultyScale: 2.15,
    mainRewardType: 'Skill Chests',
    primaryRewardLabel: 'Skill Chests',
    secondaryRewardLabel: 'Scrap & Forge Cores',
    bossBonusLabel: 'Extra Skill Chest Chance on Later Stages',
    enemies: [
      {
        name: 'Prototype Drone',
        roleLabel: 'Surge Skirmisher',
        archetype: 'light',
        ability: 'surge',
        hpMult: 0.96,
        damageMult: 1.1,
        armorMult: 0.9,
        speedMult: 1.22,
        radius: 17,
        hullColor: '#2f454a',
        hullAccent: '#5eead4',
        turretColor: '#3b565c',
      },
      {
        name: 'Plasma Tank',
        roleLabel: 'Ion Striker',
        archetype: 'medium',
        ability: 'plasma',
        hpMult: 1.08,
        damageMult: 1.2,
        armorMult: 1.05,
        speedMult: 1.0,
        radius: 22,
        hullColor: '#4a3548',
        hullAccent: '#c084fc',
        turretColor: '#5c4259',
      },
      {
        name: 'Experimental Walker',
        roleLabel: 'Phase Interceptor',
        archetype: 'assault',
        ability: 'surge',
        hpMult: 1.18,
        damageMult: 1.22,
        armorMult: 1.1,
        speedMult: 1.12,
        radius: 23,
        hullColor: '#2e453e',
        hullAccent: '#6ee7b7',
        turretColor: '#3b574e',
      },
      {
        name: 'Overcharged Combat Unit',
        roleLabel: 'Apex Prototype',
        archetype: 'heavy',
        ability: 'plasma',
        hpMult: 1.35,
        damageMult: 1.28,
        armorMult: 1.25,
        speedMult: 0.95,
        radius: 26,
        hullColor: '#3f3545',
        hullAccent: '#d97706',
        turretColor: '#524459',
      },
    ],
    bossSpec: {
      name: 'Experimental Colossus',
      roleLabel: 'Reactor Leviathan',
      archetype: 'boss',
      ability: 'plasma',
      hpMult: 1.18,
      damageMult: 1.12,
      armorMult: 1.15,
      speedMult: 1.04,
      radius: 39,
      hullColor: '#28383d',
      hullAccent: '#2dd4bf',
      turretColor: '#52525b',
    },
    finalBossSpec: {
      name: 'Experimental Colossus · Omega Core',
      roleLabel: 'Stage 10 Overlord',
      archetype: 'boss',
      ability: 'plasma',
      hpMult: 1.65,
      damageMult: 1.38,
      armorMult: 1.4,
      speedMult: 1.12,
      radius: 44,
      hullColor: '#27272a',
      hullAccent: '#eab308',
      turretColor: '#3f3f46',
    },
    theme: {
      id: 'dungeon-experimental',
      name: 'Dungeon · Experimental Grounds',
      groundBase: '#151c1e',
      groundAccent: '#1c2427',
      gridColor: 'rgba(94, 234, 212, 0.1)',
      borderHazard: '#0f766e',
    },
  },
};

export function createDefaultDungeonProgress(): DungeonProgressMap {
  return {
    salvage_yard: { highestClearedStage: 0, clears: 0, bossClears: 0 },
    arsenal_depot: { highestClearedStage: 0, clears: 0, bossClears: 0 },
    armored_stronghold: { highestClearedStage: 0, clears: 0, bossClears: 0 },
    experimental_grounds: { highestClearedStage: 0, clears: 0, bossClears: 0 },
  };
}

export function getDungeonWaveCount(stage: number): number {
  const s = Math.max(1, Math.min(MAX_DUNGEON_STAGE, stage));
  return s >= 6 ? 4 : 3;
}

export function getDungeonStageRecommendedPower(
  dungeonId: DungeonId,
  stage: number,
): number {
  const cfg = DUNGEON_CONFIGS[dungeonId];
  const s = Math.max(1, Math.min(MAX_DUNGEON_STAGE, stage));
  const stageFactor = Math.pow(1.2, s - 1) * (s === MAX_DUNGEON_STAGE ? 1.12 : 1);
  return Math.round(cfg.baseRecommendedPower * stageFactor);
}

export function getDungeonStageDifficultyMultipliers(
  dungeonId: DungeonId,
  stage: number,
  wave: number,
) {
  const cfg = DUNGEON_CONFIGS[dungeonId];
  const s = Math.max(1, Math.min(MAX_DUNGEON_STAGE, stage)) - 1;
  const waveRamp = 1 + Math.max(0, wave - 1) * 0.12;
  const finalStageRamp = stage === MAX_DUNGEON_STAGE ? 1.12 : 1;
  return {
    hpScale: cfg.difficultyScale * Math.pow(1.2, s) * waveRamp * finalStageRamp,
    damageScale:
      Math.pow(cfg.difficultyScale, 0.78) *
      Math.pow(1.14, s) *
      waveRamp *
      (stage === MAX_DUNGEON_STAGE ? 1.08 : 1),
    armorScale: (1 + s * 0.12) * (dungeonId === 'armored_stronghold' ? 1.25 : 1.0),
  };
}

// ---------------- ENEMY ARCHETYPES & STAGES ----------------

export interface EliteVariantConfig {
  id: EliteVariantId;
  name: string;
  label: string;
  hpMult: number;
  damageMult: number;
  armorMult: number;
  speedMult: number;
  attackSpeedMult: number;
  scrapMult: number;
  color: string;
  accent: string;
}

export const ELITE_VARIANT_CONFIGS: Record<EliteVariantId, EliteVariantConfig> = {
  armored: {
    id: 'armored',
    name: 'Armored Tank',
    label: 'Armored',
    hpMult: 1.55,
    damageMult: 1.12,
    armorMult: 1.75,
    speedMult: 0.88,
    attackSpeedMult: 1.0,
    scrapMult: 1.5,
    color: '#57534e',
    accent: '#a8a29e',
  },
  rapid: {
    id: 'rapid',
    name: 'Rapid Assault Tank',
    label: 'Rapid',
    hpMult: 1.18,
    damageMult: 1.06,
    armorMult: 1.1,
    speedMult: 1.38,
    attackSpeedMult: 1.35,
    scrapMult: 1.4,
    color: '#7f1d1d',
    accent: '#f87171',
  },
  explosive: {
    id: 'explosive',
    name: 'Explosive Tank',
    label: 'Explosive',
    hpMult: 1.25,
    damageMult: 1.32,
    armorMult: 1.15,
    speedMult: 1.05,
    attackSpeedMult: 0.9,
    scrapMult: 1.6,
    color: '#9a3412',
    accent: '#fb923c',
  },
  shield: {
    id: 'shield',
    name: 'Shield Tank',
    label: 'Shielded',
    hpMult: 1.35,
    damageMult: 1.08,
    armorMult: 1.3,
    speedMult: 0.95,
    attackSpeedMult: 1.0,
    scrapMult: 1.55,
    color: '#075985',
    accent: '#38bdf8',
  },
  artillery: {
    id: 'artillery',
    name: 'Heavy Artillery Tank',
    label: 'Artillery',
    hpMult: 1.28,
    damageMult: 1.48,
    armorMult: 1.2,
    speedMult: 0.82,
    attackSpeedMult: 0.75,
    scrapMult: 1.65,
    color: '#4c1d95',
    accent: '#c084fc',
  },
};

export function isMiniBossStage(stage: number): boolean {
  return stage >= 3 && stage % 5 !== 0 && stage % 3 === 0;
}

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetypeConfig> = {
  light: {
    id: 'light',
    name: 'Recon Scout',
    roleLabel: 'Light Tank',
    baseHp: 46,
    baseDamage: 9,
    attackSpeed: 1.1,
    armor: 1,
    moveSpeed: 96,
    preferredRange: 185,
    radius: 17,
    baseScrapReward: 9,
    hullColor: '#4b583a',
    hullAccent: '#84a955',
    turretColor: '#5b6b47',
    behavior: 'flank',
  },
  medium: {
    id: 'medium',
    name: 'Striker MBT',
    roleLabel: 'Medium Tank',
    baseHp: 92,
    baseDamage: 15,
    attackSpeed: 0.85,
    armor: 4,
    moveSpeed: 68,
    preferredRange: 225,
    radius: 21,
    baseScrapReward: 15,
    hullColor: '#6b4432',
    hullAccent: '#d97706',
    turretColor: '#7d503b',
    behavior: 'balanced',
  },
  heavy: {
    id: 'heavy',
    name: 'Bulwark Bastion',
    roleLabel: 'Heavy Tank',
    baseHp: 185,
    baseDamage: 24,
    attackSpeed: 0.58,
    armor: 10,
    moveSpeed: 44,
    preferredRange: 245,
    radius: 26,
    baseScrapReward: 26,
    hullColor: '#3f4552',
    hullAccent: '#94a3b8',
    turretColor: '#4c5463',
    behavior: 'siege',
  },
  assault: {
    id: 'assault',
    name: 'Viper Bruiser',
    roleLabel: 'Assault Tank',
    baseHp: 118,
    baseDamage: 22,
    attackSpeed: 1.05,
    armor: 5,
    moveSpeed: 84,
    preferredRange: 145,
    radius: 22,
    baseScrapReward: 22,
    hullColor: '#692d34',
    hullAccent: '#dc2626',
    turretColor: '#7d373f',
    behavior: 'rush',
  },
  boss: {
    id: 'boss',
    name: 'Iron Goliath',
    roleLabel: 'Siege Dreadnought',
    baseHp: 780,
    baseDamage: 38,
    attackSpeed: 0.78,
    armor: 16,
    moveSpeed: 38,
    preferredRange: 255,
    radius: 38,
    baseScrapReward: 145,
    hullColor: '#3b2428',
    hullAccent: '#d97706',
    turretColor: '#6e282d',
    behavior: 'command',
  },
};

export const STAGE_THEMES: StageTheme[] = [
  {
    id: 'proving-grounds',
    name: 'Sector 01 · Proving Grounds',
    groundBase: '#171a1f',
    groundAccent: '#1d2128',
    gridColor: 'rgba(148, 163, 184, 0.08)',
    borderHazard: '#d97706',
  },
  {
    id: 'arid-outpost',
    name: 'Sector 02 · Arid Outpost',
    groundBase: '#211c17',
    groundAccent: '#28221c',
    gridColor: 'rgba(217, 119, 6, 0.09)',
    borderHazard: '#b45309',
  },
  {
    id: 'refinery-yard',
    name: 'Sector 03 · Refinery Yard',
    groundBase: '#161b18',
    groundAccent: '#1c231f',
    gridColor: 'rgba(113, 128, 120, 0.1)',
    borderHazard: '#a16207',
  },
  {
    id: 'obsidian-fortress',
    name: 'Sector 04 · Obsidian Fortress',
    groundBase: '#141418',
    groundAccent: '#1b1b21',
    gridColor: 'rgba(161, 161, 170, 0.08)',
    borderHazard: '#b91c1c',
  },
];

export function getStageTheme(stage: number): StageTheme {
  const index = Math.floor((Math.max(1, stage) - 1) / BOSS_STAGE_INTERVAL) % STAGE_THEMES.length;
  return STAGE_THEMES[index];
}

export function isBossStage(stage: number): boolean {
  return stage >= BOSS_STAGE_INTERVAL && stage % BOSS_STAGE_INTERVAL === 0;
}

export function getWaveEnemyCount(stage: number, wave: number): number {
  if (isBossStage(stage) && wave === WAVES_PER_STAGE) {
    return 3;
  }
  return Math.min(11, 4 + Math.floor(stage * 0.65) + (wave - 1));
}

export function getStageDifficultyMultipliers(stage: number) {
  const s = Math.max(0, stage - 1);
  return {
    hpScale: Math.pow(1.22, s) * (1 + s * 0.08),
    damageScale: Math.pow(1.14, s) * (1 + s * 0.05),
    armorScale: 1 + s * 0.16,
    scrapScale: Math.pow(1.19, s) * (1 + s * 0.06),
  };
}

export function getWaveClearBonus(stage: number, wave: number): number {
  const base = 14 + wave * 6;
  const mult = Math.pow(1.18, Math.max(0, stage - 1));
  const bossBonus = isBossStage(stage) && wave === WAVES_PER_STAGE ? 2.5 : 1;
  return Math.round(base * mult * bossBonus);
}

export function getBossDisplayName(stage: number): string {
  const bossTier = Math.max(1, Math.floor(stage / BOSS_STAGE_INTERVAL));
  const titles = [
    'Iron Goliath MK-I',
    'Crimson Bastion MK-II',
    'Obsidian Mammoth MK-III',
    'Valkyrie Siege Engine',
    'Apex Dreadnought',
  ];
  const baseName = titles[(bossTier - 1) % titles.length];
  return bossTier > titles.length ? `${baseName} · Tier ${bossTier}` : baseName;
}

// ---------------- STAGE 3: PROGRESSION & RETENTION CONFIG ----------------

export const DAILY_MISSION_COUNT = 5;
export const WEEKLY_MISSION_COUNT = 5;
export const OFFLINE_EARNINGS_MIN_SECONDS = 60;
export const OFFLINE_EARNINGS_MAX_SECONDS = 8 * 3600; // 8 hours max offline accumulation

/**
 * Returns local Monday calendar key (YYYY-MM-DD) for deterministic 7-day weekly mission resets.
 */
export function getWeekStartDateKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return getLocalDateKey(d.getTime());
}

export const DAILY_MISSION_POOL: MissionDefinition[] = [
  {
    id: 'daily_defeat_enemies',
    objective: 'defeat_enemies',
    title: 'Frontline Sweep',
    description: 'Defeat 120 enemy combat units across Campaign or Dungeons.',
    target: 120,
    rewards: { scrap: 260, forgeCores: 4 },
  },
  {
    id: 'daily_complete_dungeons',
    objective: 'complete_dungeons',
    title: 'Dungeon Sortie',
    description: 'Complete 2 dungeon stage runs successfully.',
    target: 2,
    rewards: { forgeCores: 10, chests: { standard: 1 } },
  },
  {
    id: 'daily_forge_equipment',
    objective: 'forge_equipment',
    title: 'Foundry Shift',
    description: 'Forge 4 equipment pieces in the Armory Forge.',
    target: 4,
    rewards: { scrap: 280, equipmentChest: 'standard' },
  },
  {
    id: 'daily_upgrade_equipment',
    objective: 'upgrade_equipment',
    title: 'Field Calibration',
    description: 'Upgrade equipped or stored gear 3 times.',
    target: 3,
    rewards: { scrap: 240, alloyPlates: 10, forgeCores: 6 },
  },
  {
    id: 'daily_activate_skills',
    objective: 'activate_skills',
    title: 'Ordnance Deployment',
    description: 'Activate tank combat skills 20 times.',
    target: 20,
    rewards: { skillTech: 18, chests: { standard: 1 } },
  },
  {
    id: 'daily_defeat_dungeon_bosses',
    objective: 'defeat_dungeon_bosses',
    title: 'Warden Hunter',
    description: 'Defeat 2 dungeon bosses.',
    target: 2,
    rewards: { scrap: 360, forgeCores: 12 },
  },
  {
    id: 'daily_collect_scrap',
    objective: 'collect_scrap',
    title: 'Salvage Quota',
    description: 'Collect 1,500 Scrap from battlefield victories.',
    target: 1500,
    rewards: { forgeCores: 9, equipmentChest: 'standard' },
  },
];

export const WEEKLY_MISSION_POOL: MissionDefinition[] = [
  {
    id: 'weekly_defeat_enemies',
    objective: 'defeat_enemies',
    title: 'Armored Attrition',
    description: 'Defeat 2,000 enemy units across all battlefields.',
    target: 2000,
    rewards: { scrap: 2200, forgeCores: 25, chests: { advanced: 1 } },
  },
  {
    id: 'weekly_complete_dungeons',
    objective: 'complete_dungeons',
    title: 'Sector Siege Campaign',
    description: 'Complete 20 dungeon runs.',
    target: 20,
    rewards: { scrap: 2600, forgeCores: 35, equipmentChest: 'premium' },
  },
  {
    id: 'weekly_forge_equipment',
    objective: 'forge_equipment',
    title: 'Industrial Production',
    description: 'Forge 30 equipment pieces.',
    target: 30,
    rewards: { scrap: 2000, forgeCores: 30, equipmentChest: 'standard' },
  },
  {
    id: 'weekly_upgrade_skills',
    objective: 'upgrade_skills',
    title: 'Doctrine Mastery',
    description: 'Upgrade tank skills 5 times using duplicates.',
    target: 5,
    rewards: { skillTech: 80, chests: { elite: 1 } },
  },
  {
    id: 'weekly_defeat_bosses',
    objective: 'defeat_bosses',
    title: 'Dreadnought Bane',
    description: 'Defeat 10 Campaign or Dungeon bosses.',
    target: 10,
    rewards: { scrap: 2800, forgeCores: 40, chests: { advanced: 1 } },
  },
];

export const LOGIN_REWARD_CALENDAR: LoginRewardDay[] = [
  {
    day: 1,
    label: 'Scrap Supply',
    rewards: { scrap: 200 },
  },
  {
    day: 2,
    label: 'Forge Cores',
    rewards: { forgeCores: 14 },
  },
  {
    day: 3,
    label: 'Equipment Chest',
    rewards: { equipmentChest: 'standard' },
  },
  {
    day: 4,
    label: 'Heavy Scrap Reserve',
    rewards: { scrap: 500 },
  },
  {
    day: 5,
    label: 'Skill Chest',
    rewards: { chests: { advanced: 1 } },
  },
  {
    day: 6,
    label: 'Core Shipment',
    rewards: { forgeCores: 32 },
  },
  {
    day: 7,
    label: 'Premium Equipment Chest',
    rewards: { equipmentChest: 'premium' },
  },
];

export const ACHIEVEMENT_CATEGORIES: {
  id: AchievementCategory;
  label: string;
}[] = [
  { id: 'combat', label: 'Combat' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'forging', label: 'Forging' },
  { id: 'skills', label: 'Skills' },
  { id: 'dungeons', label: 'Dungeons' },
  { id: 'progression', label: 'Progression' },
];

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Combat
  {
    id: 'ach_first_blood',
    category: 'combat',
    title: 'First Blood',
    description: 'Destroy your first enemy tank in battle.',
    target: 1,
    metric: 'enemiesDefeated',
    rewards: { scrap: 120, forgeCores: 3 },
  },
  {
    id: 'ach_iron_tide',
    category: 'combat',
    title: 'Iron Tide',
    description: 'Defeat 500 enemy units.',
    target: 500,
    metric: 'enemiesDefeated',
    rewards: { scrap: 600, chests: { standard: 1 } },
  },
  {
    id: 'ach_tank_commander',
    category: 'combat',
    title: 'Tank Commander',
    description: 'Defeat 10,000 enemy units across all operations.',
    target: 10000,
    metric: 'enemiesDefeated',
    rewards: { scrap: 4500, forgeCores: 45, chests: { elite: 1 } },
  },
  {
    id: 'ach_boss_slayer',
    category: 'combat',
    title: 'Boss Slayer',
    description: 'Defeat 25 Campaign or Dungeon bosses.',
    target: 25,
    metric: 'bossesDefeated',
    rewards: { forgeCores: 30, equipmentChest: 'premium' },
  },

  // Equipment
  {
    id: 'ach_full_rig',
    category: 'equipment',
    title: 'Battle Ready Rig',
    description: 'Equip gear in all 6 tank equipment slots.',
    target: 6,
    metric: 'equippedSlotsCount',
    rewards: { scrap: 350, alloyPlates: 12 },
  },
  {
    id: 'ach_tinkerer',
    category: 'equipment',
    title: 'Workshop Engineer',
    description: 'Upgrade equipment pieces 15 times.',
    target: 15,
    metric: 'equipmentUpgraded',
    rewards: { scrap: 700, forgeCores: 16 },
  },
  {
    id: 'ach_prototype_hunter',
    category: 'equipment',
    title: 'Prototype Hunter',
    description: 'Obtain a Prototype-tier piece of tank equipment.',
    target: 1,
    metric: 'prototypeObtained',
    rewards: { forgeCores: 40, chests: { elite: 1 } },
  },

  // Forging
  {
    id: 'ach_apprentice_smith',
    category: 'forging',
    title: 'Foundry Initiate',
    description: 'Forge 10 pieces of equipment.',
    target: 10,
    metric: 'itemsForged',
    rewards: { scrap: 320, forgeCores: 8 },
  },
  {
    id: 'ach_master_forger',
    category: 'forging',
    title: 'Master Forger',
    description: 'Forge 100 pieces of equipment.',
    target: 100,
    metric: 'itemsForged',
    rewards: { scrap: 2400, forgeCores: 36, equipmentChest: 'premium' },
  },
  {
    id: 'ach_crucible_legend',
    category: 'forging',
    title: 'Crucible Architect',
    description: 'Forge 250 pieces of equipment.',
    target: 250,
    metric: 'itemsForged',
    rewards: { scrap: 5000, forgeCores: 60 },
  },

  // Skills
  {
    id: 'ach_arsenal_expansion',
    category: 'skills',
    title: 'Tactical Arsenal',
    description: 'Unlock 4 distinct tank combat skills.',
    target: 4,
    metric: 'unlockedSkillsCount',
    rewards: { skillTech: 35, chests: { advanced: 1 } },
  },
  {
    id: 'ach_ordnance_expert',
    category: 'skills',
    title: 'Combat Tactician',
    description: 'Activate tank skills 200 times.',
    target: 200,
    metric: 'skillsActivated',
    rewards: { skillTech: 45, scrap: 850 },
  },
  {
    id: 'ach_skill_specialist',
    category: 'skills',
    title: 'Skill Specialist',
    description: 'Upgrade any tank skill to Level 10.',
    target: 10,
    metric: 'maxSkillLevel',
    rewards: { skillTech: 100, chests: { elite: 1 }, forgeCores: 30 },
  },

  // Dungeons
  {
    id: 'ach_vault_raider',
    category: 'dungeons',
    title: 'Expedition Raider',
    description: 'Complete 5 dungeon runs.',
    target: 5,
    metric: 'dungeonsCompleted',
    rewards: { scrap: 600, forgeCores: 15 },
  },
  {
    id: 'ach_dungeon_warden_slayer',
    category: 'dungeons',
    title: 'Boss Busters',
    description: 'Defeat 25 dungeon bosses.',
    target: 25,
    metric: 'dungeonBossesDefeated',
    rewards: { forgeCores: 35, chests: { advanced: 1 } },
  },
  {
    id: 'ach_dungeon_conqueror',
    category: 'dungeons',
    title: 'Dungeon Conqueror',
    description: 'Complete all 10 stages of any dungeon.',
    target: 1,
    metric: 'completedAllStagesDungeonsCount',
    rewards: { scrap: 3500, forgeCores: 50, equipmentChest: 'premium', chests: { elite: 1 } },
  },

  // Progression
  {
    id: 'ach_rising_vanguard',
    category: 'progression',
    title: 'Rising Vanguard',
    description: 'Reach Tank Level 10.',
    target: 10,
    metric: 'tankLevel',
    rewards: { scrap: 450, equipmentChest: 'standard' },
  },
  {
    id: 'ach_campaign_veteran',
    category: 'progression',
    title: 'Frontline Veteran',
    description: 'Reach Campaign Stage 15.',
    target: 15,
    metric: 'highestStage',
    rewards: { scrap: 1500, forgeCores: 25, chests: { advanced: 1 } },
  },
  {
    id: 'ach_apex_ascension',
    category: 'progression',
    title: 'Apex Commander',
    description: 'Reach Tank Level 50.',
    target: 50,
    metric: 'tankLevel',
    rewards: { scrap: 5000, forgeCores: 60, equipmentChest: 'premium' },
  },
];

export const TANK_MILESTONES: TankMilestoneDefinition[] = [
  {
    level: 5,
    title: 'Cadet Requisition',
    description: 'Initial field supply package for reaching Tank Level 5.',
    rewards: { scrap: 180, forgeCores: 6 },
  },
  {
    level: 10,
    title: 'Armory Deployment',
    description: 'Grants an Equipment Chest and bonus Scrap reserves.',
    rewards: { equipmentChest: 'standard', scrap: 250 },
  },
  {
    level: 15,
    title: 'Core Infusion',
    description: 'High-grade Forge Core allocation for advanced smithing.',
    rewards: { forgeCores: 20, scrap: 350 },
  },
  {
    level: 20,
    title: 'Ordnance Cache',
    description: 'Tactical Skill Chest and Skill Tech modules.',
    rewards: { chests: { standard: 1 }, skillTech: 25 },
  },
  {
    level: 25,
    title: 'Auto Forge Authorization',
    description: 'Unlocks automated Forge Foundry synthesis plus Forge Cores.',
    rewards: {
      forgeCores: 25,
      featureUnlockLabel: 'Auto Forge System Unlocked',
    },
  },
  {
    level: 30,
    title: 'Advanced Skill Crate',
    description: 'Unlocks an Advanced Skill Chest and tactical modules.',
    rewards: { chests: { advanced: 1 }, skillTech: 40 },
  },
  {
    level: 40,
    title: 'War Chest Scrap Bonus',
    description: 'Major Scrap treasury infusion for heavy upgrades.',
    rewards: { scrap: 2400, forgeCores: 30 },
  },
  {
    level: 50,
    title: 'Apex Vanguard Chassis',
    description: 'Unlocks the Golden-Cyan Apex Tank Visual Customization and a Premium Equipment Chest.',
    rewards: {
      equipmentChest: 'premium',
      forgeCores: 40,
      featureUnlockLabel: 'Apex Vanguard Tank Skin Unlocked',
    },
  },
  {
    level: 60,
    title: 'Supreme Overlord Reserve',
    description: 'Elite Skill Chest, Forge Cores, and massive Scrap reserve.',
    rewards: { chests: { elite: 1 }, scrap: 4500, forgeCores: 55 },
  },
];

export function createDefaultLifetimeStats(): LifetimeStats {
  return {
    enemiesDefeated: 0,
    bossesDefeated: 0,
    dungeonBossesDefeated: 0,
    dungeonsCompleted: 0,
    itemsForged: 0,
    equipmentUpgraded: 0,
    skillsActivated: 0,
    skillsUpgraded: 0,
    scrapCollected: 0,
    prototypeObtained: false,
  };
}

export function createDefaultLoginCalendar(): LoginCalendarState {
  return {
    claimedDays: 0,
    lastClaimDate: null,
  };
}
