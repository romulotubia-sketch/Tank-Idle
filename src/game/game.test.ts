import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  AUTO_FORGE_UNLOCK_LEVEL,
  DAILY_DUNGEON_ENTRIES,
  DAILY_MISSION_COUNT,
  DAILY_MISSION_POOL,
  DEFAULT_AUTO_FORGE_SETTINGS,
  DEFAULT_EQUIPPED_GEAR,
  DEFAULT_UPGRADE_LEVELS,
  DUNGEON_CONFIGS,
  DUNGEON_ORDER,
  FORGE_TIERS,
  LOGIN_REWARD_CALENDAR,
  MAX_DUNGEON_STAGE,
  MAX_SKILL_LEVEL,
  OFFLINE_EARNINGS_MAX_SECONDS,
  SKILL_DUPLICATE_COSTS,
  SKILL_ORDER,
  TANK_MILESTONES,
  WAVES_PER_STAGE,
  WEEKLY_MISSION_COUNT,
  createDefaultDailyDungeonEntries,
  createDefaultDungeonProgress,
  createDefaultLifetimeStats,
  createDefaultLoginCalendar,
  createDefaultSkills,
  getDungeonStageDifficultyMultipliers,
  getDungeonStageRecommendedPower,
  getDungeonWaveCount,
  getLocalDateKey,
  getStageDifficultyMultipliers,
  getWaveClearBonus,
  getWaveEnemyCount,
  getWeekStartDateKey,
  isBossStage,
} from './config';
import {
  applyDungeonRewards,
  canEnterDungeonStage,
  consumeDailyDungeonEntry,
  generateDungeonRewards,
  isDungeonStageUnlocked,
  recordDungeonCompletion,
  refreshDailyDungeonEntries,
} from './dungeons';
import {
  addCurrency,
  canAfford,
  createInitialChests,
  createInitialWallet,
  formatCompactNumber,
  spendCurrencies,
  spendCurrency,
} from './economy';
import { BattleEngine } from './engine';
import {
  forgeSingleItem,
  generateEquipment,
  isAutoForgeUnlocked,
  runAutoForgeStep,
  upgradeEquipmentItem,
} from './forge';
import {
  applyTankXp,
  calculateMitigatedDamage,
  computeEffectiveDps,
  computeTankPower,
  computeTankStats,
  getUpgradeCost,
  isUpgradeMaxed,
  sanitizeUpgradeLevels,
} from './progression';
import {
  calculateOfflineEarnings,
  canClaimLoginReward,
  claimAchievement,
  claimDailyMission,
  claimLoginReward,
  claimTankMilestone,
  claimWeeklyMission,
  generateDailyMissions,
  generateWeeklyMissions,
  getAchievementProgress,
  grantProgressionRewardBundle,
  recordMissionProgress,
  refreshDailyMissions,
  refreshWeeklyMissions,
} from './progressionSystems';
import {
  craftChestWithSkillTech,
  getRequiredDuplicatesForNextLevel,
  getSkillComputedStats,
  openSkillChest,
  unlockSkillWithTech,
  upgradeSkillWithDuplicates,
} from './skills';
import { createDefaultSaveData, loadSaveData, persistSaveData } from './storage';
import type { DungeonId, EquipmentItem, SkillId } from './types';

test('1. Economy: centralized wallet prevents negative balances and atomic multi-spend works', () => {
  let wallet = createInitialWallet();
  assert.equal(wallet.scrap, 60);
  assert.equal(wallet.forgeCores, 6);

  wallet = addCurrency(wallet, 'scrap', 40);
  assert.equal(wallet.scrap, 100);
  assert.equal(canAfford(wallet, 'scrap', 100), true);

  const failSingle = spendCurrency(wallet, 'scrap', 150);
  assert.equal(failSingle.success, false);
  assert.equal(failSingle.wallet.scrap, 100);

  // Atomic multi-currency check: enough scrap, NOT enough forgeCores
  const failMulti = spendCurrencies(wallet, { scrap: 50, forgeCores: 20 });
  assert.equal(failMulti.success, false);
  assert.equal(failMulti.wallet.scrap, 100);
  assert.equal(failMulti.wallet.forgeCores, 6);

  const okMulti = spendCurrencies(wallet, { scrap: 35, forgeCores: 2 });
  assert.equal(okMulti.success, true);
  assert.equal(okMulti.wallet.scrap, 65);
  assert.equal(okMulti.wallet.forgeCores, 4);

  assert.equal(formatCompactNumber(12500), '12.5K');
  assert.equal(formatCompactNumber(2400000), '2.40M');
});

test('2. Progression & Equipment: equipped gear and passives immediately modify TankStats and TankPower', () => {
  const baseStats = computeTankStats(DEFAULT_UPGRADE_LEVELS, DEFAULT_EQUIPPED_GEAR, 1);
  assert.equal(baseStats.maxHp, 220);
  assert.equal(baseStats.attackDamage, 28);
  assert.ok(computeEffectiveDps(baseStats) > 30);

  const cannon = generateEquipment('elite', 10, 'cannon');
  const armor = generateEquipment('military', 10, 'armor');
  const geared = {
    ...DEFAULT_EQUIPPED_GEAR,
    cannon,
    armor,
  };

  const gearedStats = computeTankStats(DEFAULT_UPGRADE_LEVELS, geared, 10);
  assert.ok(gearedStats.attackDamage > baseStats.attackDamage);
  assert.ok(gearedStats.armor > baseStats.armor);
  assert.ok(computeTankPower(gearedStats) > computeTankPower(baseStats));

  // Tank XP leveling up
  const xpRes = applyTankXp(1, 0, 5000);
  assert.ok(xpRes.tankLevel > 1);
  assert.ok(xpRes.levelsGained > 0);

  // Armor penetration mitigation
  assert.equal(calculateMitigatedDamage(100, 32, 0), 50);
  assert.ok(calculateMitigatedDamage(100, 32, 0.5) > 50);

  assert.equal(isUpgradeMaxed('attackSpeed', 60), true);
  assert.ok(getUpgradeCost('attackDamage', 2) > getUpgradeCost('attackDamage', 1));
  const sanitized = sanitizeUpgradeLevels({ maxHp: -5, attackSpeed: 999 });
  assert.equal(sanitized.maxHp, 1);
  assert.equal(sanitized.attackSpeed, 60);
});

test('3. Manual Forging & Equipment Upgrading consume exact resources and generate valid items', () => {
  const wallet = { scrap: 200, forgeCores: 10, skillTech: 0, alloyPlates: 10 };
  const tier = FORGE_TIERS.standard;

  const forged = forgeSingleItem({
    wallet,
    tierId: 'standard',
    tankLevel: 5,
    rng: () => 0.1,
  });

  assert.equal(forged.success, true);
  assert.ok(forged.item !== null);
  assert.equal(forged.wallet.scrap, 200 - tier.scrapCost);
  assert.equal(forged.wallet.forgeCores, 10 - tier.coreCost);

  const upgraded = upgradeEquipmentItem(forged.item!, forged.wallet);
  assert.equal(upgraded.success, true);
  assert.equal(upgraded.item.level, 2);
  assert.ok(upgraded.item.powerScore >= forged.item!.powerScore);

  const slotTargeted = forgeSingleItem({
    wallet: upgraded.wallet,
    tierId: 'standard',
    tankLevel: 5,
    forcedSlot: 'optics',
    rng: () => 0.25,
  });
  assert.equal(slotTargeted.success, true);
  assert.equal(slotTargeted.item?.slot, 'optics');

  const beforeEquip = computeTankStats(DEFAULT_UPGRADE_LEVELS, DEFAULT_EQUIPPED_GEAR, 5);
  const afterEquip = computeTankStats(
    DEFAULT_UPGRADE_LEVELS,
    { ...DEFAULT_EQUIPPED_GEAR, optics: slotTargeted.item! },
    5,
  );
  assert.ok(computeTankPower(afterEquip) > computeTankPower(beforeEquip));
});

test('4. Auto Forge enforces Level 25 unlock, resource limits, target rarity stop, and gear preservation', () => {
  assert.equal(isAutoForgeUnlocked(24), false);
  assert.equal(isAutoForgeUnlocked(AUTO_FORGE_UNLOCK_LEVEL), true);

  // Locked check
  const lockedRes = runAutoForgeStep({
    settings: { ...DEFAULT_AUTO_FORGE_SETTINGS, enabled: true },
    tankLevel: 10,
    wallet: { scrap: 500, forgeCores: 50, skillTech: 0, alloyPlates: 0 },
    inventory: [],
  });
  assert.equal(lockedRes.continueLoop, false);
  assert.ok(lockedRes.stopReason?.includes('Locked'));

  // Insufficient resources check
  const poorRes = runAutoForgeStep({
    settings: { ...DEFAULT_AUTO_FORGE_SETTINGS, enabled: true, tierId: 'standard' },
    tankLevel: 25,
    wallet: { scrap: 5, forgeCores: 0, skillTech: 0, alloyPlates: 0 },
    inventory: [],
  });
  assert.equal(poorRes.continueLoop, false);
  assert.equal(poorRes.wallet.scrap, 5);

  // Target rarity stop condition (rng 0.99 rolls Elite/Prototype in prototype tier)
  const hitTargetRes = runAutoForgeStep({
    settings: {
      ...DEFAULT_AUTO_FORGE_SETTINGS,
      enabled: true,
      tierId: 'prototype',
      targetRarity: 'elite',
      autoSalvageLower: false,
    },
    tankLevel: 30,
    wallet: { scrap: 1000, forgeCores: 100, skillTech: 0, alloyPlates: 0 },
    inventory: [],
    rng: () => 0.95,
  });
  assert.equal(hitTargetRes.continueLoop, false);
  assert.ok(hitTargetRes.forgedItem !== null);
  assert.equal(hitTargetRes.inventory.length, 1);
  assert.equal(hitTargetRes.salvaged, false);
});

test('5. Skill Chests grant unlocks or duplicates without duplicate collection entries, and Duplicate Upgrades enforce Lv 1..10 table', () => {
  let chests = createInitialChests();
  chests.standard = 3;
  chests.advanced = 1;
  chests.elite = 1;
  let skills = createDefaultSkills();
  let wallet = createInitialWallet();

  // Open chests across all 3 tiers
  for (const tier of ['standard', 'advanced', 'elite'] as const) {
    const res = openSkillChest({ tier, chests, skills, wallet, rng: () => 0.4 });
    assert.equal(res.success, true);
    assert.ok(res.reward !== null);
    assert.ok(res.reward!.bonusSkillTech > 0);
    chests = res.chests;
    skills = res.skills;
    wallet = res.wallet;
  }

  // Collection must always stay strictly 8 unique skills
  assert.equal(Object.keys(skills).length, 8);

  // Already-owned skill from chest awards +1 duplicate copy instead of duplicating collection entry
  for (const id of SKILL_ORDER) {
    skills[id] = { id, unlocked: true, level: 1, duplicates: 0 };
  }
  const dupRes = openSkillChest({ tier: 'standard', chests, skills, wallet, rng: () => 0.05 });
  assert.equal(dupRes.success, true);
  assert.equal(dupRes.reward?.isNewUnlock, false);
  assert.equal(dupRes.reward?.duplicatesGranted, 1);
  assert.equal(dupRes.skills[dupRes.reward!.skillId].duplicates, 1);

  // Crafting a chest with Skill Tech
  wallet = addCurrency(wallet, 'skillTech', 50);
  const craftRes = craftChestWithSkillTech(dupRes.chests, wallet);
  assert.equal(craftRes.success, true);
  assert.equal(craftRes.chests.standard, dupRes.chests.standard + 1);

  // Exact duplicate upgrade requirements from Lv 1 -> Lv 10: [1,2,3,4,5,6,7,8,10]
  assert.deepEqual([...SKILL_DUPLICATE_COSTS], [1, 2, 3, 4, 5, 6, 7, 8, 10]);
  let testSkills = createDefaultSkills();
  testSkills.railgun_shot = { id: 'railgun_shot', unlocked: true, level: 1, duplicates: 0 };

  for (let lvl = 1; lvl < MAX_SKILL_LEVEL; lvl++) {
    const req = getRequiredDuplicatesForNextLevel(lvl)!;
    assert.equal(req, SKILL_DUPLICATE_COSTS[lvl - 1]);

    // Insufficient duplicates must fail
    testSkills.railgun_shot = { ...testSkills.railgun_shot, duplicates: req - 1 };
    const failRes = upgradeSkillWithDuplicates('railgun_shot', testSkills);
    assert.equal(failRes.success, false);

    // Exact duplicates must succeed and consume exact cost
    testSkills.railgun_shot = { ...testSkills.railgun_shot, duplicates: req };
    const okRes = upgradeSkillWithDuplicates('railgun_shot', testSkills);
    assert.equal(okRes.success, true);
    assert.equal(okRes.consumedDuplicates, req);
    testSkills = okRes.skills;
    assert.equal(testSkills.railgun_shot.level, lvl + 1);
    assert.equal(testSkills.railgun_shot.duplicates, 0);
  }

  // Max level 10 blocks further upgrades even with extra duplicates
  assert.equal(getRequiredDuplicatesForNextLevel(10), null);
  testSkills.railgun_shot = { ...testSkills.railgun_shot, duplicates: 25 };
  const maxFail = upgradeSkillWithDuplicates('railgun_shot', testSkills);
  assert.equal(maxFail.success, false);

  // Meaningful milestone scaling check
  const lv1Rail = getSkillComputedStats('railgun_shot', 1);
  const lv9Rail = getSkillComputedStats('railgun_shot', 9);
  assert.ok(lv9Rail.maxPierce > lv1Rail.maxPierce);
  assert.ok(lv9Rail.armorPen > lv1Rail.armorPen);

  const lv1Missile = getSkillComputedStats('missile_barrage', 1);
  const lv9Missile = getSkillComputedStats('missile_barrage', 9);
  assert.ok(lv9Missile.projectileCount > lv1Missile.projectileCount);

  const lv1Overdrive = getSkillComputedStats('overdrive', 1);
  const lv7Overdrive = getSkillComputedStats('overdrive', 7);
  assert.ok(lv7Overdrive.moveSpeedBonus > lv1Overdrive.moveSpeedBonus);
  assert.ok(lv7Overdrive.duration > lv1Overdrive.duration);

  // Unlocking via tech also remains valid
  const unlockRes = unlockSkillWithTech('emp_pulse', createDefaultSkills(), addCurrency(createInitialWallet(), 'skillTech', 40));
  assert.equal(unlockRes.success, true);
  assert.equal(unlockRes.skills.emp_pulse.unlocked, true);
});

test('6. All 8 Tank Skills execute, respect 3-slot loadout & autoSkillsEnabled toggle inside BattleEngine', () => {
  const stats = computeTankStats(
    { ...DEFAULT_UPGRADE_LEVELS, maxHp: 20, attackDamage: 15, attackSpeed: 6 },
    DEFAULT_EQUIPPED_GEAR,
    20,
  );
  const allSkills = createDefaultSkills();
  for (const id of SKILL_ORDER) {
    allSkills[id] = { id, unlocked: true, level: 3, duplicates: 0 };
  }

  // Test all 8 Stage 2B skills in batches of 3 equipped slots
  const batches: [SkillId, SkillId, SkillId | null][] = [
    ['missile_barrage', 'artillery_strike', 'mine_deployment'],
    ['railgun_shot', 'repair_drone', 'emp_pulse'],
    ['overdrive', 'rocket_salvo', null],
  ];

  for (const batch of batches) {
    let kills = 0;
    const engine = new BattleEngine(stats, 1, 1, 0, batch, allSkills, {
      onScrapCollected: () => {},
      onXpGained: () => {},
      onKillRecorded: () => {
        kills++;
      },
      onStageChanged: () => {},
      onDungeonEnded: () => {},
      onHudUpdate: () => {},
    });

    // Step 16 seconds so every equipped skill cooldown cycles and activates
    for (let i = 0; i < 530; i++) {
      engine.step(0.03);
    }

    const snap = engine.getHudSnapshot();
    assert.equal(snap.skillCooldowns.length, batch.filter(Boolean).length);
    assert.ok(kills > 0, `Expected batch ${batch.join(',')} to defeat enemies`);
  }

  // Verify disabling auto-skills prevents Overdrive/skills from activating automatically
  const manualEngine = new BattleEngine(stats, 1, 1, 0, ['overdrive', null, null], allSkills, {
    onScrapCollected: () => {},
    onXpGained: () => {},
    onKillRecorded: () => {},
    onStageChanged: () => {},
    onDungeonEnded: () => {},
    onHudUpdate: () => {},
  });
  manualEngine.setAutoSkillsEnabled(false);
  for (let i = 0; i < 200; i++) {
    manualEngine.step(0.03);
  }
  const manualSnap = manualEngine.getHudSnapshot();
  assert.equal(manualSnap.autoSkillsEnabled, false);
  assert.equal(manualSnap.overdriveActive, false);
  assert.equal(manualSnap.skillCooldowns[0].cooldownRemaining, 0);
});

test('7. Stage 2C: All 4 Dungeons, 10 Stages, themed bosses/enemies, unlocking, replay, and distinct victory rewards', () => {
  const expectedEnemies: Record<DungeonId, string[]> = {
    salvage_yard: ['Scrap Scavenger', 'Rust Tank', 'Salvage Hauler', 'Scrap Crusher'],
    arsenal_depot: ['Assault Tank', 'Missile Carrier', 'Artillery Tank', 'Heavy Gunner'],
    armored_stronghold: ['Reinforced Tank', 'Siege Tank', 'Shield Tank', 'Elite Defender'],
    experimental_grounds: [
      'Prototype Drone',
      'Plasma Tank',
      'Experimental Walker',
      'Overcharged Combat Unit',
    ],
  };

  let progress = createDefaultDungeonProgress();
  let wallet = { scrap: 0, forgeCores: 0, skillTech: 0, alloyPlates: 0 };
  let chests = { standard: 0, advanced: 0, elite: 0 };
  let inventory: ReturnType<typeof generateEquipment>[] = [];

  for (const dungeonId of DUNGEON_ORDER) {
    const cfg = DUNGEON_CONFIGS[dungeonId];
    assert.equal(cfg.maxStages, 10);
    assert.deepEqual(
      cfg.enemies.map((e) => e.name),
      expectedEnemies[dungeonId],
    );

    // Stage 1 is unlocked initially; Stage 2 is locked
    assert.equal(isDungeonStageUnlocked(dungeonId, 1, progress), true);
    assert.equal(isDungeonStageUnlocked(dungeonId, 2, progress), false);

    // Difficulty scales smoothly from Stage 1 -> Stage 10
    assert.ok(
      getDungeonStageRecommendedPower(dungeonId, 10) >
        getDungeonStageRecommendedPower(dungeonId, 1),
    );
    assert.ok(
      getDungeonStageDifficultyMultipliers(dungeonId, 10, 4).hpScale >
        getDungeonStageDifficultyMultipliers(dungeonId, 1, 1).hpScale,
    );

    // Execute Stage 1 & Stage 10 inside BattleEngine
    for (const testStage of [1, 10]) {
      if (testStage === 10) {
        progress[dungeonId] = { highestClearedStage: 9, clears: 9, bossClears: 9 };
        assert.equal(isDungeonStageUnlocked(dungeonId, 10, progress), true);
      }

      let endedCount = 0;
      let endedVictory = false;
      let endedWaves = 0;
      let endedStage = 0;
      let sawBossHud = false;
      let expectedBossName =
        testStage === 10 ? cfg.finalBossName : cfg.bossName;

      const strongStats = computeTankStats(
        { ...DEFAULT_UPGRADE_LEVELS, maxHp: 90, attackDamage: 95, attackSpeed: 30, armor: 45 },
        DEFAULT_EQUIPPED_GEAR,
        60,
      );

      const engine = new BattleEngine(
        strongStats,
        1,
        1,
        0,
        ['missile_barrage', 'artillery_strike', 'overdrive'],
        createDefaultSkills(),
        {
          onScrapCollected: () => {},
          onXpGained: () => {},
          onKillRecorded: () => {},
          onStageChanged: () => {},
          onDungeonEnded: (
            _id: DungeonId,
            dStage: number,
            victory: boolean,
            wavesCleared: number,
          ) => {
            endedCount++;
            endedStage = dStage;
            endedVictory = victory;
            endedWaves = wavesCleared;
          },
          onHudUpdate: () => {},
        },
      );

      const started = engine.startDungeon(dungeonId, testStage);
      assert.equal(started, true);
      assert.equal(engine.getHudSnapshot().dungeonStage, testStage);

      for (let i = 0; i < 4000 && !endedVictory; i++) {
        engine.step(0.03);
        const snap = engine.getHudSnapshot();
        if (snap.bossName === expectedBossName) {
          sawBossHud = true;
        }
      }

      // Extra steps must NEVER fire onDungeonEnded twice (duplicate reward guard)
      engine.step(0.03);
      engine.step(0.03);
      assert.equal(endedCount, 1, `${dungeonId} Stage ${testStage} should fire end callback once`);
      assert.equal(endedVictory, true, `${dungeonId} Stage ${testStage} should complete`);
      assert.equal(endedStage, testStage);
      assert.equal(endedWaves, getDungeonWaveCount(testStage));
      assert.equal(sawBossHud, true, `Should encounter boss ${expectedBossName}`);

      const rewards = generateDungeonRewards({
        dungeonId,
        stage: testStage,
        tankLevel: 30,
        victory: true,
        wavesCleared: endedWaves,
        totalWaves: endedWaves,
        rng: () => 0.05,
      });
      const applied = applyDungeonRewards({ wallet, chests, inventory, rewards });
      wallet = applied.wallet;
      chests = applied.chests;
      inventory = applied.inventory;

      const recorded = recordDungeonCompletion(dungeonId, testStage, true, progress);
      progress = recorded.progress;
      if (testStage === 1) {
        assert.equal(recorded.newlyUnlockedStage, 2);
        assert.equal(isDungeonStageUnlocked(dungeonId, 2, progress), true);
        // Replaying Stage 1 remains allowed
        assert.equal(isDungeonStageUnlocked(dungeonId, 1, progress), true);
      }
    }
  }

  // Distinct reward verification + Skill Chest integration
  assert.ok(wallet.scrap > 0, 'Dungeons grant Scrap on completion');
  assert.ok(wallet.forgeCores > 0, 'Arsenal Depot / Stronghold grant Forge Cores');
  assert.ok(wallet.alloyPlates > 0, 'Armored Stronghold grants Alloy Plates');
  assert.ok(inventory.length >= 2, 'Armored Stronghold grants Equipment Chest drops');
  assert.ok(
    chests.standard + chests.advanced + chests.elite >= 2,
    'Experimental Grounds grants Skill Chests',
  );

  // Open an earned Skill Chest and verify duplicate handling works seamlessly
  let skills = createDefaultSkills();
  for (const id of SKILL_ORDER) {
    skills[id] = { id, unlocked: true, level: 1, duplicates: 0 };
  }
  const openRes = openSkillChest({ tier: 'elite', chests, skills, wallet, rng: () => 0.1 });
  assert.equal(openRes.success, true);
  assert.equal(openRes.reward?.duplicatesGranted, 1);
  assert.equal(openRes.skills[openRes.reward!.skillId].duplicates, 1);
});

test('8. Stage 2C: Daily 5-entry limit, daily reset, load-failure safety, and zero rewards on defeat', () => {
  const day1Ms = new Date(2026, 10, 19, 10, 0, 0).getTime();
  const day2Ms = new Date(2026, 10, 20, 8, 0, 0).getTime();

  let entries = createDefaultDailyDungeonEntries(day1Ms);
  assert.equal(entries.remaining, DAILY_DUNGEON_ENTRIES);
  assert.equal(entries.max, 5);

  const progress = createDefaultDungeonProgress();

  // Invalid stage (load failure simulation): engine.startDungeon returns false & must NOT consume entry
  const failEngine = new BattleEngine(
    computeTankStats(DEFAULT_UPGRADE_LEVELS, DEFAULT_EQUIPPED_GEAR, 1),
    1,
    1,
    0,
    ['missile_barrage', null, null],
    createDefaultSkills(),
    {
      onScrapCollected: () => {},
      onXpGained: () => {},
      onKillRecorded: () => {},
      onStageChanged: () => {},
      onDungeonEnded: () => {},
      onHudUpdate: () => {},
    },
  );
  assert.equal(failEngine.startDungeon('salvage_yard', 99), false);
  assert.equal(entries.remaining, 5);

  // Consume all 5 entries on Day 1
  for (let i = 0; i < 5; i++) {
    const check = canEnterDungeonStage('salvage_yard', 1, progress, entries, day1Ms);
    assert.equal(check.allowed, true);
    const consumed = consumeDailyDungeonEntry(check.refreshedEntries, day1Ms);
    assert.equal(consumed.success, true);
    entries = consumed.entries;
  }
  assert.equal(entries.remaining, 0);

  // 6th entry blocked on Day 1
  const blocked = canEnterDungeonStage('salvage_yard', 1, progress, entries, day1Ms);
  assert.equal(blocked.allowed, false);

  // Next calendar day resets back to 5/5 automatically
  const nextDayCheck = canEnterDungeonStage('salvage_yard', 1, progress, entries, day2Ms);
  assert.equal(nextDayCheck.allowed, true);
  assert.equal(nextDayCheck.refreshedEntries.remaining, 5);
  assert.equal(nextDayCheck.refreshedEntries.lastResetDate, getLocalDateKey(day2Ms));

  // Failed dungeon attempt grants 0 rewards and does NOT unlock next stage
  const failedRewards = generateDungeonRewards({
    dungeonId: 'armored_stronghold',
    stage: 1,
    tankLevel: 20,
    victory: false,
    wavesCleared: 2,
    totalWaves: 3,
  });
  assert.equal(failedRewards.scrap, 0);
  assert.equal(failedRewards.forgeCores, 0);
  assert.equal(failedRewards.alloyPlates, 0);
  assert.equal(failedRewards.equipment.length, 0);
  assert.deepEqual(failedRewards.chests, {});

  const failedRecord = recordDungeonCompletion('armored_stronghold', 1, false, progress);
  assert.equal(failedRecord.newlyUnlockedStage, null);
  assert.equal(failedRecord.progress.armored_stronghold.highestClearedStage, 0);

  // Verify weak tank losing in dungeon triggers defeat with 0 scrap collected
  let leakedScrap = 0;
  let defeatTriggered = false;
  let defeatVictory = true;
  const weakStats = computeTankStats(
    { ...DEFAULT_UPGRADE_LEVELS, maxHp: 1, attackDamage: 1, armor: 1 },
    DEFAULT_EQUIPPED_GEAR,
    1,
  );
  const loseEngine = new BattleEngine(
    weakStats,
    1,
    1,
    0,
    [null, null, null],
    createDefaultSkills(),
    {
      onScrapCollected: (amt) => {
        leakedScrap += amt;
      },
      onXpGained: () => {},
      onKillRecorded: () => {},
      onStageChanged: () => {},
      onDungeonEnded: (_id, _s, victory) => {
        defeatTriggered = true;
        defeatVictory = victory;
      },
      onHudUpdate: () => {},
    },
  );
  loseEngine.startDungeon('experimental_grounds', 10);
  for (let i = 0; i < 3000 && !defeatTriggered; i++) {
    loseEngine.step(0.03);
  }
  assert.equal(defeatTriggered, true);
  assert.equal(defeatVictory, false);
  assert.equal(leakedScrap, 0);
});

test('9. Save and Load persistence roundtrips 10-stage dungeons, daily entries, and migrates legacy saves', () => {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };

  const sample = createDefaultSaveData();
  sample.tankLevel = 26;
  sample.wallet.forgeCores = 42;
  sample.stage = 7;
  sample.equippedGear.cannon = generateEquipment('military', 26, 'cannon');
  sample.skills.overdrive.unlocked = true;
  sample.skills.overdrive.level = 3;
  sample.skills.overdrive.duplicates = 2;
  sample.autoSkillsEnabled = false;
  sample.dungeonProgress.salvage_yard = {
    highestClearedStage: 6,
    clears: 8,
    bossClears: 8,
  };
  sample.dungeonEntries = {
    remaining: 2,
    max: 5,
    lastResetDate: getLocalDateKey(),
  };

  persistSaveData(sample);
  const loaded = loadSaveData();

  assert.equal(loaded.tankLevel, 26);
  assert.equal(loaded.wallet.forgeCores, 42);
  assert.equal(loaded.stage, 7);
  assert.equal(loaded.equippedGear.cannon?.rarity, 'military');
  assert.equal(loaded.skills.overdrive.unlocked, true);
  assert.equal(loaded.skills.overdrive.level, 3);
  assert.equal(loaded.skills.overdrive.duplicates, 2);
  assert.equal(loaded.autoSkillsEnabled, false);
  assert.equal(loaded.dungeonProgress.salvage_yard.highestClearedStage, 6);
  assert.equal(loaded.dungeonEntries.remaining, 2);

  // Outdated entry date resets to 5/5 upon refresh/load
  const yesterdaySave = createDefaultSaveData();
  yesterdaySave.dungeonEntries = {
    remaining: 0,
    max: 5,
    lastResetDate: '2020-01-01',
  };
  persistSaveData(yesterdaySave);
  const loadedToday = loadSaveData();
  assert.equal(loadedToday.dungeonEntries.remaining, 5);
  assert.equal(loadedToday.dungeonEntries.lastResetDate, getLocalDateKey());

  // Legacy migration check: minefield -> mine_deployment, napalm_strike -> rocket_salvo, air_support -> railgun_shot, shards -> duplicates
  store.set(
    'ironclad_vanguard_save_v1',
    JSON.stringify({
      version: 2,
      skills: {
        minefield: { unlocked: true, level: 4, shards: 3 },
        napalm_strike: { unlocked: true, level: 2, shards: 1 },
        air_support: { unlocked: true, level: 15, shards: 5 },
      },
      equippedSkillIds: ['minefield', 'napalm_strike', 'air_support'],
      dungeonProgress: {
        salvage_yard: { attempts: 1, clears: 3 },
      },
    }),
  );
  const migrated = loadSaveData();
  assert.equal(migrated.skills.mine_deployment.unlocked, true);
  assert.equal(migrated.skills.mine_deployment.level, 4);
  assert.equal(migrated.skills.mine_deployment.duplicates, 3);
  assert.equal(migrated.skills.rocket_salvo.unlocked, true);
  assert.equal(migrated.skills.railgun_shot.level, MAX_SKILL_LEVEL);
  assert.deepEqual(migrated.equippedSkillIds, ['mine_deployment', 'rocket_salvo', 'railgun_shot']);
  assert.equal(migrated.autoSkillsEnabled, true);
  assert.equal(migrated.dungeonProgress.salvage_yard.highestClearedStage, 3);
  assert.equal(migrated.dungeonProgress.salvage_yard.highestClearedStage <= MAX_DUNGEON_STAGE, true);
  assert.equal(refreshDailyDungeonEntries(migrated.dungeonEntries).remaining, 5);

  // Stage difficulty & boss cadence sanity
  assert.equal(isBossStage(5), true);
  assert.equal(getWaveEnemyCount(5, WAVES_PER_STAGE), 3);
  assert.ok(getStageDifficultyMultipliers(5).hpScale > getStageDifficultyMultipliers(1).hpScale);
  assert.ok(getWaveClearBonus(5, WAVES_PER_STAGE) > getWaveClearBonus(1, 1));
});

test('10. Stage 3: Daily (5 missions, daily reset) and Weekly Missions (5 large missions, 7-day reset)', () => {
  const day1Ms = new Date(2026, 10, 19, 10, 0, 0).getTime(); // Thu Nov 19 2026
  const day2Ms = new Date(2026, 10, 20, 8, 0, 0).getTime();  // Fri Nov 20 2026 (same week)
  const nextWeekMs = new Date(2026, 10, 23, 8, 0, 0).getTime(); // Mon Nov 23 2026 (next week)

  assert.equal(DAILY_MISSION_POOL.length, 7);

  let daily = generateDailyMissions(getLocalDateKey(day1Ms));
  let weekly = generateWeeklyMissions(getWeekStartDateKey(day1Ms));
  assert.equal(daily.missions.length, DAILY_MISSION_COUNT);
  assert.equal(weekly.missions.length, WEEKLY_MISSION_COUNT);

  // Track all objectives across daily + weekly
  for (const obj of [
    'defeat_enemies',
    'complete_dungeons',
    'forge_equipment',
    'upgrade_equipment',
    'activate_skills',
    'defeat_dungeon_bosses',
    'collect_scrap',
    'defeat_bosses',
    'upgrade_skills',
  ] as const) {
    const updated = recordMissionProgress({
      daily,
      weekly,
      objective: obj,
      amount: 5000,
      nowMs: day1Ms,
    });
    daily = updated.daily;
    weekly = updated.weekly;
  }

  for (const m of daily.missions) {
    assert.equal(m.progress, m.target, `Daily mission ${m.id} reached target`);
  }
  for (const m of weekly.missions) {
    assert.equal(m.progress, m.target, `Weekly mission ${m.id} reached target`);
  }

  // Claim once succeeds; duplicate claim is rejected
  const firstDailyId = daily.missions[0].id;
  const claim1 = claimDailyMission(daily, firstDailyId, day1Ms);
  assert.equal(claim1.success, true);
  assert.ok(claim1.rewards);
  daily = claim1.state;

  const duplicateDaily = claimDailyMission(daily, firstDailyId, day1Ms);
  assert.equal(duplicateDaily.success, false);

  const firstWeeklyId = weekly.missions[0].id;
  const claimW1 = claimWeeklyMission(weekly, firstWeeklyId, day1Ms);
  assert.equal(claimW1.success, true);
  weekly = claimW1.state;
  assert.equal(claimWeeklyMission(weekly, firstWeeklyId, day1Ms).success, false);

  // Day 2 resets Daily Missions, preserves Weekly Missions within same Monday week
  const refreshedDay2Daily = refreshDailyMissions(daily, day2Ms);
  assert.equal(refreshedDay2Daily.dateKey, getLocalDateKey(day2Ms));
  assert.equal(refreshedDay2Daily.missions.every((m) => m.progress === 0 && !m.claimed), true);

  const refreshedDay2Weekly = refreshWeeklyMissions(weekly, day2Ms);
  assert.equal(refreshedDay2Weekly.weekStartDate, getWeekStartDateKey(day1Ms));
  assert.equal(refreshedDay2Weekly.missions[0].claimed, true);

  // Next Monday resets Weekly Missions cleanly
  const refreshedNextWeek = refreshWeeklyMissions(weekly, nextWeekMs);
  assert.equal(refreshedNextWeek.weekStartDate, getWeekStartDateKey(nextWeekMs));
  assert.equal(refreshedNextWeek.missions.every((m) => m.progress === 0 && !m.claimed), true);
});

test('11. Stage 3: 7-Day Daily Login Rewards enforce 1/day limit, grant chests/currencies, and wrap after Day 7', () => {
  assert.equal(LOGIN_REWARD_CALENDAR.length, 7);
  assert.ok(LOGIN_REWARD_CALENDAR[0].rewards.scrap);
  assert.ok(LOGIN_REWARD_CALENDAR[1].rewards.forgeCores);
  assert.equal(LOGIN_REWARD_CALENDAR[2].rewards.equipmentChest, 'standard');
  assert.ok(LOGIN_REWARD_CALENDAR[3].rewards.scrap);
  assert.equal(LOGIN_REWARD_CALENDAR[4].rewards.chests?.advanced, 1);
  assert.ok(LOGIN_REWARD_CALENDAR[5].rewards.forgeCores);
  assert.equal(LOGIN_REWARD_CALENDAR[6].rewards.equipmentChest, 'premium');

  let cal = createDefaultLoginCalendar();
  let wallet = createInitialWallet();
  let chests = createInitialChests();
  let inventory: EquipmentItem[] = [];

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const dayMs = new Date(2026, 10, 1 + dayOffset, 9, 0, 0).getTime();
    assert.equal(canClaimLoginReward(cal, dayMs), true);

    const res = claimLoginReward(cal, dayMs);
    assert.equal(res.success, true);
    cal = res.state;

    // Duplicate claim on the same day must be blocked
    const dup = claimLoginReward(cal, dayMs);
    assert.equal(dup.success, false);
    assert.equal(canClaimLoginReward(cal, dayMs), false);

    const bundled = grantProgressionRewardBundle({
      rewards: res.rewardDay!.rewards,
      wallet,
      chests,
      inventory,
      tankLevel: 30,
      rng: () => 0.1,
    });
    wallet = bundled.wallet;
    chests = bundled.chests;
    inventory = bundled.inventory;

    if (dayOffset === 6) {
      assert.equal(res.rewardDay?.day, 7);
      assert.ok(bundled.droppedEquipment);
      assert.equal(bundled.droppedEquipment?.rarity, 'prototype');
    }
    if (dayOffset === 7) {
      // Day 8 wraps seamlessly back to Day 1
      assert.equal(res.rewardDay?.day, 1);
      assert.equal(cal.claimedDays, 1);
    }
  }
  assert.ok(inventory.length >= 2, 'Day 3 & Day 7 chests granted equipment items');
  assert.ok(chests.advanced >= 1, 'Day 5 granted Advanced Skill Chest');
});

test('12. Stage 3: Permanent Achievements (6 categories) & Tank Progression Milestones (Lv.10..50)', () => {
  assert.equal(ACHIEVEMENT_CATEGORIES.length, 6);
  for (const cat of ACHIEVEMENT_CATEGORIES) {
    assert.ok(
      ACHIEVEMENTS.some((a) => a.category === cat.id),
      `Category ${cat.id} has achievements`,
    );
  }

  const skills = createDefaultSkills();
  skills.railgun_shot = { id: 'railgun_shot', unlocked: true, level: 10, duplicates: 0 };

  const dungeonProgress = createDefaultDungeonProgress();
  dungeonProgress.salvage_yard = { highestClearedStage: 10, clears: 12, bossClears: 12 };

  const lifetime = createDefaultLifetimeStats();
  lifetime.enemiesDefeated = 10_000;
  lifetime.itemsForged = 100;
  lifetime.prototypeObtained = true;

  const ctx = {
    lifetimeStats: lifetime,
    equippedGear: DEFAULT_EQUIPPED_GEAR,
    equipmentInventory: [],
    skills,
    dungeonProgress,
    tankLevel: 50,
    highestStage: 15,
    totalKills: 10_000,
  };

  let claimedIds: string[] = [];
  for (const requiredId of [
    'ach_first_blood',
    'ach_tank_commander',
    'ach_master_forger',
    'ach_prototype_hunter',
    'ach_skill_specialist',
    'ach_dungeon_conqueror',
  ]) {
    const def = ACHIEVEMENTS.find((a) => a.id === requiredId)!;
    assert.ok(getAchievementProgress(def, ctx) >= def.target, `${requiredId} should be ready`);
    const c1 = claimAchievement(requiredId, claimedIds, ctx);
    assert.equal(c1.success, true);
    claimedIds = c1.claimedIds;
    // Prevent duplicate claim
    assert.equal(claimAchievement(requiredId, claimedIds, ctx).success, false);
  }

  // Tank Milestones including Lv. 10, 15, 25 Auto Forge, 30, 40 Scrap Bonus, 50 Apex Skin
  assert.ok(TANK_MILESTONES.some((m) => m.level === 25 && m.rewards.featureUnlockLabel));
  assert.ok(TANK_MILESTONES.some((m) => m.level === 50 && m.rewards.featureUnlockLabel));

  let claimedLevels: number[] = [];
  for (const lvl of [10, 15, 25, 30, 40, 50]) {
    const m1 = claimTankMilestone(lvl, claimedLevels, 50);
    assert.equal(m1.success, true, `Milestone Lv.${lvl} claimable at Lv.50`);
    claimedLevels = m1.claimedLevels;
    assert.equal(claimTankMilestone(lvl, claimedLevels, 50).success, false);
  }
  assert.equal(claimTankMilestone(60, claimedLevels, 50).success, false, 'Lv.60 blocked at Lv.50');
});

test('13. Stage 3: Offline Earnings (8h cap, Scrap-only) and full Save/Load Stage 3 persistence', () => {
  const stats = computeTankStats(DEFAULT_UPGRADE_LEVELS, DEFAULT_EQUIPPED_GEAR, 12);
  const baseNow = new Date(2026, 10, 19, 18, 0, 0).getTime();

  // Below 60s threshold -> null
  assert.equal(
    calculateOfflineEarnings({
      lastActiveAt: baseNow - 30_000,
      nowMs: baseNow,
      tankStats: stats,
      highestStage: 8,
    }),
    null,
  );

  // 24 hours away -> capped at 8 hours (28,800s) and grants Scrap only
  const offline24h = calculateOfflineEarnings({
    lastActiveAt: baseNow - 24 * 3600 * 1000,
    nowMs: baseNow,
    tankStats: stats,
    highestStage: 8,
  });
  const offline8h = calculateOfflineEarnings({
    lastActiveAt: baseNow - 8 * 3600 * 1000,
    nowMs: baseNow,
    tankStats: stats,
    highestStage: 8,
  });
  assert.ok(offline24h && offline8h);
  assert.equal(offline24h.wasCapped, true);
  assert.equal(offline24h.cappedSeconds, OFFLINE_EARNINGS_MAX_SECONDS);
  assert.equal(offline24h.scrapEarned, offline8h.scrapEarned);
  assert.ok(offline24h.scrapEarned > 0);

  // Stage 3 Persistence roundtrip via localStorage mock
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };

  const save = createDefaultSaveData();
  save.loginCalendar = { claimedDays: 4, lastClaimDate: getLocalDateKey(baseNow) };
  save.claimedAchievements = ['ach_first_blood'];
  save.claimedMilestones = [5, 10];
  save.lifetimeStats.itemsForged = 17;
  save.apexSkinEnabled = false;
  save.dailyMissions.missions[0].progress = save.dailyMissions.missions[0].target;
  save.weeklyMissions.missions[1].progress = 7;

  persistSaveData(save);
  const loaded = loadSaveData();
  assert.equal(loaded.loginCalendar.claimedDays, 4);
  assert.deepEqual(loaded.claimedAchievements, ['ach_first_blood']);
  assert.deepEqual(loaded.claimedMilestones, [5, 10]);
  assert.equal(loaded.lifetimeStats.itemsForged, 17);
  assert.equal(loaded.apexSkinEnabled, false);
  assert.equal(loaded.dailyMissions.missions[0].progress, loaded.dailyMissions.missions[0].target);
  assert.equal(loaded.weeklyMissions.missions[1].progress, 7);
});

test('14. Stage 4: Elite Enemy Variants, Mini-Bosses, and Multi-Phase Boss Mechanics', () => {
  const stats = computeTankStats(DEFAULT_UPGRADE_LEVELS, DEFAULT_EQUIPPED_GEAR, 1);
  const skills = createDefaultSkills();
  const callbacks = {
    onScrapCollected: () => {},
    onXpGained: () => {},
    onKillRecorded: () => {},
    onStageChanged: () => {},
    onDungeonEnded: () => {},
    onHudUpdate: () => {},
  };

  const engine = new BattleEngine(
    stats,
    3, // Stage 3 mini-boss stage
    3,
    0,
    [null, null, null],
    skills,
    callbacks,
  );

  const snapshot = engine.getHudSnapshot();
  assert.equal(snapshot.stage, 3);
  assert.equal(snapshot.enemiesTotalInWave > 0, true);
});

