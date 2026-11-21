export type CurrencyType = 'scrap' | 'forgeCores' | 'skillTech' | 'alloyPlates';

export type Wallet = Record<CurrencyType, number>;

export type UpgradeKey =
  | 'maxHp'
  | 'attackDamage'
  | 'attackSpeed'
  | 'armor'
  | 'critChance'
  | 'critDamage';

export type UpgradeLevels = Record<UpgradeKey, number>;

export interface TankStats {
  maxHp: number;
  attackDamage: number;
  attackSpeed: number; // shots per second
  armor: number;
  critChance: number; // 0 to 1
  critDamage: number; // multiplier e.g. 1.75
  // Derived equipment passives
  lifestealOnKillRatio: number;
  armorPenetrationRatio: number;
  splashDamageRatio: number;
  skillHasteRatio: number;
  scrapBonusRatio: number;
}

export interface UpgradeDefinition {
  key: UpgradeKey;
  label: string;
  shortLabel: string;
  description: string;
  baseValue: number;
  incrementPerLevel: number;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number | null;
  unit: string;
  formatValue: (value: number) => string;
  formatDelta: (delta: number) => string;
}

// ---------------- EQUIPMENT & FORGE ----------------

export type EquipmentSlot =
  | 'cannon'
  | 'turret'
  | 'hull'
  | 'armor'
  | 'optics'
  | 'treads';

export type EquipmentRarity =
  | 'scrap'
  | 'reinforced'
  | 'military'
  | 'advanced'
  | 'elite'
  | 'prototype';

export type EquipmentPassiveId =
  | 'vampiric_shells'
  | 'piercing_rounds'
  | 'blast_splash'
  | 'cooldown_haste'
  | 'scrap_magnet';

export interface EquipmentPassive {
  id: EquipmentPassiveId;
  label: string;
  description: string;
  value: number; // e.g. 0.15 for 15%
}

export interface EquipmentStatBonus {
  maxHp?: number;
  attackDamage?: number;
  attackSpeed?: number;
  armor?: number;
  critChance?: number;
  critDamage?: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  level: number;
  powerScore: number;
  bonuses: EquipmentStatBonus;
  passive: EquipmentPassive | null;
  createdAt: number;
}

export type EquippedGearMap = Record<EquipmentSlot, EquipmentItem | null>;

export type ForgeTierId = 'standard' | 'tactical' | 'prototype';

export interface ForgeTierConfig {
  id: ForgeTierId;
  name: string;
  description: string;
  scrapCost: number;
  coreCost: number;
  rarityWeights: Record<EquipmentRarity, number>;
}

export interface AutoForgeSettings {
  enabled: boolean;
  targetRarity: EquipmentRarity;
  tierId: ForgeTierId;
  autoSalvageLower: boolean;
}

export interface AutoForgeSummary {
  attempts: number;
  scrapSpent: number;
  coresSpent: number;
  salvagedCount: number;
  lastItem: EquipmentItem | null;
  stopReason: string | null;
}

// ---------------- TANK SKILLS & CHESTS ----------------

export type SkillId =
  | 'missile_barrage'
  | 'artillery_strike'
  | 'mine_deployment'
  | 'railgun_shot'
  | 'repair_drone'
  | 'emp_pulse'
  | 'overdrive'
  | 'rocket_salvo';

export type SkillRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  rarity: SkillRarity;
  description: string;
  cooldown: number; // seconds
  unlockTechCost: number;
  basePower: number;
  powerPerLevel: number;
  duration?: number;
  accentColor: string;
}

export interface OwnedSkillState {
  id: SkillId;
  unlocked: boolean;
  level: number;
  duplicates: number;
}

export type SkillCollection = Record<SkillId, OwnedSkillState>;

export type ChestTierId = 'standard' | 'advanced' | 'elite';

export type ChestInventory = Record<ChestTierId, number>;

export interface ChestReward {
  chestTier: ChestTierId;
  skillId: SkillId;
  rarity: SkillRarity;
  isNewUnlock: boolean;
  duplicatesGranted: number;
  bonusSkillTech: number;
}

export interface SkillCooldownSnapshot {
  id: SkillId;
  cooldownRemaining: number;
  cooldownTotal: number;
  activeRemaining: number;
}

// ---------------- DUNGEONS ----------------

export type DungeonId =
  | 'salvage_yard'
  | 'arsenal_depot'
  | 'armored_stronghold'
  | 'experimental_grounds';

export interface DungeonRewardBundle {
  scrap: number;
  forgeCores: number;
  skillTech: number;
  alloyPlates: number;
  chests: Partial<ChestInventory>;
  equipment: EquipmentItem[];
}

export interface DungeonEnemySpec {
  name: string;
  roleLabel: string;
  archetype: EnemyArchetypeId;
  ability: ExperimentalAbility;
  hpMult: number;
  damageMult: number;
  armorMult: number;
  speedMult: number;
  radius: number;
  hullColor: string;
  hullAccent: string;
  turretColor: string;
}

export interface DungeonConfig {
  id: DungeonId;
  name: string;
  subtitle: string;
  purpose: string;
  maxStages: number;
  baseRecommendedPower: number;
  bossName: string;
  finalBossName: string;
  bossSpec: DungeonEnemySpec;
  finalBossSpec: DungeonEnemySpec;
  enemies: DungeonEnemySpec[];
  theme: StageTheme;
  difficultyScale: number;
  mainRewardType: string;
  primaryRewardLabel: string;
  secondaryRewardLabel: string;
  bossBonusLabel: string;
}

export interface DungeonStageProgress {
  highestClearedStage: number; // 0..10
  clears: number;
  bossClears: number;
}

export type DungeonProgressMap = Record<DungeonId, DungeonStageProgress>;

export interface DailyDungeonEntries {
  remaining: number;
  max: number;
  lastResetDate: string; // YYYY-MM-DD local calendar key
}

export interface DungeonCompletionResult {
  runId: string;
  dungeonId: DungeonId;
  dungeonName: string;
  stage: number;
  victory: boolean;
  wavesCleared: number;
  totalWaves: number;
  bossName: string;
  isFinalBoss: boolean;
  newlyUnlockedStage: number | null;
  rewards: DungeonRewardBundle;
}

// ---------------- COMBAT & ENTITIES ----------------

export type EnemyArchetypeId = 'light' | 'medium' | 'heavy' | 'assault' | 'boss';

export type ExperimentalAbility = 'none' | 'surge' | 'plasma' | 'shield';

export interface EnemyArchetypeConfig {
  id: EnemyArchetypeId;
  name: string;
  roleLabel: string;
  baseHp: number;
  baseDamage: number;
  attackSpeed: number;
  armor: number;
  moveSpeed: number;
  preferredRange: number;
  radius: number;
  baseScrapReward: number;
  hullColor: string;
  hullAccent: string;
  turretColor: string;
  behavior: 'flank' | 'balanced' | 'siege' | 'rush' | 'command';
}

export interface StageTheme {
  id: string;
  name: string;
  groundBase: string;
  groundAccent: string;
  gridColor: string;
  borderHazard: string;
}

export interface PlayerEntity {
  x: number;
  y: number;
  hullAngle: number;
  turretAngle: number;
  targetTurretAngle: number;
  hp: number;
  maxHp: number;
  radius: number;
  fireCooldown: number;
  recoil: number;
  hitFlash: number;
  trackOffset: number;
  vx: number;
  vy: number;
  targetId: number | null;
}

export type EliteVariantId =
  | 'armored'
  | 'rapid'
  | 'explosive'
  | 'shield'
  | 'artillery';

export interface EnemyEntity {
  id: number;
  archetype: EnemyArchetypeId;
  name: string;
  isBoss: boolean;
  isElite: boolean;
  eliteVariant?: EliteVariantId;
  isMiniBoss?: boolean;
  bossPhase?: number;
  bossMaxPhase?: number;
  ability: ExperimentalAbility;
  abilityTimer: number;
  stunTimer: number;
  shieldHp: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hullAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackSpeed: number;
  armor: number;
  moveSpeed: number;
  preferredRange: number;
  radius: number;
  scrapReward: number;
  xpReward: number;
  fireCooldown: number;
  recoil: number;
  hitFlash: number;
  trackOffset: number;
  strafeSign: number;
  hullColor: string;
  hullAccent: string;
  turretColor: string;
  behavior: EnemyArchetypeConfig['behavior'];
}

export interface ProjectileEntity {
  id: number;
  owner: 'player' | 'enemy';
  kind: 'shell' | 'missile' | 'plasma' | 'rocket';
  weaponKind?: 'standard' | 'heavy' | 'rapid' | 'missile' | 'rocket' | 'railgun' | 'artillery' | 'plasma' | 'enemy';
  targetId?: number;
  turnRate?: number;
  splashRadius?: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  damage: number;
  isCrit: boolean;
  armorPen: number;
  splashRatio: number;
  radius: number;
  color: string;
  trailColor: string;
  life: number;
}

export interface ArtilleryStrikeEntity {
  x: number;
  y: number;
  delay: number;
  maxDelay: number;
  radius: number;
  damage: number;
}

export interface MineEntity {
  x: number;
  y: number;
  radius: number;
  triggerRadius: number;
  blastRadius: number;
  damage: number;
  age: number;
  maxAge: number;
  armed: boolean;
}

export interface RailgunBeamEntity {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface QueuedRocketShot {
  delay: number;
  targetId: number | null;
  fallbackX: number;
  fallbackY: number;
  damage: number;
  splashRadius: number;
}

export interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  endSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'flame' | 'smoke' | 'spark' | 'debris' | 'ring' | 'emp';
  rotation: number;
  vRot: number;
}

export interface FloatingTextEntity {
  id: number;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface ScrapDropEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
  age: number;
  collected: boolean;
  rotation: number;
}

export interface ScorchMark {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  rotation: number;
}

export interface BattleHudSnapshot {
  mode: 'campaign' | 'dungeon';
  activeDungeonId: DungeonId | null;
  activeDungeonName: string | null;
  dungeonStage: number;
  stage: number;
  wave: number;
  wavesPerStage: number;
  stageThemeName: string;
  isBossWave: boolean;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  bossPhase?: number;
  bossMaxPhase?: number;
  bossTitle?: string | null;
  enemiesRemaining: number;
  enemiesTotalInWave: number;
  enemiesDefeatedInWave: number;
  playerHp: number;
  playerMaxHp: number;
  isRecovering: boolean;
  recoveryTimer: number;
  waveTransitionTimer: number;
  stageBannerText: string | null;
  stageBannerTimer: number;
  totalKills: number;
  highestStage: number;
  skillCooldowns: SkillCooldownSnapshot[];
  autoSkillsEnabled: boolean;
  overdriveActive: boolean;
  repairDroneActive: boolean;
}

// ---------------- STAGE 3: PROGRESSION & RETENTION ----------------

export type MissionObjectiveType =
  | 'defeat_enemies'
  | 'complete_dungeons'
  | 'forge_equipment'
  | 'upgrade_equipment'
  | 'activate_skills'
  | 'defeat_dungeon_bosses'
  | 'collect_scrap'
  | 'defeat_bosses'
  | 'upgrade_skills';

export type EquipmentChestTier = 'standard' | 'premium';

export interface ProgressionRewardBundle {
  scrap?: number;
  forgeCores?: number;
  skillTech?: number;
  alloyPlates?: number;
  chests?: Partial<ChestInventory>;
  equipmentChest?: EquipmentChestTier;
  featureUnlockLabel?: string;
}

export interface MissionDefinition {
  id: string;
  objective: MissionObjectiveType;
  title: string;
  description: string;
  target: number;
  rewards: ProgressionRewardBundle;
}

export interface MissionItem {
  id: string;
  objective: MissionObjectiveType;
  title: string;
  description: string;
  target: number;
  progress: number;
  claimed: boolean;
  rewards: ProgressionRewardBundle;
}

export interface DailyMissionsState {
  dateKey: string; // YYYY-MM-DD local calendar date
  missions: MissionItem[];
}

export interface WeeklyMissionsState {
  weekStartDate: string; // YYYY-MM-DD local Monday date
  missions: MissionItem[];
}

export interface LoginRewardDay {
  day: number; // 1..7
  label: string;
  rewards: ProgressionRewardBundle;
}

export interface LoginCalendarState {
  claimedDays: number; // 0..7 in current cycle
  lastClaimDate: string | null; // YYYY-MM-DD
}

export type AchievementCategory =
  | 'combat'
  | 'equipment'
  | 'forging'
  | 'skills'
  | 'dungeons'
  | 'progression';

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  target: number;
  metric:
    | 'enemiesDefeated'
    | 'bossesDefeated'
    | 'equippedSlotsCount'
    | 'prototypeObtained'
    | 'equipmentUpgraded'
    | 'itemsForged'
    | 'unlockedSkillsCount'
    | 'skillsActivated'
    | 'maxSkillLevel'
    | 'dungeonsCompleted'
    | 'completedAllStagesDungeonsCount'
    | 'dungeonBossesDefeated'
    | 'tankLevel'
    | 'highestStage';
  rewards: ProgressionRewardBundle;
}

export interface TankMilestoneDefinition {
  level: number;
  title: string;
  description: string;
  rewards: ProgressionRewardBundle;
}

export interface LifetimeStats {
  enemiesDefeated: number;
  bossesDefeated: number;
  dungeonBossesDefeated: number;
  dungeonsCompleted: number;
  itemsForged: number;
  equipmentUpgraded: number;
  skillsActivated: number;
  skillsUpgraded: number;
  scrapCollected: number;
  prototypeObtained: boolean;
}

export interface OfflineEarningsSummary {
  elapsedSeconds: number;
  cappedSeconds: number;
  wasCapped: boolean;
  scrapEarned: number;
}

export type NavTab = 'battle' | 'upgrades' | 'skills' | 'dungeons' | 'missions';

export interface SaveData {
  version: number;
  wallet: Wallet;
  chests: ChestInventory;
  upgradeLevels: UpgradeLevels;
  tankLevel: number;
  tankXp: number;
  equippedGear: EquippedGearMap;
  equipmentInventory: EquipmentItem[];
  skills: SkillCollection;
  equippedSkillIds: (SkillId | null)[];
  autoSkillsEnabled: boolean;
  autoForge: AutoForgeSettings;
  dungeonProgress: DungeonProgressMap;
  dungeonEntries: DailyDungeonEntries;
  dailyMissions: DailyMissionsState;
  weeklyMissions: WeeklyMissionsState;
  loginCalendar: LoginCalendarState;
  claimedAchievements: string[];
  claimedMilestones: number[];
  lifetimeStats: LifetimeStats;
  apexSkinEnabled: boolean;
  lastActiveAt: number;
  stage: number;
  highestStage: number;
  totalKills: number;
  muted: boolean;
  savedAt: number;
}
