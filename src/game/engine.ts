import { soundFx } from './audio';
import {
  DUNGEON_CONFIGS,
  ENEMY_ARCHETYPES,
  ELITE_VARIANT_CONFIGS,
  isMiniBossStage,
  MAX_DUNGEON_STAGE,
  MAX_EQUIPPED_SKILLS,
  SKILL_DEFINITIONS,
  WAVES_PER_STAGE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getBossDisplayName,
  getDungeonStageDifficultyMultipliers,
  getDungeonWaveCount,
  getStageDifficultyMultipliers,
  getStageTheme,
  getWaveClearBonus,
  getWaveEnemyCount,
  isBossStage,
} from './config';
import { calculateMitigatedDamage } from './progression';
import { getSkillComputedStats, getSkillCooldown } from './skills';
import type {
  ArtilleryStrikeEntity,
  BattleHudSnapshot,
  DungeonEnemySpec,
  DungeonId,
  EliteVariantId,
  EnemyArchetypeId,
  EnemyEntity,
  ExperimentalAbility,
  FloatingTextEntity,
  MineEntity,
  ParticleEntity,
  PlayerEntity,
  ProjectileEntity,
  QueuedRocketShot,
  RailgunBeamEntity,
  ScorchMark,
  ScrapDropEntity,
  SkillCollection,
  SkillCooldownSnapshot,
  SkillId,
  StageTheme,
  TankStats,
} from './types';

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function rotateToward(current: number, target: number, maxStep: number): number {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface EngineCallbacks {
  onScrapCollected: (amount: number) => void;
  onXpGained: (xp: number) => void;
  onKillRecorded: () => void;
  onBossDefeated?: (isDungeonBoss: boolean) => void;
  onSkillActivated?: (skillId: SkillId) => void;
  onStageChanged: (newStage: number) => void;
  onDungeonEnded: (
    dungeonId: DungeonId,
    dungeonStage: number,
    victory: boolean,
    wavesCleared: number,
    totalWaves: number,
  ) => void;
  onHudUpdate: (snapshot: BattleHudSnapshot) => void;
}

export class BattleEngine {
  private stats: TankStats;
  private callbacks: EngineCallbacks;
  private apexCustomization = false;

  private mode: 'campaign' | 'dungeon' = 'campaign';
  private activeDungeonId: DungeonId | null = null;
  private activeDungeonStage = 1;
  private dungeonEndedFired = false;
  private stage: number;
  private wave = 1;
  private highestStage: number;
  private totalKills: number;

  private player: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private artilleryStrikes: ArtilleryStrikeEntity[] = [];
  private mines: MineEntity[] = [];
  private railgunBeams: RailgunBeamEntity[] = [];
  private rocketQueue: QueuedRocketShot[] = [];
  private particles: ParticleEntity[] = [];
  private floatingTexts: FloatingTextEntity[] = [];
  private scrapDrops: ScrapDropEntity[] = [];
  private scorches: ScorchMark[] = [];

  // Equipped Skills Runtime
  private equippedSkillIds: (SkillId | null)[] = [null, null, null];
  private skillsState: SkillCollection;
  private autoSkillsEnabled = true;
  private skillCooldowns: Record<string, number> = {};
  private overdriveTimer = 0;
  private overdriveAttackBonus = 0;
  private overdriveMoveBonus = 0;
  private repairDroneTimer = 0;
  private repairDroneHealPerSec = 0;
  private repairDronePulseInterval = 0.4;
  private repairDronePulseAcc = 0;

  private nextEntityId = 1;
  private enemiesTotalInWave = 0;
  private enemiesSpawnedInWave = 0;
  private enemiesDefeatedInWave = 0;
  private spawnTimer = 0;

  private paused = false;
  private isRecovering = false;
  private recoveryTimer = 0;
  private waveTransitionTimer = 0;
  private stageBannerText: string | null = null;
  private stageBannerTimer = 0;

  private screenShake = 0;
  private reducedMotion = false;
  private manualTargetId: number | null = null;
  private patrolTime = 0;
  private hudSyncAccumulator = 0;

  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainThemeId = '';

  constructor(
    initialStats: TankStats,
    initialStage: number,
    initialHighestStage: number,
    initialTotalKills: number,
    initialEquippedSkills: (SkillId | null)[],
    initialSkillsState: SkillCollection,
    callbacks: EngineCallbacks,
  ) {
    this.stats = { ...initialStats };
    this.stage = Math.max(1, initialStage);
    this.highestStage = Math.max(this.stage, initialHighestStage);
    this.totalKills = Math.max(0, initialTotalKills);
    this.equippedSkillIds = [...initialEquippedSkills];
    this.skillsState = initialSkillsState;
    this.callbacks = callbacks;

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    this.player = {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      hullAngle: -Math.PI / 2,
      turretAngle: -Math.PI / 2,
      targetTurretAngle: -Math.PI / 2,
      hp: initialStats.maxHp,
      maxHp: initialStats.maxHp,
      radius: 25,
      fireCooldown: 0.25,
      recoil: 0,
      hitFlash: 0,
      trackOffset: 0,
      vx: 0,
      vy: 0,
      targetId: null,
    };

    this.initializeSkillCooldowns();
    this.startWave(this.stage, 1, true);
  }

  private initializeSkillCooldowns(): void {
    for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
      const id = this.equippedSkillIds[i];
      if (id && this.skillCooldowns[id] === undefined) {
        this.skillCooldowns[id] = 1.2 + i * 0.6;
      }
    }
  }

  public updateSkillLoadout(
    equippedSkillIds: (SkillId | null)[],
    skillsState: SkillCollection,
  ): void {
    this.equippedSkillIds = [...equippedSkillIds];
    this.skillsState = skillsState;
    for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
      const id = this.equippedSkillIds[i];
      if (id && this.skillCooldowns[id] === undefined) {
        this.skillCooldowns[id] = 0.8;
      }
    }
    this.emitHudSnapshot();
  }

  public setAutoSkillsEnabled(enabled: boolean): void {
    this.autoSkillsEnabled = enabled;
    this.emitHudSnapshot();
  }

  public isAutoSkillsEnabled(): boolean {
    return this.autoSkillsEnabled;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public updatePlayerStats(nextStats: TankStats): void {
    const hpDiff = Math.max(0, nextStats.maxHp - this.stats.maxHp);
    this.stats = { ...nextStats };
    this.player.maxHp = nextStats.maxHp;
    if (hpDiff > 0 && !this.isRecovering) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + hpDiff);
    } else {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp);
    }
    this.emitHudSnapshot();
  }

  public setApexCustomization(enabled: boolean): void {
    this.apexCustomization = enabled;
  }

  public startDungeon(dungeonId: DungeonId, dungeonStage = 1): boolean {
    const cfg = DUNGEON_CONFIGS[dungeonId];
    if (!cfg || !Number.isInteger(dungeonStage) || dungeonStage < 1 || dungeonStage > cfg.maxStages) {
      return false;
    }
    this.mode = 'dungeon';
    this.activeDungeonId = dungeonId;
    this.activeDungeonStage = dungeonStage;
    this.dungeonEndedFired = false;
    this.clearTransientCombatObjects();
    this.isRecovering = false;
    this.recoveryTimer = 0;
    this.waveTransitionTimer = 0;
    this.player.hp = this.player.maxHp;
    this.player.x = WORLD_WIDTH / 2;
    this.player.y = WORLD_HEIGHT / 2;
    this.terrainCanvas = null;
    this.startWave(dungeonStage, 1, true, cfg.name);
    return true;
  }

  public returnToCampaign(): void {
    this.mode = 'campaign';
    this.activeDungeonId = null;
    this.activeDungeonStage = 1;
    this.dungeonEndedFired = false;
    this.clearTransientCombatObjects();
    this.isRecovering = false;
    this.recoveryTimer = 0;
    this.waveTransitionTimer = 0;
    this.player.hp = this.player.maxHp;
    this.player.x = WORLD_WIDTH / 2;
    this.player.y = WORLD_HEIGHT / 2;
    this.terrainCanvas = null;
    this.startWave(this.stage, 1, true);
  }

  private clearTransientCombatObjects(): void {
    this.enemies = [];
    this.projectiles = [];
    this.artilleryStrikes = [];
    this.mines = [];
    this.railgunBeams = [];
    this.rocketQueue = [];
    this.particles = [];
    this.floatingTexts = [];
    this.scrapDrops = [];
    this.scorches = [];
    this.manualTargetId = null;
    this.overdriveTimer = 0;
    this.overdriveAttackBonus = 0;
    this.overdriveMoveBonus = 0;
    this.repairDroneTimer = 0;
  }

  public resetProgress(
    initialStats: TankStats,
    equippedSkills: (SkillId | null)[],
    skillsState: SkillCollection,
  ): void {
    this.mode = 'campaign';
    this.activeDungeonId = null;
    this.activeDungeonStage = 1;
    this.dungeonEndedFired = false;
    this.stats = { ...initialStats };
    this.stage = 1;
    this.wave = 1;
    this.highestStage = 1;
    this.totalKills = 0;
    this.equippedSkillIds = [...equippedSkills];
    this.skillsState = skillsState;
    this.skillCooldowns = {};
    this.initializeSkillCooldowns();
    this.clearTransientCombatObjects();
    this.isRecovering = false;
    this.recoveryTimer = 0;
    this.waveTransitionTimer = 0;
    this.player.x = WORLD_WIDTH / 2;
    this.player.y = WORLD_HEIGHT / 2;
    this.player.hp = initialStats.maxHp;
    this.player.maxHp = initialStats.maxHp;
    this.terrainCanvas = null;
    this.startWave(1, 1, true);
  }

  public handlePointerTap(canvasX: number, canvasY: number, viewWidth: number, viewHeight: number): void {
    if (this.paused || this.isRecovering) return;
    const { scale, offsetX, offsetY } = this.getViewportTransform(viewWidth, viewHeight);
    const worldX = (canvasX - offsetX) / scale;
    const worldY = (canvasY - offsetY) / scale;

    let closest: EnemyEntity | null = null;
    let closestDist = 48;
    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - worldX, enemy.y - worldY);
      if (dist <= enemy.radius + 26 && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    if (closest) {
      this.manualTargetId = closest.id;
      this.player.targetId = closest.id;
      this.spawnRingParticle(closest.x, closest.y, closest.radius + 14, '#f59e0b');
    }
  }

  private getViewportTransform(viewWidth: number, viewHeight: number) {
    const scale = Math.min(viewWidth / 610, viewHeight / 515);
    const offsetX = viewWidth / 2 - (WORLD_WIDTH / 2) * scale;
    const offsetY = viewHeight / 2 - (WORLD_HEIGHT / 2) * scale;
    return { scale, offsetX, offsetY };
  }

  private getActiveTheme(): StageTheme {
    if (this.mode === 'dungeon' && this.activeDungeonId) {
      return DUNGEON_CONFIGS[this.activeDungeonId].theme;
    }
    return getStageTheme(this.stage);
  }

  private getCurrentWavesPerStage(): number {
    if (this.mode === 'dungeon' && this.activeDungeonId) {
      return getDungeonWaveCount(this.activeDungeonStage);
    }
    return WAVES_PER_STAGE;
  }

  private startWave(
    stageOrWaveStage: number,
    wave: number,
    showBanner: boolean,
    dungeonTitle?: string,
  ): void {
    if (this.mode === 'campaign') {
      this.stage = stageOrWaveStage;
    }
    this.wave = wave;
    this.enemies = [];
    this.projectiles = [];
    this.manualTargetId = null;

    const totalWaves = this.getCurrentWavesPerStage();

    if (this.mode === 'dungeon' && this.activeDungeonId) {
      const isDungeonBoss = wave === totalWaves;
      this.enemiesTotalInWave = isDungeonBoss
        ? 4
        : Math.min(8, 4 + Math.floor(this.activeDungeonStage / 3) + (wave - 1));
    } else {
      this.enemiesTotalInWave = getWaveEnemyCount(this.stage, wave);
    }

    this.enemiesSpawnedInWave = 0;
    this.enemiesDefeatedInWave = 0;
    this.spawnTimer = 0.25;

    if (showBanner) {
      if (this.mode === 'dungeon' && this.activeDungeonId) {
        const dCfg = DUNGEON_CONFIGS[this.activeDungeonId];
        const isBoss = wave === totalWaves;
        const bossLabel =
          this.activeDungeonStage === MAX_DUNGEON_STAGE ? dCfg.finalBossName : dCfg.bossName;
        this.stageBannerText = isBoss
          ? `STAGE ${this.activeDungeonStage} BOSS · ${bossLabel.toUpperCase()}`
          : `${(dungeonTitle ?? dCfg.name).toUpperCase()} · S${this.activeDungeonStage} · W${wave}/${totalWaves}`;
        this.stageBannerTimer = isBoss ? 2.6 : 1.7;
      } else {
        const bossIncoming = isBossStage(this.stage) && wave === WAVES_PER_STAGE;
        this.stageBannerText = bossIncoming
          ? `BOSS ALERT · ${getBossDisplayName(this.stage).toUpperCase()}`
          : `STAGE ${this.stage} · WAVE ${wave}/${WAVES_PER_STAGE}`;
        this.stageBannerTimer = bossIncoming ? 2.6 : 1.7;
      }
    }

    const isBossNow =
      this.mode === 'dungeon'
        ? wave === totalWaves
        : isBossStage(this.stage) && wave === WAVES_PER_STAGE;
    const immediateCount = isBossNow ? this.enemiesTotalInWave : Math.min(3, this.enemiesTotalInWave);
    for (let i = 0; i < immediateCount; i++) {
      this.spawnNextEnemy();
    }

    this.emitHudSnapshot();
  }

  private pickDungeonEnemySpec(
    dungeonId: DungeonId,
    dungeonStage: number,
    wave: number,
    totalWaves: number,
    spawnIndex: number,
  ): { spec: DungeonEnemySpec; isBoss: boolean; isElite: boolean } {
    const dCfg = DUNGEON_CONFIGS[dungeonId];
    const isBossWave = wave === totalWaves;
    if (isBossWave && spawnIndex === 0) {
      const bossSpec = dungeonStage === MAX_DUNGEON_STAGE ? dCfg.finalBossSpec : dCfg.bossSpec;
      return {
        spec: bossSpec,
        isBoss: true,
        isElite: dungeonStage === MAX_DUNGEON_STAGE,
      };
    }

    const roster = dCfg.enemies;
    let poolIndices: number[];
    if (wave === 1 && dungeonStage <= 3) {
      poolIndices = [0, 1, 0, 2];
    } else if (wave === 1) {
      poolIndices = [0, 1, 2, 1];
    } else if (wave === 2) {
      poolIndices = [0, 1, 2, 3];
    } else {
      poolIndices = [1, 2, 3, 2];
    }

    const pickedIdx = poolIndices[(spawnIndex + wave - 1) % poolIndices.length] % roster.length;
    const spec = roster[pickedIdx];
    const isElite = dungeonStage >= 5 && wave >= 2 && spawnIndex % 3 === 2;
    return { spec, isBoss: false, isElite };
  }

  private pickCampaignEnemyArchetype(
    stage: number,
    wave: number,
    spawnIndex: number,
  ): { archetype: EnemyArchetypeId; isElite: boolean; ability: ExperimentalAbility } {
    if (isBossStage(stage) && wave === WAVES_PER_STAGE) {
      if (spawnIndex === 0) {
        return { archetype: 'boss', isElite: false, ability: 'none' };
      }
      return { archetype: stage >= 10 ? 'assault' : 'light', isElite: stage >= 10, ability: 'none' };
    }

    const roll = Math.random();
    let archetype: EnemyArchetypeId = 'light';

    if (stage === 1) {
      archetype = roll < 0.7 ? 'light' : 'medium';
    } else if (stage === 2) {
      archetype = roll < 0.45 ? 'light' : roll < 0.85 ? 'medium' : 'assault';
    } else if (stage === 3 || stage === 4) {
      archetype = roll < 0.3 ? 'light' : roll < 0.62 ? 'medium' : roll < 0.84 ? 'assault' : 'heavy';
    } else {
      archetype = roll < 0.24 ? 'light' : roll < 0.52 ? 'medium' : roll < 0.78 ? 'assault' : 'heavy';
    }

    const eliteChance = stage >= 3 ? Math.min(0.28, (stage - 2) * 0.045) : 0;
    const isElite = Math.random() < eliteChance;
    return { archetype, isElite, ability: 'none' };
  }

  private spawnNextEnemy(): void {
    if (this.enemiesSpawnedInWave >= this.enemiesTotalInWave) return;
    const spawnIndex = this.enemiesSpawnedInWave;
    this.enemiesSpawnedInWave++;

    const totalWaves = this.getCurrentWavesPerStage();

    const angle = Math.random() * Math.PI * 2;
    const rx = 255 + Math.random() * 35;
    const ry = 215 + Math.random() * 30;
    const x = WORLD_WIDTH / 2 + Math.cos(angle) * rx;
    const y = WORLD_HEIGHT / 2 + Math.sin(angle) * ry;
    const faceAngle = Math.atan2(this.player.y - y, this.player.x - x);

    if (this.mode === 'dungeon' && this.activeDungeonId) {
      const picked = this.pickDungeonEnemySpec(
        this.activeDungeonId,
        this.activeDungeonStage,
        this.wave,
        totalWaves,
        spawnIndex,
      );
      const spec = picked.spec;
      const baseCfg = ENEMY_ARCHETYPES[spec.archetype];
      const mult = getDungeonStageDifficultyMultipliers(
        this.activeDungeonId,
        this.activeDungeonStage,
        this.wave,
      );

      const eliteHpMult = picked.isElite && !picked.isBoss ? 1.25 : 1;
      const eliteDmgMult = picked.isElite && !picked.isBoss ? 1.15 : 1;
      const maxHp = Math.round(baseCfg.baseHp * spec.hpMult * mult.hpScale * eliteHpMult);
      const damage = Math.round(baseCfg.baseDamage * spec.damageMult * mult.damageScale * eliteDmgMult);
      const armor = Math.round(baseCfg.armor * spec.armorMult * mult.armorScale);

      const enemy: EnemyEntity = {
        id: this.nextEntityId++,
        archetype: spec.archetype,
        name: picked.isElite && !picked.isBoss ? `Elite ${spec.name}` : spec.name,
        isBoss: picked.isBoss,
        isElite: picked.isElite,
        ability: spec.ability,
        abilityTimer: 2 + Math.random() * 2,
        stunTimer: 0,
        shieldHp: spec.ability === 'shield' ? Math.round(maxHp * 0.35) : 0,
        x,
        y,
        vx: 0,
        vy: 0,
        hullAngle: faceAngle,
        turretAngle: faceAngle,
        hp: maxHp,
        maxHp,
        damage,
        attackSpeed: baseCfg.attackSpeed,
        armor,
        moveSpeed: Math.round(baseCfg.moveSpeed * spec.speedMult),
        preferredRange: baseCfg.preferredRange,
        radius: spec.radius,
        scrapReward: 0, // Stage 2C: rewards granted ONLY after successful completion
        xpReward: 0,
        fireCooldown: 0.7 + Math.random() * 0.7,
        recoil: 0,
        hitFlash: 0,
        trackOffset: 0,
        strafeSign: Math.random() < 0.5 ? 1 : -1,
        hullColor: spec.hullColor,
        hullAccent: picked.isElite ? '#facc15' : spec.hullAccent,
        turretColor: spec.turretColor,
        behavior: baseCfg.behavior,
      };

      this.enemies.push(enemy);
      this.spawnRingParticle(x, y, spec.radius + 18, enemy.hullAccent);
      this.spawnSmokePuff(x, y, 3);
      return;
    }

    const pick = this.pickCampaignEnemyArchetype(this.stage, this.wave, spawnIndex);
    const cfg = ENEMY_ARCHETYPES[pick.archetype];
    const mult = getStageDifficultyMultipliers(this.stage);

    const isMiniBoss = isMiniBossStage(this.stage) && spawnIndex === 0 && pick.archetype !== 'boss';
    const isElite = pick.isElite || isMiniBoss;

    const eliteVariants: EliteVariantId[] = ['armored', 'rapid', 'explosive', 'shield', 'artillery'];
    const eliteVariant = isElite && pick.archetype !== 'boss' && !isMiniBoss ? eliteVariants[(this.stage + spawnIndex) % eliteVariants.length] : undefined;
    const evCfg = eliteVariant ? ELITE_VARIANT_CONFIGS[eliteVariant] : undefined;

    const miniBossHpMult = isMiniBoss ? 2.4 : 1;
    const miniBossDmgMult = isMiniBoss ? 1.35 : 1;
    const eliteHpMult = evCfg ? evCfg.hpMult : isElite ? 1.45 : 1;
    const eliteDmgMult = evCfg ? evCfg.damageMult : isElite ? 1.2 : 1;
    const eliteArmorMult = evCfg ? evCfg.armorMult : isElite ? 1.2 : 1;
    const eliteSpeedMult = evCfg ? evCfg.speedMult : 1;
    const eliteScrapMult = evCfg ? evCfg.scrapMult : isElite ? 1.4 : 1;

    const maxHp = Math.round(cfg.baseHp * mult.hpScale * eliteHpMult * miniBossHpMult);
    const damage = Math.round(cfg.baseDamage * mult.damageScale * eliteDmgMult * miniBossDmgMult);
    const armor = Math.round(cfg.armor * mult.armorScale * eliteArmorMult);
    const scrapReward = Math.max(2, Math.round(cfg.baseScrapReward * mult.scrapScale * eliteScrapMult));
    const baseXp = pick.archetype === 'boss' ? 42 : isMiniBoss ? 24 : pick.archetype === 'heavy' ? 12 : 7;
    const xpReward = Math.round(baseXp * (1 + (this.stage - 1) * 0.14) * (isElite ? 1.5 : 1));

    let displayName = cfg.name;
    if (pick.archetype === 'boss') {
      displayName = getBossDisplayName(this.stage);
    } else if (isMiniBoss) {
      displayName = `Mini-Boss · ${cfg.name}`;
    } else if (evCfg) {
      displayName = `${evCfg.label} ${cfg.name}`;
    } else if (isElite) {
      displayName = `Elite ${cfg.name}`;
    }

    const enemy: EnemyEntity = {
      id: this.nextEntityId++,
      archetype: pick.archetype,
      name: displayName,
      isBoss: pick.archetype === 'boss',
      isElite,
      eliteVariant,
      isMiniBoss,
      bossPhase: pick.archetype === 'boss' ? 1 : undefined,
      bossMaxPhase: pick.archetype === 'boss' ? 3 : undefined,
      ability: pick.archetype === 'boss' ? 'shield' : pick.ability,
      abilityTimer: 2 + Math.random() * 2,
      stunTimer: 0,
      shieldHp: pick.archetype === 'boss' || pick.ability === 'shield' || eliteVariant === 'shield' ? Math.round(maxHp * 0.35) : 0,
      x,
      y,
      vx: 0,
      vy: 0,
      hullAngle: faceAngle,
      turretAngle: faceAngle,
      hp: maxHp,
      maxHp,
      damage,
      attackSpeed: cfg.attackSpeed * (evCfg ? evCfg.attackSpeedMult : 1),
      armor,
      moveSpeed: Math.round(cfg.moveSpeed * eliteSpeedMult),
      preferredRange: evCfg?.id === 'artillery' ? 280 : cfg.preferredRange,
      radius: isMiniBoss ? cfg.radius * 1.25 : cfg.radius,
      scrapReward,
      xpReward,
      fireCooldown: 0.7 + Math.random() * 0.7,
      recoil: 0,
      hitFlash: 0,
      trackOffset: 0,
      strafeSign: Math.random() < 0.5 ? 1 : -1,
      hullColor: evCfg ? evCfg.color : cfg.hullColor,
      hullAccent: isMiniBoss ? '#dc2626' : evCfg ? evCfg.accent : isElite ? '#facc15' : cfg.hullAccent,
      turretColor: cfg.turretColor,
      behavior: cfg.behavior,
    };

    this.enemies.push(enemy);
    this.spawnRingParticle(x, y, cfg.radius + 18, enemy.hullAccent);
    this.spawnSmokePuff(x, y, 3);
  }

  public step(rawDt: number): void {
    const dt = Math.min(0.05, Math.max(0, rawDt));
    if (this.paused || dt <= 0) return;

    this.patrolTime += dt;
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 28);
    }
    if (this.stageBannerTimer > 0) {
      this.stageBannerTimer = Math.max(0, this.stageBannerTimer - dt);
      if (this.stageBannerTimer === 0) {
        this.stageBannerText = null;
      }
    }

    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateScrapDrops(dt);
    this.updateScorches(dt);

    if (this.isRecovering) {
      this.recoveryTimer -= dt;
      if (Math.random() < 0.35) {
        this.spawnSpark(
          this.player.x + (Math.random() - 0.5) * 28,
          this.player.y + (Math.random() - 0.5) * 28,
          '#38bdf8',
        );
      }
      if (this.recoveryTimer <= 0) {
        this.isRecovering = false;
        this.recoveryTimer = 0;
        this.player.hp = this.player.maxHp;
        this.player.x = WORLD_WIDTH / 2;
        this.player.y = WORLD_HEIGHT / 2;
        this.startWave(this.stage, 1, true);
      }
      this.syncHudTick(dt);
      return;
    }

    if (this.waveTransitionTimer > 0) {
      this.waveTransitionTimer -= dt;
      this.updatePlayerIdleMotion(dt);
      if (this.waveTransitionTimer <= 0) {
        const totalWaves = this.getCurrentWavesPerStage();
        if (this.wave < totalWaves) {
          this.startWave(this.stage, this.wave + 1, true);
        } else if (this.mode === 'dungeon' && this.activeDungeonId) {
          if (!this.dungeonEndedFired) {
            this.dungeonEndedFired = true;
            const finishedId = this.activeDungeonId;
            const finishedStage = this.activeDungeonStage;
            this.callbacks.onDungeonEnded(finishedId, finishedStage, true, totalWaves, totalWaves);
          }
          return;
        } else {
          const nextStage = this.stage + 1;
          this.highestStage = Math.max(this.highestStage, nextStage);
          this.callbacks.onStageChanged(nextStage);
          this.startWave(nextStage, 1, true);
        }
      }
      this.syncHudTick(dt);
      return;
    }

    if (this.enemiesSpawnedInWave < this.enemiesTotalInWave) {
      this.spawnTimer -= dt;
      const totalWaves = this.getCurrentWavesPerStage();
      const isBossNow =
        this.mode === 'dungeon'
          ? this.wave === totalWaves
          : isBossStage(this.stage) && this.wave === WAVES_PER_STAGE;
      const maxSimultaneous = isBossNow ? 4 : 5;
      if (this.spawnTimer <= 0 && this.enemies.length < maxSimultaneous) {
        this.spawnNextEnemy();
        this.spawnTimer = 1.1;
      }
    }

    this.updatePlayer(dt);
    this.updateEquippedSkills(dt);
    this.updateSkillEntities(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);

    if (
      this.enemiesSpawnedInWave >= this.enemiesTotalInWave &&
      this.enemies.length === 0 &&
      this.waveTransitionTimer <= 0
    ) {
      if (this.mode === 'campaign') {
        const waveBonus = Math.round(
          getWaveClearBonus(this.stage, this.wave) * (1 + this.stats.scrapBonusRatio),
        );
        this.callbacks.onScrapCollected(waveBonus);
        this.spawnFloatingText(
          this.player.x,
          this.player.y - 42,
          `WAVE CLEAR +${waveBonus} SCRAP`,
          '#fbbf24',
          1.1,
        );
      } else {
        this.spawnFloatingText(
          this.player.x,
          this.player.y - 42,
          `WAVE ${this.wave} CLEARED`,
          '#38bdf8',
          1.1,
        );
      }
      soundFx.playWaveClear();
      this.waveTransitionTimer = 1.05;
      this.emitHudSnapshot();
      return;
    }

    this.syncHudTick(dt);
  }

  private syncHudTick(dt: number): void {
    this.hudSyncAccumulator += dt;
    if (this.hudSyncAccumulator >= 0.08) {
      this.hudSyncAccumulator = 0;
      this.emitHudSnapshot();
    }
  }

  // ---------------- TANK SKILLS SYSTEM ----------------

  private updateEquippedSkills(dt: number): void {
    // Active skill buff timers
    if (this.overdriveTimer > 0) {
      this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
      if (this.overdriveTimer === 0) {
        this.overdriveAttackBonus = 0;
        this.overdriveMoveBonus = 0;
      }
    }

    if (this.repairDroneTimer > 0) {
      this.repairDroneTimer = Math.max(0, this.repairDroneTimer - dt);
      const healAmount = this.repairDroneHealPerSec * dt;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
      this.repairDronePulseAcc += dt;
      if (this.repairDronePulseAcc >= this.repairDronePulseInterval) {
        this.repairDronePulseAcc = 0;
        this.spawnSpark(
          this.player.x + (Math.random() - 0.5) * 20,
          this.player.y + (Math.random() - 0.5) * 20,
          '#10b981',
        );
      }
    }

    for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
      const skillId = this.equippedSkillIds[i];
      if (!skillId) continue;
      const skillData = this.skillsState[skillId];
      if (!skillData || !skillData.unlocked) continue;

      const curCd = this.skillCooldowns[skillId] ?? 0;
      if (curCd > 0) {
        this.skillCooldowns[skillId] = Math.max(0, curCd - dt);
        continue;
      }

      if (this.autoSkillsEnabled && this.canActivateSkill(skillId, skillData.level)) {
        this.activateSkill(skillId, skillData.level);
        this.skillCooldowns[skillId] = getSkillCooldown(skillId, this.stats.skillHasteRatio);
      }
    }
  }

  private canActivateSkill(id: SkillId, level: number): boolean {
    const computed = getSkillComputedStats(id, level);

    if (id === 'repair_drone') {
      return this.player.hp < this.player.maxHp * 0.88 && this.repairDroneTimer <= 0;
    }

    if (id === 'overdrive') {
      return this.enemies.length > 0 && this.overdriveTimer <= 0;
    }

    if (id === 'emp_pulse') {
      const inRange = this.enemies.filter(
        (e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) <= computed.empRadius,
      );
      if (inRange.length >= 2) return true;
      return inRange.some(
        (e) => e.isBoss || Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 165,
      );
    }

    if (id === 'mine_deployment') {
      if (this.enemies.length === 0) return false;
      const nearby = this.enemies.some(
        (e) => Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 295,
      );
      return nearby || this.mines.length < Math.max(2, Math.floor(computed.maxActiveMines / 2));
    }

    if (id === 'rocket_salvo') {
      if (this.enemies.length >= 2) return true;
      return this.enemies.some(
        (e) => e.isBoss || Math.hypot(e.x - this.player.x, e.y - this.player.y) <= 320,
      );
    }

    return this.enemies.length > 0;
  }

  private pickClusterAnchors(): EnemyEntity[] {
    if (this.enemies.length === 0) return [];
    const scored = this.enemies.map((anchor) => {
      let neighbors = 0;
      for (const other of this.enemies) {
        if (Math.hypot(other.x - anchor.x, other.y - anchor.y) <= 115) {
          neighbors++;
        }
      }
      return { anchor, score: neighbors + (anchor.isBoss ? 0.5 : 0) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.anchor);
  }

  private activateSkill(id: SkillId, level: number): void {
    const computed = getSkillComputedStats(id, level);
    const def = SKILL_DEFINITIONS[id];
    soundFx.playSkill(id);
    this.callbacks.onSkillActivated?.(id);

    this.spawnFloatingText(
      this.player.x,
      this.player.y - 46,
      def.name.toUpperCase(),
      def.accentColor,
      0.92,
    );

    switch (id) {
      case 'missile_barrage': {
        const count = computed.projectileCount;
        const speed = 350;
        for (let m = 0; m < count; m++) {
          const target = this.enemies[m % this.enemies.length];
          const spreadAngle = this.player.turretAngle + (m - (count - 1) / 2) * 0.34;
          this.projectiles.push({
            id: this.nextEntityId++,
            owner: 'player',
            kind: 'missile',
            weaponKind: 'missile',
            targetId: target.id,
            turnRate: computed.homingTurnRate,
            x: this.player.x + Math.cos(spreadAngle) * 16,
            y: this.player.y + Math.sin(spreadAngle) * 16,
            prevX: this.player.x,
            prevY: this.player.y,
            vx: Math.cos(spreadAngle) * speed,
            vy: Math.sin(spreadAngle) * speed,
            angle: spreadAngle,
            speed,
            damage: Math.round(this.stats.attackDamage * computed.damageMult),
            isCrit: false,
            armorPen: this.stats.armorPenetrationRatio,
            splashRatio: 0.25,
            radius: 5,
            color: '#f59e0b',
            trailColor: 'rgba(251, 146, 60, 0.55)',
            life: 3.0,
          });
        }
        break;
      }

      case 'artillery_strike': {
        const anchors = this.pickClusterAnchors();
        const strikes = computed.shellCount;
        for (let s = 0; s < strikes; s++) {
          const anchor = anchors[s % anchors.length];
          const delay = 0.42 + s * 0.14;
          this.artilleryStrikes.push({
            x: clamp(anchor.x + (Math.random() - 0.5) * 44, 70, WORLD_WIDTH - 70),
            y: clamp(anchor.y + (Math.random() - 0.5) * 44, 70, WORLD_HEIGHT - 70),
            delay,
            maxDelay: delay,
            radius: computed.blastRadius,
            damage: Math.round(this.stats.attackDamage * computed.damageMult),
          });
        }
        break;
      }

      case 'mine_deployment': {
        const count = computed.deployCount;
        for (let m = 0; m < count; m++) {
          const ang = (Math.PI * 2 * m) / count + Math.random() * 0.25;
          const dist = 68 + Math.random() * 34;
          this.mines.push({
            x: clamp(this.player.x + Math.cos(ang) * dist, 50, WORLD_WIDTH - 50),
            y: clamp(this.player.y + Math.sin(ang) * dist, 50, WORLD_HEIGHT - 50),
            radius: 7,
            triggerRadius: 34,
            blastRadius: computed.blastRadius,
            damage: Math.round(this.stats.attackDamage * computed.damageMult),
            age: 0,
            maxAge: computed.mineDuration,
            armed: false,
          });
        }
        if (this.mines.length > computed.maxActiveMines) {
          this.mines.splice(0, this.mines.length - computed.maxActiveMines);
        }
        break;
      }

      case 'railgun_shot': {
        // Choose ray angle from player to enemy that pierces the most enemies along line
        let bestAngle = this.player.turretAngle;
        let bestHits: EnemyEntity[] = [];
        for (const candidate of this.enemies) {
          const ang = Math.atan2(candidate.y - this.player.y, candidate.x - this.player.x);
          const dirX = Math.cos(ang);
          const dirY = Math.sin(ang);
          const lineHits: { enemy: EnemyEntity; dist: number }[] = [];

          for (const e of this.enemies) {
            const vx = e.x - this.player.x;
            const vy = e.y - this.player.y;
            const proj = vx * dirX + vy * dirY;
            if (proj < 0) continue;
            const perpDist = Math.abs(vx * -dirY + vy * dirX);
            if (perpDist <= e.radius + computed.beamWidth * 0.75) {
              lineHits.push({ enemy: e, dist: proj });
            }
          }
          lineHits.sort((a, b) => a.dist - b.dist);
          if (lineHits.length > bestHits.length) {
            bestAngle = ang;
            bestHits = lineHits.map((h) => h.enemy);
          }
        }

        const dirX = Math.cos(bestAngle);
        const dirY = Math.sin(bestAngle);
        const startX = this.player.x + dirX * 26;
        const startY = this.player.y + dirY * 26;
        const beamLength = 780;
        const endX = startX + dirX * beamLength;
        const endY = startY + dirY * beamLength;

        this.player.turretAngle = bestAngle;
        this.player.recoil = 1;
        this.railgunBeams.push({
          x1: startX,
          y1: startY,
          x2: endX,
          y2: endY,
          width: computed.beamWidth,
          life: 0.34,
          maxLife: 0.34,
          color: '#c084fc',
        });
        if (!this.reducedMotion) this.screenShake = Math.max(this.screenShake, 5.5);

        const targetsToHit = bestHits.slice(0, computed.maxPierce);
        const rawDamage = Math.round(this.stats.attackDamage * computed.damageMult);
        for (const hitTarget of targetsToHit) {
          const idx = this.enemies.findIndex((e) => e.id === hitTarget.id);
          if (idx !== -1) {
            this.spawnHitSparks(hitTarget.x, hitTarget.y, '#c084fc', 9);
            this.spawnRingParticle(hitTarget.x, hitTarget.y, hitTarget.radius + 16, '#38bdf8');
            this.applyDamageToEnemy(idx, rawDamage, true, Math.max(this.stats.armorPenetrationRatio, computed.armorPen));
          }
        }
        break;
      }

      case 'repair_drone': {
        const duration = computed.duration;
        const totalHeal = this.player.maxHp * computed.healRatio;
        this.repairDroneTimer = duration;
        this.repairDroneHealPerSec = totalHeal / duration;
        this.repairDronePulseInterval = computed.pulseInterval;
        this.repairDronePulseAcc = 0;
        this.spawnRingParticle(this.player.x, this.player.y, 44, '#10b981');
        break;
      }

      case 'emp_pulse': {
        const empRadius = computed.empRadius;
        const stunDur = computed.stunDuration;
        this.particles.push({
          x: this.player.x,
          y: this.player.y,
          vx: 0,
          vy: 0,
          size: 16,
          endSize: empRadius,
          alpha: 0.95,
          life: 0.44,
          maxLife: 0.44,
          color: '#38bdf8',
          kind: 'emp',
          rotation: 0,
          vRot: 0,
        });

        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= empRadius + e.radius) {
            e.stunTimer = Math.max(e.stunTimer, stunDur);
            if (computed.armorShred > 0) {
              e.armor = Math.max(0, Math.round(e.armor * (1 - computed.armorShred)));
            }
            this.applyDamageToEnemy(
              i,
              Math.round(this.stats.attackDamage * computed.damageMult),
              false,
              0.25,
            );
          }
        }
        break;
      }

      case 'overdrive': {
        this.overdriveTimer = computed.duration;
        this.overdriveAttackBonus = computed.attackSpeedBonus;
        this.overdriveMoveBonus = computed.moveSpeedBonus;
        this.spawnRingParticle(this.player.x, this.player.y, 52, '#eab308');
        break;
      }

      case 'rocket_salvo': {
        const anchors = this.pickClusterAnchors();
        const totalRockets = computed.rocketCount;
        const rocketDmg = Math.round(this.stats.attackDamage * computed.damageMult);
        for (let r = 0; r < totalRockets; r++) {
          const anchor = anchors[r % anchors.length];
          this.rocketQueue.push({
            delay: r * 0.085,
            targetId: anchor.id,
            fallbackX: anchor.x,
            fallbackY: anchor.y,
            damage: rocketDmg,
            splashRadius: computed.splashRadius,
          });
        }
        break;
      }
    }
  }

  private launchSalvoRocket(shot: QueuedRocketShot): void {
    const target =
      (shot.targetId !== null ? this.enemies.find((e) => e.id === shot.targetId) : undefined) ??
      this.enemies[0];
    const tx = target ? target.x : shot.fallbackX;
    const ty = target ? target.y : shot.fallbackY;
    const angle = Math.atan2(ty - this.player.y, tx - this.player.x) + (Math.random() - 0.5) * 0.14;
    const speed = 440;
    const sx = this.player.x + Math.cos(angle) * 20;
    const sy = this.player.y + Math.sin(angle) * 20;

    this.projectiles.push({
      id: this.nextEntityId++,
      owner: 'player',
      kind: 'rocket',
      weaponKind: 'rocket',
      targetId: target?.id,
      splashRadius: shot.splashRadius,
      x: sx,
      y: sy,
      prevX: sx,
      prevY: sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      speed,
      damage: shot.damage,
      isCrit: false,
      armorPen: Math.max(0.2, this.stats.armorPenetrationRatio),
      splashRatio: 0.75,
      radius: 5.5,
      color: '#d97706',
      trailColor: 'rgba(217, 119, 6, 0.48)',
      life: 2.1,
    });
    this.spawnMuzzleFlash(sx, sy, angle, '#fbbf24');
  }

  private updateSkillEntities(dt: number): void {
    // Artillery strikes
    for (let i = this.artilleryStrikes.length - 1; i >= 0; i--) {
      const a = this.artilleryStrikes[i];
      a.delay -= dt;
      if (a.delay <= 0) {
        this.spawnExplosion(a.x, a.y, 1.35);
        soundFx.playExplosion(false);
        if (!this.reducedMotion) this.screenShake = Math.max(this.screenShake, 5);
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = this.enemies[eIdx];
          if (Math.hypot(e.x - a.x, e.y - a.y) <= a.radius + e.radius) {
            this.applyDamageToEnemy(eIdx, a.damage, false, 0.2);
          }
        }
        this.artilleryStrikes.splice(i, 1);
      }
    }

    // Proximity Mines (with timed expiry)
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.age += dt;
      if (m.age >= m.maxAge) {
        this.spawnSmokePuff(m.x, m.y, 1);
        this.mines.splice(i, 1);
        continue;
      }
      if (m.age >= 0.35) m.armed = true;
      if (!m.armed) continue;

      let triggered = false;
      for (const e of this.enemies) {
        if (Math.hypot(e.x - m.x, e.y - m.y) <= m.triggerRadius + e.radius) {
          triggered = true;
          break;
        }
      }
      if (triggered) {
        this.spawnExplosion(m.x, m.y, 1.12);
        soundFx.playExplosion(false);
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const e = this.enemies[eIdx];
          if (Math.hypot(e.x - m.x, e.y - m.y) <= m.blastRadius + e.radius) {
            this.applyDamageToEnemy(eIdx, m.damage, false, 0.15);
          }
        }
        this.mines.splice(i, 1);
      }
    }

    // Railgun Beams fadeout
    for (let i = this.railgunBeams.length - 1; i >= 0; i--) {
      const beam = this.railgunBeams[i];
      beam.life -= dt;
      if (beam.life <= 0) {
        this.railgunBeams.splice(i, 1);
      }
    }

    // Staggered Rocket Salvo Launcher Queue
    for (let i = this.rocketQueue.length - 1; i >= 0; i--) {
      const shot = this.rocketQueue[i];
      shot.delay -= dt;
      if (shot.delay <= 0) {
        this.launchSalvoRocket(shot);
        this.rocketQueue.splice(i, 1);
      }
    }
  }

  // ---------------- PLAYER & ENEMY UPDATES ----------------

  private updatePlayerIdleMotion(dt: number): void {
    const moveMult = this.overdriveTimer > 0 ? 1 + this.overdriveMoveBonus : 1;
    const patrolPhase = this.patrolTime * moveMult;
    const homeX = WORLD_WIDTH / 2 + Math.cos(patrolPhase * 0.45) * (24 * Math.min(1.5, moveMult));
    const homeY = WORLD_HEIGHT / 2 + Math.sin(patrolPhase * 0.65) * (18 * Math.min(1.5, moveMult));
    const dx = homeX - this.player.x;
    const dy = homeY - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
      const speed = Math.min(44 * moveMult, dist * 2 * moveMult);
      this.player.vx = (dx / dist) * speed;
      this.player.vy = (dy / dist) * speed;
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
      this.player.hullAngle = rotateToward(
        this.player.hullAngle,
        Math.atan2(dy, dx),
        dt * 2.2 * moveMult,
      );
      this.player.trackOffset = (this.player.trackOffset + speed * dt * 0.7) % 14;
    }
    this.player.recoil = Math.max(0, this.player.recoil - dt * 5.5);
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt * 6);
  }

  private updatePlayer(dt: number): void {
    if (this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.006 * dt);
    }

    this.updatePlayerIdleMotion(dt);

    let target: EnemyEntity | null = null;
    if (this.manualTargetId !== null) {
      target = this.enemies.find((e) => e.id === this.manualTargetId) ?? null;
      if (!target) this.manualTargetId = null;
    }

    if (!target && this.enemies.length > 0) {
      let bestScore = Infinity;
      for (const enemy of this.enemies) {
        const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
        const bossPriority = enemy.isBoss ? 0.88 : 1;
        const score = dist * bossPriority;
        if (score < bestScore) {
          bestScore = score;
          target = enemy;
        }
      }
    }

    this.player.targetId = target ? target.id : null;
    this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);

    if (target) {
      const aimAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      this.player.targetTurretAngle = aimAngle;
      this.player.turretAngle = rotateToward(this.player.turretAngle, aimAngle, dt * 6.5);

      const aimDiff = Math.abs(normalizeAngle(aimAngle - this.player.turretAngle));
      if (aimDiff < 0.22 && this.player.fireCooldown <= 0) {
        this.firePlayerWeapon();
      }
    } else {
      this.player.turretAngle = rotateToward(
        this.player.turretAngle,
        this.player.hullAngle + Math.sin(this.patrolTime * 1.1) * 0.4,
        dt * 2,
      );
    }
  }

  private firePlayerWeapon(): void {
    const overdriveMult = this.overdriveTimer > 0 ? 1 + this.overdriveAttackBonus : 1;
    const effectiveAttackSpeed = Math.max(0.25, this.stats.attackSpeed * overdriveMult);
    this.player.fireCooldown = 1 / effectiveAttackSpeed;
    this.player.recoil = 1;

    const muzzleDist = 30;
    const mx = this.player.x + Math.cos(this.player.turretAngle) * muzzleDist;
    const my = this.player.y + Math.sin(this.player.turretAngle) * muzzleDist;

    const isCrit = Math.random() < this.stats.critChance;
    const rawDamage = isCrit
      ? Math.round(this.stats.attackDamage * this.stats.critDamage)
      : this.stats.attackDamage;

    const speed = 560;
    const isHeavy = this.stats.attackDamage >= 45 || this.stats.attackSpeed < 0.85;
    this.projectiles.push({
      id: this.nextEntityId++,
      owner: 'player',
      kind: 'shell',
      weaponKind: isHeavy ? 'heavy' : 'standard',
      x: mx,
      y: my,
      prevX: mx,
      prevY: my,
      vx: Math.cos(this.player.turretAngle) * speed,
      vy: Math.sin(this.player.turretAngle) * speed,
      angle: this.player.turretAngle,
      speed,
      damage: rawDamage,
      isCrit,
      armorPen: this.stats.armorPenetrationRatio,
      splashRatio: this.stats.splashDamageRatio,
      radius: isCrit ? 6 : 4.5,
      color: this.overdriveTimer > 0 ? '#facc15' : isCrit ? '#fbbf24' : '#f59e0b',
      trailColor: isCrit ? 'rgba(250, 204, 21, 0.45)' : 'rgba(245, 158, 11, 0.38)',
      life: 1.8,
    });

    this.spawnMuzzleFlash(mx, my, this.player.turretAngle, isCrit ? '#fde047' : '#fbbf24');
    soundFx.playPlayerShot();
  }

  private updateEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      enemy.recoil = Math.max(0, enemy.recoil - dt * 4.5);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 6.5);

      // EMP Stun disables movement and firing
      if (enemy.stunTimer > 0) {
        enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
        if (Math.random() < 0.28) {
          this.spawnSpark(
            enemy.x + (Math.random() - 0.5) * enemy.radius,
            enemy.y + (Math.random() - 0.5) * enemy.radius,
            '#38bdf8',
          );
        }
        continue;
      }

      // Experimental enemy abilities
      let speedMult = 1;
      if (enemy.ability !== 'none') {
        enemy.abilityTimer -= dt;
        if (enemy.ability === 'surge' && enemy.abilityTimer <= 1.2) {
          speedMult = 1.65;
          if (enemy.abilityTimer <= 0) enemy.abilityTimer = 4.2;
        } else if (enemy.ability === 'shield' && enemy.abilityTimer <= 0) {
          enemy.abilityTimer = enemy.isBoss ? 11.0 : 7.5;
          const cap = Math.round(enemy.maxHp * (enemy.isBoss ? 0.22 : 0.3));
          const gain = Math.round(enemy.maxHp * (enemy.isBoss ? 0.08 : 0.15));
          enemy.shieldHp = Math.min(cap, enemy.shieldHp + gain);
          this.spawnRingParticle(enemy.x, enemy.y, enemy.radius + 14, '#22d3ee');
        }
      }

      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const dirX = dx / dist;
      const dirY = dy / dist;

      let sepX = 0;
      let sepY = 0;
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j) continue;
        const other = this.enemies[j];
        const sx = enemy.x - other.x;
        const sy = enemy.y - other.y;
        const sDist = Math.hypot(sx, sy);
        const minSpace = enemy.radius + other.radius + 14;
        if (sDist > 0.1 && sDist < minSpace) {
          const push = ((minSpace - sDist) / minSpace) * 85;
          sepX += (sx / sDist) * push;
          sepY += (sy / sDist) * push;
        }
      }

      let moveX = 0;
      let moveY = 0;
      const curMoveSpeed = enemy.moveSpeed * speedMult;

      if (dist > enemy.preferredRange + 16) {
        moveX = dirX * curMoveSpeed;
        moveY = dirY * curMoveSpeed;
      } else if (dist < enemy.preferredRange - 24) {
        moveX = -dirX * curMoveSpeed * 0.45;
        moveY = -dirY * curMoveSpeed * 0.45;
      }

      const strafeFactor =
        enemy.behavior === 'flank'
          ? 0.8
          : enemy.behavior === 'rush'
            ? 0.35
            : enemy.behavior === 'command'
              ? 0.25
              : 0.4;
      if (dist <= enemy.preferredRange + 75) {
        moveX += -dirY * curMoveSpeed * strafeFactor * enemy.strafeSign;
        moveY += dirX * curMoveSpeed * strafeFactor * enemy.strafeSign;
      }

      enemy.vx = moveX + sepX;
      enemy.vy = moveY + sepY;

      const speedMag = Math.hypot(enemy.vx, enemy.vy);
      if (speedMag > 4) {
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.x = clamp(enemy.x, 42, WORLD_WIDTH - 42);
        enemy.y = clamp(enemy.y, 42, WORLD_HEIGHT - 42);
        const targetHull = Math.atan2(enemy.vy, enemy.vx);
        enemy.hullAngle = rotateToward(enemy.hullAngle, targetHull, dt * 3.1);
        enemy.trackOffset = (enemy.trackOffset + speedMag * dt * 0.65) % 14;
      }

      const aimAngle = Math.atan2(dy, dx);
      enemy.turretAngle = rotateToward(enemy.turretAngle, aimAngle, dt * (enemy.isBoss ? 2.4 : 3.6));

      if (dist <= enemy.preferredRange + 95 && enemy.fireCooldown <= 0) {
        const aimErr = Math.abs(normalizeAngle(aimAngle - enemy.turretAngle));
        if (aimErr < 0.26) {
          this.fireEnemyWeapon(enemy);
        }
      }
    }
  }

  private fireEnemyWeapon(enemy: EnemyEntity): void {
    enemy.fireCooldown = 1 / Math.max(0.2, enemy.attackSpeed);
    enemy.recoil = 1;

    const isPlasma = enemy.ability === 'plasma';

    if (enemy.isBoss) {
      const offsets = [-9, 9];
      const perpX = -Math.sin(enemy.turretAngle);
      const perpY = Math.cos(enemy.turretAngle);
      for (const side of offsets) {
        const mx = enemy.x + Math.cos(enemy.turretAngle) * (enemy.radius + 10) + perpX * side;
        const my = enemy.y + Math.sin(enemy.turretAngle) * (enemy.radius + 10) + perpY * side;
        const speed = 350;
        this.projectiles.push({
          id: this.nextEntityId++,
          owner: 'enemy',
          kind: isPlasma ? 'plasma' : 'shell',
          weaponKind: isPlasma ? 'plasma' : 'enemy',
          x: mx,
          y: my,
          prevX: mx,
          prevY: my,
          vx: Math.cos(enemy.turretAngle) * speed,
          vy: Math.sin(enemy.turretAngle) * speed,
          angle: enemy.turretAngle,
          speed,
          damage: Math.round(enemy.damage * 0.62),
          isCrit: false,
          armorPen: isPlasma ? 0.3 : 0,
          splashRatio: 0,
          radius: 5,
          color: '#f97316',
          trailColor: 'rgba(249, 115, 22, 0.4)',
          life: 2.3,
        });
        this.spawnMuzzleFlash(mx, my, enemy.turretAngle, '#f97316');
      }
      return;
    }

    const mx = enemy.x + Math.cos(enemy.turretAngle) * (enemy.radius + 8);
    const my = enemy.y + Math.sin(enemy.turretAngle) * (enemy.radius + 8);
    const speed = enemy.archetype === 'light' ? 390 : enemy.archetype === 'heavy' ? 310 : 350;

    this.projectiles.push({
      id: this.nextEntityId++,
      owner: 'enemy',
      kind: isPlasma ? 'plasma' : 'shell',
      weaponKind: isPlasma ? 'plasma' : 'enemy',
      x: mx,
      y: my,
      prevX: mx,
      prevY: my,
      vx: Math.cos(enemy.turretAngle) * speed,
      vy: Math.sin(enemy.turretAngle) * speed,
      angle: enemy.turretAngle,
      speed,
      damage: enemy.damage,
      isCrit: false,
      armorPen: isPlasma ? 0.28 : 0,
      splashRatio: 0,
      radius: enemy.archetype === 'heavy' ? 5 : 3.8,
      color: isPlasma ? '#38bdf8' : '#ef4444',
      trailColor: isPlasma ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.36)',
      life: 2.2,
    });
    this.spawnMuzzleFlash(mx, my, enemy.turretAngle, isPlasma ? '#38bdf8' : '#fb923c');
  }

  private applyDamageToEnemy(
    enemyIndex: number,
    rawDamage: number,
    isCrit: boolean,
    armorPen: number,
  ): number {
    const enemy = this.enemies[enemyIndex];
    if (!enemy) return 0;

    let finalDamage = calculateMitigatedDamage(rawDamage, enemy.armor, armorPen);
    if (enemy.shieldHp > 0) {
      const absorbed = Math.min(enemy.shieldHp, finalDamage);
      enemy.shieldHp -= absorbed;
      finalDamage -= absorbed;
    }
    enemy.hp -= finalDamage;
    enemy.hitFlash = 1;

    if (enemy.isBoss && enemy.bossPhase && enemy.bossMaxPhase) {
      const ratio = enemy.hp / enemy.maxHp;
      if (enemy.bossPhase === 1 && ratio <= 0.70) {
        enemy.bossPhase = 2;
        enemy.damage = Math.round(enemy.damage * 1.15);
        enemy.shieldHp += Math.round(enemy.maxHp * 0.25);
        this.spawnRingParticle(enemy.x, enemy.y, enemy.radius + 20, '#f59e0b');
      } else if (enemy.bossPhase === 2 && ratio <= 0.35) {
        enemy.bossPhase = 3;
        enemy.damage = Math.round(enemy.damage * 1.25);
        enemy.attackSpeed *= 1.3;
        this.spawnRingParticle(enemy.x, enemy.y, enemy.radius + 22, '#dc2626');
      }
    }

    soundFx.playHit(isCrit);
    this.spawnFloatingText(
      enemy.x + (Math.random() - 0.5) * 14,
      enemy.y - enemy.radius - 6,
      isCrit ? `CRIT -${finalDamage}` : `-${finalDamage}`,
      isCrit ? '#fbbf24' : '#f8fafc',
      isCrit ? 1.18 : 0.92,
    );

    if (enemy.hp <= 0) {
      this.handleEnemyDestroyed(enemyIndex);
    }
    return finalDamage;
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p) continue;

      // Homing missile steering & rocket trails
      if (p.kind === 'missile') {
        let target = p.targetId ? this.enemies.find((e) => e.id === p.targetId) : undefined;
        if (!target && this.enemies.length > 0) {
          target = this.enemies[0];
          p.targetId = target.id;
        }
        if (target) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x);
          p.angle = rotateToward(p.angle, desired, dt * (p.turnRate ?? 6.5));
          p.vx = Math.cos(p.angle) * p.speed;
          p.vy = Math.sin(p.angle) * p.speed;
        }
        if (Math.random() < 0.65) {
          this.particles.push({
            x: p.x,
            y: p.y,
            vx: -p.vx * 0.08,
            vy: -p.vy * 0.08,
            size: 3.5,
            endSize: 8,
            alpha: 0.45,
            life: 0.25,
            maxLife: 0.25,
            color: '#94a3b8',
            kind: 'smoke',
            rotation: 0,
            vRot: 0,
          });
        }
      } else if (p.kind === 'rocket' && Math.random() < 0.75) {
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: -p.vx * 0.06,
          vy: -p.vy * 0.06,
          size: 4,
          endSize: 1.5,
          alpha: 0.7,
          life: 0.18,
          maxLife: 0.18,
          color: '#f472b6',
          kind: 'flame',
          rotation: 0,
          vRot: 0,
        });
      }

      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0 || p.x < -40 || p.x > WORLD_WIDTH + 40 || p.y < -40 || p.y > WORLD_HEIGHT + 40) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.owner === 'player') {
        let hitEnemyIndex = -1;
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          const dist = Math.hypot(p.x - e.x, p.y - e.y);
          if (dist <= e.radius + p.radius) {
            hitEnemyIndex = j;
            break;
          }
        }
        if (hitEnemyIndex !== -1) {
          const hitEnemy = this.enemies[hitEnemyIndex];
          const hitId = hitEnemy.id;
          if (p.kind === 'rocket') {
            this.spawnExplosion(p.x, p.y, 0.95);
            soundFx.playExplosion(false);
          } else {
            this.spawnHitSparks(p.x, p.y, p.isCrit ? '#facc15' : p.color, p.isCrit ? 10 : 6);
          }
          if (p.isCrit) {
            this.spawnRingParticle(p.x, p.y, 26, '#facc15');
            if (!this.reducedMotion) {
              this.screenShake = Math.max(this.screenShake, 3.2);
            }
          }

          this.applyDamageToEnemy(hitEnemyIndex, p.damage, p.isCrit, p.armorPen);

          // Splash passive, missile splash, or rocket salvo blast radius
          if (p.splashRatio > 0) {
            const splashDmg = Math.max(1, Math.round(p.damage * p.splashRatio));
            const splashRad = p.splashRadius ?? 68;
            for (let sIdx = this.enemies.length - 1; sIdx >= 0; sIdx--) {
              const other = this.enemies[sIdx];
              if (!other || other.id === hitId) continue;
              if (Math.hypot(other.x - p.x, other.y - p.y) <= splashRad + other.radius) {
                this.applyDamageToEnemy(sIdx, splashDmg, false, p.armorPen);
              }
            }
          }

          this.projectiles.splice(i, 1);
        }
      } else {
        const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (dist <= this.player.radius + p.radius) {
          const finalDamage = calculateMitigatedDamage(p.damage, this.stats.armor, p.armorPen);
          this.player.hp = Math.max(0, this.player.hp - finalDamage);
          this.player.hitFlash = 1;

          this.spawnHitSparks(p.x, p.y, p.color, 5);
          this.spawnFloatingText(
            this.player.x + (Math.random() - 0.5) * 16,
            this.player.y - this.player.radius - 8,
            `-${finalDamage}`,
            '#fca5a5',
            0.88,
          );
          this.projectiles.splice(i, 1);

          if (this.player.hp <= 0 && !this.isRecovering) {
            this.triggerPlayerRecovery();
            return;
          }
        }
      }
    }
  }

  private handleEnemyDestroyed(index: number): void {
    const enemy = this.enemies[index];
    if (!enemy) return;
    this.enemies.splice(index, 1);
    this.enemiesDefeatedInWave++;
    this.totalKills++;
    this.callbacks.onKillRecorded();
    if (enemy.isBoss) {
      this.callbacks.onBossDefeated?.(this.mode === 'dungeon');
    }
    if (enemy.xpReward > 0) {
      this.callbacks.onXpGained(enemy.xpReward);
    }

    // Vampiric shells passive heal on kill
    if (this.stats.lifestealOnKillRatio > 0) {
      const heal = Math.max(1, Math.round(this.player.maxHp * this.stats.lifestealOnKillRatio));
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    }

    if (this.manualTargetId === enemy.id) {
      this.manualTargetId = null;
    }

    this.spawnExplosion(enemy.x, enemy.y, enemy.isBoss ? 1.85 : enemy.archetype === 'heavy' ? 1.25 : 1);
    soundFx.playExplosion(enemy.isBoss);
    if (!this.reducedMotion) {
      this.screenShake = Math.max(this.screenShake, enemy.isBoss ? 9 : 4.5);
    }

    if (this.mode === 'campaign' && enemy.scrapReward > 0) {
      const totalScrap = Math.max(
        1,
        Math.round(enemy.scrapReward * (1 + this.stats.scrapBonusRatio)),
      );
      const pieceCount = enemy.isBoss ? 8 : 3;
      const basePiece = Math.floor(totalScrap / pieceCount);
      let remainder = totalScrap - basePiece * pieceCount;
      for (let k = 0; k < pieceCount; k++) {
        const pieceAmt = basePiece + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        if (pieceAmt <= 0) continue;

        const angle = Math.random() * Math.PI * 2;
        const spd = 55 + Math.random() * 85;
        this.scrapDrops.push({
          id: this.nextEntityId++,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          amount: pieceAmt,
          age: 0,
          collected: false,
          rotation: Math.random() * Math.PI * 2,
        });
      }

      this.spawnFloatingText(
        enemy.x,
        enemy.y - enemy.radius - 18,
        `+${totalScrap} SCRAP`,
        '#f59e0b',
        enemy.isBoss ? 1.25 : 0.95,
      );
    }
  }

  private triggerPlayerRecovery(): void {
    if (this.mode === 'dungeon' && this.activeDungeonId) {
      const finishedId = this.activeDungeonId;
      const finishedStage = this.activeDungeonStage;
      const totalWaves = this.getCurrentWavesPerStage();
      const cleared = Math.max(0, this.wave - 1);
      this.projectiles = [];
      this.spawnExplosion(this.player.x, this.player.y, 1.4);
      soundFx.playExplosion(true);
      if (!this.dungeonEndedFired) {
        this.dungeonEndedFired = true;
        this.callbacks.onDungeonEnded(finishedId, finishedStage, false, cleared, totalWaves);
      }
      return;
    }

    this.isRecovering = true;
    this.recoveryTimer = 2.4;
    this.projectiles = [];
    this.spawnExplosion(this.player.x, this.player.y, 1.4);
    soundFx.playExplosion(true);
    this.spawnFloatingText(
      this.player.x,
      this.player.y - 40,
      'HULL BREACH · REPAIRING',
      '#f87171',
      1.15,
    );
    this.emitHudSnapshot();
  }

  private spawnMuzzleFlash(x: number, y: number, angle: number, color: string): void {
    for (let i = 0; i < 4; i++) {
      const spread = (Math.random() - 0.5) * 0.45;
      const spd = 80 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle + spread) * spd,
        vy: Math.sin(angle + spread) * spd,
        size: 5 + Math.random() * 4,
        endSize: 1,
        alpha: 0.95,
        life: 0.14,
        maxLife: 0.14,
        color,
        kind: 'flame',
        rotation: 0,
        vRot: 0,
      });
    }
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * 24,
      vy: Math.sin(angle) * 24,
      size: 6,
      endSize: 16,
      alpha: 0.35,
      life: 0.42,
      maxLife: 0.42,
      color: '#94a3b8',
      kind: 'smoke',
      rotation: Math.random() * Math.PI * 2,
      vRot: 1,
    });
  }

  private spawnHitSparks(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2.5 + Math.random() * 2,
        endSize: 0.5,
        alpha: 1,
        life: 0.22 + Math.random() * 0.14,
        maxLife: 0.36,
        color,
        kind: 'spark',
        rotation: angle,
        vRot: 0,
      });
    }
  }

  private spawnSpark(x: number, y: number, color: string): void {
    const angle = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 60;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      size: 2.5,
      endSize: 0.5,
      alpha: 1,
      life: 0.28,
      maxLife: 0.28,
      color,
      kind: 'spark',
      rotation: angle,
      vRot: 0,
    });
  }

  private spawnSmokePuff(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 15 + Math.random() * 30;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 10,
        endSize: 26,
        alpha: 0.45,
        life: 0.65,
        maxLife: 0.65,
        color: '#64748b',
        kind: 'smoke',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2,
      });
    }
  }

  private spawnRingParticle(x: number, y: number, maxRadius: number, color: string): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 8,
      endSize: maxRadius,
      alpha: 0.9,
      life: 0.32,
      maxLife: 0.32,
      color,
      kind: 'ring',
      rotation: 0,
      vRot: 0,
    });
  }

  private spawnExplosion(x: number, y: number, scale: number): void {
    this.scorches.push({
      x,
      y,
      radius: 22 * scale,
      alpha: 0.48,
      rotation: Math.random() * Math.PI * 2,
    });
    if (this.scorches.length > 22) {
      this.scorches.shift();
    }

    this.spawnRingParticle(x, y, 52 * scale, '#facc15');
    this.spawnRingParticle(x, y, 36 * scale, '#f97316');

    const flameColors = ['#fef3c7', '#fbbf24', '#ea580c', '#dc2626'];
    const flameCount = Math.min(18, Math.round(12 * scale));
    for (let i = 0; i < flameCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (32 + Math.random() * 95) * scale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: (8 + Math.random() * 9) * scale,
        endSize: 2,
        alpha: 0.9,
        life: 0.24 + Math.random() * 0.2,
        maxLife: 0.44,
        color: flameColors[i % flameColors.length],
        kind: 'flame',
        rotation: 0,
        vRot: 0,
      });
    }

    const debrisCount = Math.min(12, Math.round(8 * scale));
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (65 + Math.random() * 135) * scale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 4 + Math.random() * 3.5,
        endSize: 2.5,
        alpha: 1,
        life: 0.42 + Math.random() * 0.28,
        maxLife: 0.7,
        color: i % 3 === 0 ? '#52525b' : i % 2 === 0 ? '#b45309' : '#9ca3af',
        kind: 'debris',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
      });
    }

    const smokeCount = Math.min(8, Math.round(5 * scale));
    for (let i = 0; i < smokeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 12 + Math.random() * 26;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 11 * scale,
        endSize: 28 * scale,
        alpha: 0.36,
        life: 0.65 + Math.random() * 0.3,
        maxLife: 0.95,
        color: '#64748b',
        kind: 'smoke',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 1.5,
      });
    }
  }

  private spawnFloatingText(_x: number, _y: number, _text: string, _color: string, _scale = 1): void {
    // Intentionally disabled so no hovering letters clutter the battlefield
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.rotation += p.vRot * dt;
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= 0.96;
    }
  }

  private updateScrapDrops(dt: number): void {
    for (let i = this.scrapDrops.length - 1; i >= 0; i--) {
      const s = this.scrapDrops[i];
      s.age += dt;
      s.rotation += dt * 4;

      if (s.age < 0.28) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.9;
        s.vy *= 0.9;
      } else {
        const dx = this.player.x - s.x;
        const dy = this.player.y - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 22) {
          this.callbacks.onScrapCollected(s.amount);
          this.scrapDrops.splice(i, 1);
          continue;
        }
        const pullSpeed = 280 + s.age * 360;
        s.x += (dx / dist) * pullSpeed * dt;
        s.y += (dy / dist) * pullSpeed * dt;
      }
    }
  }

  private updateScorches(dt: number): void {
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      this.scorches[i].alpha -= dt * 0.022;
      if (this.scorches[i].alpha <= 0.02) {
        this.scorches.splice(i, 1);
      }
    }
  }

  public getHudSnapshot(): BattleHudSnapshot {
    const boss = this.enemies.find((e) => e.isBoss) ?? this.enemies.find((e) => e.isMiniBoss) ?? null;
    const theme = this.getActiveTheme();
    const totalWaves = this.getCurrentWavesPerStage();

    const skillCooldowns: SkillCooldownSnapshot[] = [];
    for (const id of this.equippedSkillIds) {
      if (!id) continue;
      const total = getSkillCooldown(id, this.stats.skillHasteRatio);
      const rem = this.skillCooldowns[id] ?? 0;
      const activeRemaining =
        id === 'overdrive'
          ? this.overdriveTimer
          : id === 'repair_drone'
            ? this.repairDroneTimer
            : 0;
      skillCooldowns.push({
        id,
        cooldownRemaining: rem,
        cooldownTotal: total,
        activeRemaining,
      });
    }

    return {
      mode: this.mode,
      activeDungeonId: this.activeDungeonId,
      activeDungeonName:
        this.mode === 'dungeon' && this.activeDungeonId
          ? DUNGEON_CONFIGS[this.activeDungeonId].name
          : null,
      dungeonStage: this.mode === 'dungeon' ? this.activeDungeonStage : 0,
      stage: this.stage,
      wave: this.wave,
      wavesPerStage: totalWaves,
      stageThemeName: theme.name,
      isBossWave:
        this.mode === 'dungeon'
          ? this.wave === totalWaves
          : isBossStage(this.stage) && this.wave === WAVES_PER_STAGE,
      bossName: boss ? boss.name : null,
      bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
      bossMaxHp: boss ? boss.maxHp : 0,
      bossPhase: boss?.bossPhase,
      bossMaxPhase: boss?.bossMaxPhase ?? 3,
      bossTitle: boss?.isBoss ? `Boss · Phase ${boss.bossPhase ?? 1}` : boss?.isMiniBoss ? 'Mini-Boss' : null,
      enemiesRemaining: Math.max(0, this.enemiesTotalInWave - this.enemiesDefeatedInWave),
      enemiesTotalInWave: this.enemiesTotalInWave,
      enemiesDefeatedInWave: this.enemiesDefeatedInWave,
      playerHp: Math.max(0, Math.round(this.player.hp)),
      playerMaxHp: Math.round(this.player.maxHp),
      isRecovering: this.isRecovering,
      recoveryTimer: Math.max(0, this.recoveryTimer),
      waveTransitionTimer: Math.max(0, this.waveTransitionTimer),
      stageBannerText: this.stageBannerText,
      stageBannerTimer: this.stageBannerTimer,
      totalKills: this.totalKills,
      highestStage: this.highestStage,
      skillCooldowns,
      autoSkillsEnabled: this.autoSkillsEnabled,
      overdriveActive: this.overdriveTimer > 0,
      repairDroneActive: this.repairDroneTimer > 0,
    };
  }

  private emitHudSnapshot(): void {
    this.callbacks.onHudUpdate(this.getHudSnapshot());
  }

  private ensureTerrainCache(): void {
    const theme = this.getActiveTheme();
    if (this.terrainCanvas && this.terrainThemeId === theme.id) return;

    this.terrainThemeId = theme.id;
    const offscreen = document.createElement('canvas');
    offscreen.width = WORLD_WIDTH;
    offscreen.height = WORLD_HEIGHT;
    const tctx = offscreen.getContext('2d');
    if (!tctx) return;

    tctx.fillStyle = theme.groundBase;
    tctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Matte military-industrial terrain slabs with subtle surface wear
    const slabSize = 90;
    for (let x = 0; x < WORLD_WIDTH; x += slabSize) {
      for (let y = 0; y < WORLD_HEIGHT; y += slabSize) {
        const ix = x / slabSize;
        const iy = y / slabSize;
        const checker = (ix + iy) % 2 === 0;
        tctx.fillStyle = checker ? theme.groundBase : theme.groundAccent;
        tctx.fillRect(x, y, slabSize, slabSize);

        tctx.strokeStyle = theme.gridColor;
        tctx.lineWidth = 1;
        tctx.strokeRect(x + 0.5, y + 0.5, slabSize - 1, slabSize - 1);

        const hash = (ix * 7 + iy * 13) % 6;
        if (hash === 0) {
          tctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
          tctx.fillRect(x + 12, y + 12, slabSize - 24, slabSize - 24);
        } else if (hash === 3) {
          tctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
          tctx.lineWidth = 1;
          tctx.beginPath();
          tctx.moveTo(x + 18, y + 18);
          tctx.lineTo(x + slabSize - 18, y + slabSize - 18);
          tctx.stroke();
        }

        // Subtle concrete/steel corner rivets
        tctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        tctx.fillRect(x + 5, y + 5, 2, 2);
        tctx.fillRect(x + slabSize - 7, y + slabSize - 7, 2, 2);
      }
    }

    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;

    // Cross-arena tactical range axis lines
    tctx.strokeStyle = 'rgba(161, 161, 170, 0.07)';
    tctx.lineWidth = 1.5;
    tctx.beginPath();
    tctx.moveTo(40, cy);
    tctx.lineTo(WORLD_WIDTH - 40, cy);
    tctx.moveTo(cx, 40);
    tctx.lineTo(cx, WORLD_HEIGHT - 40);
    tctx.stroke();

    // Central sector range rings (matte tactical markings)
    tctx.strokeStyle = 'rgba(161, 161, 170, 0.14)';
    tctx.lineWidth = 1.5;
    tctx.beginPath();
    tctx.arc(cx, cy, 84, 0, Math.PI * 2);
    tctx.stroke();

    tctx.strokeStyle = theme.borderHazard;
    tctx.globalAlpha = 0.24;
    tctx.lineWidth = 1.5;
    tctx.setLineDash([12, 10]);
    tctx.beginPath();
    tctx.arc(cx, cy, 215, 0, Math.PI * 2);
    tctx.stroke();
    tctx.setLineDash([]);
    tctx.globalAlpha = 1;

    // Perimeter industrial hazard border
    tctx.strokeStyle = theme.borderHazard;
    tctx.globalAlpha = 0.34;
    tctx.lineWidth = 3;
    tctx.strokeRect(18, 18, WORLD_WIDTH - 36, WORLD_HEIGHT - 36);
    tctx.globalAlpha = 1;

    // Corner armored steel bunkers / supply crates (matte military-industrial)
    const corners = [
      [40, 40],
      [WORLD_WIDTH - 86, 40],
      [40, WORLD_HEIGHT - 86],
      [WORLD_WIDTH - 86, WORLD_HEIGHT - 86],
    ];
    for (const [bx, by] of corners) {
      tctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      tctx.beginPath();
      tctx.roundRect(bx + 4, by + 5, 46, 46, 5);
      tctx.fill();

      tctx.fillStyle = '#252932';
      tctx.strokeStyle = '#3f4552';
      tctx.lineWidth = 2;
      tctx.beginPath();
      tctx.roundRect(bx, by, 46, 46, 5);
      tctx.fill();
      tctx.stroke();

      // Matte roof hatch & hazard corner stencil
      tctx.fillStyle = '#1b1e25';
      tctx.fillRect(bx + 10, by + 10, 26, 26);
      tctx.strokeStyle = '#4b5563';
      tctx.lineWidth = 1;
      tctx.strokeRect(bx + 10, by + 10, 26, 26);

      tctx.fillStyle = theme.borderHazard;
      tctx.globalAlpha = 0.55;
      tctx.fillRect(bx + 6, by + 6, 8, 3);
      tctx.globalAlpha = 1;
    }

    this.terrainCanvas = offscreen;
  }

  public render(ctx: CanvasRenderingContext2D, viewWidth: number, viewHeight: number): void {
    this.ensureTerrainCache();
    const theme = this.getActiveTheme();

    ctx.fillStyle = theme.groundBase;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    const { scale, offsetX, offsetY } = this.getViewportTransform(viewWidth, viewHeight);
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;

    ctx.save();
    ctx.translate(offsetX + shakeX, offsetY + shakeY);
    ctx.scale(scale, scale);

    if (this.terrainCanvas) {
      ctx.drawImage(this.terrainCanvas, 0, 0);
    }

    // Scorch craters
    for (const s of this.scorches) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.alpha;
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, s.radius);
      grad.addColorStop(0, 'rgba(9, 10, 13, 0.85)');
      grad.addColorStop(0.55, 'rgba(24, 24, 27, 0.5)');
      grad.addColorStop(1, 'rgba(24, 24, 27, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Artillery warning zones
    for (const a of this.artilleryStrikes) {
      const progress = 1 - a.delay / a.maxDelay;
      ctx.save();
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
      ctx.fillStyle = 'rgba(220, 38, 38, 0.14)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(a.x, a.y, Math.max(4, a.radius * (1 - progress)), 0, Math.PI * 2);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Proximity Mines
    for (const m of this.mines) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const blink = Math.sin(this.patrolTime * 10 + m.x) > 0;
      ctx.fillStyle = m.armed ? (blink ? '#dc2626' : '#d97706') : '#71717a';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Scrap drops (industrial brass/amber salvage gears)
    for (const drop of this.scrapDrops) {
      ctx.save();
      ctx.translate(drop.x, drop.y);
      ctx.rotate(drop.rotation);

      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-4.5, -4.5, 9, 9, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
    }

    // Target lock reticle
    if (this.player.targetId !== null) {
      const target = this.enemies.find((e) => e.id === this.player.targetId);
      if (target) {
        ctx.save();
        ctx.translate(target.x, target.y);
        ctx.rotate(this.patrolTime * 1.4);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        const r = target.radius + 9;
        for (let q = 0; q < 4; q++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.arc(0, 0, r, -0.32, 0.32);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Enemy tanks
    for (const enemy of this.enemies) {
      this.drawEnemyTank(ctx, enemy);
    }

    // Player tank
    this.drawPlayerTank(ctx);

    // Repair Drone orbiting player
    if (this.repairDroneTimer > 0) {
      const dAng = this.patrolTime * 2.8;
      const dx = this.player.x + Math.cos(dAng) * 42;
      const dy = this.player.y + Math.sin(dAng) * 42;

      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(this.player.x, this.player.y);
      ctx.stroke();

      ctx.translate(dx, dy);
      ctx.fillStyle = '#1f2937';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Projectiles with weapon-specific polished rendering (Stage 5)
    for (const p of this.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      const wKind = p.weaponKind ?? (p.kind === 'missile' ? 'missile' : p.kind === 'rocket' ? 'rocket' : 'standard');

      if (wKind === 'missile' || wKind === 'rocket') {
        // Miniature missile / rocket with pointed nose, fins, and exhaust
        ctx.fillStyle = wKind === 'rocket' ? '#3f3f46' : '#4b5563';
        ctx.beginPath();
        ctx.roundRect(-8, -2.5, 12, 5, 1.5);
        ctx.fill();
        ctx.fillStyle = wKind === 'rocket' ? '#dc2626' : '#d97706';
        ctx.beginPath();
        ctx.moveTo(4, -2.5);
        ctx.lineTo(9, 0);
        ctx.lineTo(4, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#27272a';
        ctx.fillRect(-8, -5, 3, 2.5);
        ctx.fillRect(-8, 2.5, 3, 2.5);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-9, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (wKind === 'heavy') {
        // Heavy armor-piercing shell
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.roundRect(-9, -3.2, 14, 6.4, 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(5, -3.2);
        ctx.lineTo(11, 0);
        ctx.lineTo(5, 3.2);
        ctx.closePath();
        ctx.fill();
      } else if (wKind === 'standard' || wKind === 'rapid') {
        // Standard / Rapid metallic shell with pointed front and tracer
        ctx.strokeStyle = p.trailColor || 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = wKind === 'rapid' ? 2.5 : 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.fillStyle = '#52525b';
        ctx.beginPath();
        ctx.roundRect(-6, -2, 10, 4, 1.5);
        ctx.fill();
        ctx.fillStyle = p.color || '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(4, -2);
        ctx.lineTo(8, 0);
        ctx.lineTo(4, 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // Enemy shell / plasma bolt
        ctx.strokeStyle = p.trailColor || 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.fillStyle = p.color || '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(1, 0, (p.radius || 4) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Piercing Railgun Beams
    for (const beam of this.railgunBeams) {
      const fade = Math.max(0, beam.life / beam.maxLife);
      ctx.save();
      ctx.lineCap = 'round';

      ctx.globalAlpha = 0.32 * fade;
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = beam.width * 1.5 * fade;
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();

      ctx.globalAlpha = 0.8 * fade;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = beam.width * 0.65 * fade;
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();

      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, beam.width * 0.28 * fade);
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const pt of this.particles) {
      const t = 1 - pt.life / pt.maxLife;
      const curSize = pt.size + (pt.endSize - pt.size) * t;
      const curAlpha = pt.alpha * (1 - t);
      ctx.save();
      ctx.globalAlpha = Math.max(0, curAlpha);
      ctx.translate(pt.x, pt.y);

      if (pt.kind === 'ring' || pt.kind === 'emp') {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = (pt.kind === 'emp' ? 4.5 : 2.6) * (1 - t);
        ctx.beginPath();
        ctx.arc(0, 0, curSize, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.kind === 'debris') {
        ctx.rotate(pt.rotation);
        ctx.fillStyle = pt.color;
        ctx.fillRect(-curSize / 2, -curSize / 3, curSize, (curSize * 2) / 3);
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, curSize), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();

    const vig = ctx.createRadialGradient(
      viewWidth / 2,
      viewHeight / 2,
      Math.min(viewWidth, viewHeight) * 0.42,
      viewWidth / 2,
      viewHeight / 2,
      Math.max(viewWidth, viewHeight) * 0.76,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(5, 6, 9, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
  }

  private drawTreads(
    ctx: CanvasRenderingContext2D,
    length: number,
    trackWidth: number,
    halfSpan: number,
    offset: number,
    rimColor = 'rgba(113, 113, 122, 0.35)',
  ): void {
    const sides = [-halfSpan, halfSpan - trackWidth];
    for (const sy of sides) {
      ctx.fillStyle = '#111317';
      ctx.beginPath();
      ctx.roundRect(-length / 2, sy, length, trackWidth, 2.5);
      ctx.fill();

      ctx.fillStyle = '#2b303a';
      const step = 7;
      for (let tx = -length / 2 + (offset % step); tx < length / 2 - 2; tx += step) {
        ctx.fillRect(tx, sy + 1, 3, trackWidth - 2);
      }

      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(-length / 2, sy, length, trackWidth);
    }
  }

  private drawPlayerTank(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    const isApex = this.apexCustomization;

    // Subtle tactical indicator only during Overdrive
    if (this.overdriveTimer > 0) {
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7 + Math.sin(this.patrolTime * 10) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(3, 5, p.radius + 4, p.radius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(p.hullAngle);

    this.drawTreads(
      ctx,
      48,
      9,
      22,
      p.trackOffset,
      isApex ? 'rgba(217, 119, 6, 0.55)' : 'rgba(82, 82, 91, 0.45)',
    );

    if (isApex) {
      // Apex reactive side armor skirts
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-14, -20, 28, 4);
      ctx.fillRect(-14, 16, 28, 4);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-8, -19.5, 16, 2);
      ctx.fillRect(-8, 17.5, 16, 2);
    }

    // Military Olive-Drab & Gunmetal Chassis (or Obsidian/Gold Apex at Lv.50)
    ctx.fillStyle =
      p.hitFlash > 0.15 ? '#e4e4e7' : isApex ? '#27272a' : '#46543d';
    ctx.strokeStyle = isApex ? '#d97706' : '#18181b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-21, -15, 42, 30, 4);
    ctx.fill();
    ctx.stroke();

    // Front armor glacis
    ctx.fillStyle =
      p.hitFlash > 0.15 ? '#f4f4f5' : isApex ? '#3f3f46' : '#36422f';
    ctx.beginPath();
    ctx.roundRect(7, -13, 13, 26, 2.5);
    ctx.fill();

    // Amber tactical identification stripe
    ctx.fillStyle = isApex ? '#eab308' : '#d97706';
    ctx.fillRect(14, -10, 3, 20);

    // Engine deck vents
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-19, -10, 9, 20);
    ctx.fillStyle = this.overdriveTimer > 0 ? '#f59e0b' : isApex ? '#a16207' : '#52525b';
    for (let ly = -8; ly <= 6; ly += 4) {
      ctx.fillRect(-17, ly, 5, 2);
    }
    ctx.restore();

    ctx.save();
    ctx.rotate(p.turretAngle);
    const recoilShift = p.recoil * 5.5;

    // Steel main cannon barrel & muzzle brake
    ctx.fillStyle = isApex ? '#52525b' : '#4b5563';
    ctx.strokeStyle = '#111317';
    ctx.lineWidth = 1.4;
    ctx.fillRect(8 - recoilShift, -3.5, 24, 7);
    ctx.strokeRect(8 - recoilShift, -3.5, 24, 7);

    ctx.fillStyle = isApex ? '#b45309' : '#27272a';
    ctx.fillRect(29 - recoilShift, -5, 5.5, 10);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(1, 2, 13, 0, Math.PI * 2);
    ctx.fill();

    // Armored military turret
    ctx.fillStyle =
      p.hitFlash > 0.15 ? '#f4f4f5' : isApex ? '#3f3f46' : '#536249';
    ctx.strokeStyle = isApex ? '#eab308' : '#18181b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-13, -10);
    ctx.lineTo(8, -12);
    ctx.lineTo(14, -6);
    ctx.lineTo(14, 6);
    ctx.lineTo(8, 12);
    ctx.lineTo(-13, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Commander cupola hatch & optic
    ctx.fillStyle = isApex ? '#18181b' : '#2f3829';
    ctx.beginPath();
    ctx.arc(-3, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.overdriveTimer > 0 ? '#facc15' : '#9ca3af';
    ctx.beginPath();
    ctx.arc(-3, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isApex ? '#eab308' : '#d97706';
    ctx.fillRect(5, 3, 4.5, 3);

    ctx.restore();

    if (!this.isRecovering) {
      const bw = 48;
      const bh = 5;
      const hpRatio = clamp(p.hp / Math.max(1, p.maxHp), 0, 1);
      ctx.fillStyle = 'rgba(9, 10, 13, 0.9)';
      ctx.fillRect(-bw / 2 - 1, -p.radius - 17, bw + 2, bh + 2);
      ctx.fillStyle = hpRatio > 0.35 ? '#10b981' : '#dc2626';
      ctx.fillRect(-bw / 2, -p.radius - 16, bw * hpRatio, bh);
    } else {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9, this.patrolTime * 3, this.patrolTime * 3 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private drawEnemyTank(ctx: CanvasRenderingContext2D, e: EnemyEntity): void {
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.shieldHp > 0) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (e.isElite && !e.isBoss) {
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (e.isBoss) {
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.52)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(2.5, 4, e.radius + 3, e.radius - 1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(e.hullAngle);

    const hullLen = e.isBoss ? 68 : e.archetype === 'heavy' ? 48 : e.archetype === 'light' ? 32 : 40;
    const hullWidth = e.isBoss ? 46 : e.archetype === 'heavy' ? 32 : e.archetype === 'light' ? 21 : 26;
    const treadWidth = e.isBoss ? 12 : e.archetype === 'heavy' ? 9 : 7;

    this.drawTreads(
      ctx,
      hullLen + 4,
      treadWidth,
      hullWidth / 2 + treadWidth - 1,
      e.trackOffset,
      `${e.hullAccent}44`,
    );

    ctx.fillStyle = e.hitFlash > 0.15 ? '#e4e4e7' : e.stunTimer > 0 ? '#3f3f46' : e.hullColor;
    ctx.strokeStyle = '#111317';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-hullLen / 2, -hullWidth / 2, hullLen, hullWidth, e.archetype === 'assault' ? 2 : 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = e.hullAccent;
    ctx.fillRect(hullLen / 2 - 8, -hullWidth / 2 + 3, 5, hullWidth - 6);
    if (e.isElite || e.isBoss) {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-hullLen / 2 + 4, -hullWidth / 2 + 2, 4, hullWidth - 4);
    }

    ctx.restore();

    ctx.save();
    ctx.rotate(e.turretAngle);
    const recoilShift = e.recoil * 4.5;

    if (e.isBoss) {
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(10 - recoilShift, -11, 34, 6);
      ctx.strokeRect(10 - recoilShift, -11, 34, 6);
      ctx.fillRect(10 - recoilShift, 5, 34, 6);
      ctx.strokeRect(10 - recoilShift, 5, 34, 6);

      ctx.fillStyle = e.hitFlash > 0.15 ? '#fecaca' : e.turretColor;
      ctx.beginPath();
      ctx.roundRect(-20, -18, 38, 36, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#d97706';
      ctx.fillRect(-14, -7, 6, 14);
      ctx.save();
      ctx.translate(-3, 0);
      ctx.rotate(this.patrolTime * 3);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.restore();
    } else {
      const barrelLen = e.archetype === 'heavy' ? 25 : e.archetype === 'light' ? 17 : 21;
      const barrelThick = e.archetype === 'heavy' ? 6.5 : e.archetype === 'light' ? 4 : 5;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(5 - recoilShift, -barrelThick / 2, barrelLen, barrelThick);

      const tRadius = e.archetype === 'heavy' ? 14 : e.archetype === 'light' ? 9 : 11;
      ctx.fillStyle = e.hitFlash > 0.15 ? '#fecaca' : e.turretColor;
      ctx.strokeStyle = '#111317';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-tRadius, -tRadius * 0.85, tRadius * 2, tRadius * 1.7, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = e.stunTimer > 0 ? '#38bdf8' : e.isElite ? '#f59e0b' : e.hullAccent;
      ctx.fillRect(tRadius - 4, -2.5, 3.5, 5);
    }

    ctx.restore();

    const bw = e.isBoss ? 68 : e.radius * 1.9;
    const bh = e.isBoss ? 6 : 4;
    const hpRatio = clamp(e.hp / Math.max(1, e.maxHp), 0, 1);
    ctx.fillStyle = 'rgba(9, 10, 13, 0.9)';
    ctx.fillRect(-bw / 2 - 1, -e.radius - 13, bw + 2, bh + 2);
    ctx.fillStyle = e.isBoss ? '#eab308' : '#dc2626';
    ctx.fillRect(-bw / 2, -e.radius - 12, bw * hpRatio, bh);

    ctx.restore();
  }
}
