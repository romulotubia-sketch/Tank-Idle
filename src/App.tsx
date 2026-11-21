import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, ShieldAlert, Skull, Trophy, Zap } from 'lucide-react';
import { BattleCanvas } from './components/BattleCanvas';
import { BattleForgeStrip, type InlineForgeNotice } from './components/BattleForgeStrip';
import { BattleIntelPanel } from './components/BattleIntelPanel';
import { BottomNav } from './components/BottomNav';
import { DungeonSummaryModal } from './components/DungeonSummaryModal';
import { DungeonsPanel } from './components/DungeonsPanel';
import { EquipmentSlotModal } from './components/EquipmentSlotModal';
import { ForgeModal } from './components/ForgeModal';
import { MissionsPanel } from './components/MissionsPanel';
import { OfflineEarningsModal } from './components/OfflineEarningsModal';
import { SkillChestModal } from './components/SkillChestModal';
import { SkillsPanel } from './components/SkillsPanel';
import { TankStatusBar } from './components/TankStatusBar';
import { TopHud } from './components/TopHud';
import { UpgradePanel } from './components/UpgradePanel';
import { soundFx } from './game/audio';
import {
  ACHIEVEMENTS,
  DUNGEON_CONFIGS,
  EQUIPMENT_RARITY_META,
  MAX_DUNGEON_STAGE,
  MAX_EQUIPMENT_INVENTORY,
  MAX_EQUIPPED_SKILLS,
  TANK_MILESTONES,
  UPGRADE_ORDER,
  createDefaultLifetimeStats,
  createDefaultLoginCalendar,
  getLocalDateKey,
  getWeekStartDateKey,
  isBossStage,
} from './game/config';
import {
  applyDungeonRewards,
  canEnterDungeonStage,
  consumeDailyDungeonEntry,
  generateDungeonRewards,
  recordDungeonCompletion,
  refreshDailyDungeonEntries,
} from './game/dungeons';
import { addChest, addCurrency, getCurrencyBalance, spendCurrency } from './game/economy';
import { BattleEngine } from './game/engine';
import {
  forgeSingleItem,
  runAutoForgeStep,
  salvageEquipmentItem,
  upgradeEquipmentItem,
} from './game/forge';
import {
  enterFullscreen,
  exitFullscreen,
  isDocumentFullscreen,
  isFullscreenSupported,
} from './game/fullscreen';
import { initPlaygamaBridge, signalPlaygamaGameplayStart } from './game/playgama';
import {
  applyTankXp,
  computeTankPower,
  computeTankStats,
  getUpgradeCost,
  isUpgradeMaxed,
} from './game/progression';
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
  type AchievementContext,
} from './game/progressionSystems';
import {
  craftChestWithSkillTech,
  openSkillChest,
  unlockSkillWithTech,
  upgradeSkillWithDuplicates,
} from './game/skills';
import {
  clearSaveData,
  loadSaveData,
  persistSaveData,
} from './game/storage';
import type {
  AutoForgeSettings,
  AutoForgeSummary,
  BattleHudSnapshot,
  ChestInventory,
  ChestReward,
  ChestTierId,
  DailyDungeonEntries,
  DailyMissionsState,
  DungeonCompletionResult,
  DungeonId,
  DungeonProgressMap,
  EquipmentItem,
  EquipmentSlot,
  EquippedGearMap,
  ForgeTierId,
  LifetimeStats,
  LoginCalendarState,
  MissionObjectiveType,
  NavTab,
  OfflineEarningsSummary,
  ProgressionRewardBundle,
  SaveData,
  SkillCollection,
  SkillId,
  UpgradeKey,
  UpgradeLevels,
  Wallet,
  WeeklyMissionsState,
} from './game/types';

export default function App() {
  const initialSaveRef = useRef<SaveData | null>(null);
  if (initialSaveRef.current === null) {
    initialSaveRef.current = loadSaveData();
  }
  const initialSave = initialSaveRef.current;

  const [wallet, setWallet] = useState<Wallet>(initialSave.wallet);
  const [chests, setChests] = useState<ChestInventory>(initialSave.chests);
  const [upgradeLevels, setUpgradeLevels] = useState<UpgradeLevels>(initialSave.upgradeLevels);
  const [tankLevel, setTankLevel] = useState<number>(initialSave.tankLevel);
  const [tankXp, setTankXp] = useState<number>(initialSave.tankXp);
  const [equippedGear, setEquippedGear] = useState<EquippedGearMap>(initialSave.equippedGear);
  const [equipmentInventory, setEquipmentInventory] = useState<EquipmentItem[]>(
    initialSave.equipmentInventory,
  );
  const [skills, setSkills] = useState<SkillCollection>(initialSave.skills);
  const [equippedSkillIds, setEquippedSkillIds] = useState<(SkillId | null)[]>(
    initialSave.equippedSkillIds,
  );
  const [autoSkillsEnabled, setAutoSkillsEnabled] = useState<boolean>(
    initialSave.autoSkillsEnabled,
  );
  const [autoForge, setAutoForge] = useState<AutoForgeSettings>({
    ...initialSave.autoForge,
    enabled: false, // Always start paused on reload so user controls Auto Forge execution
  });
  const [dungeonProgress, setDungeonProgress] = useState<DungeonProgressMap>(
    initialSave.dungeonProgress,
  );
  const [dungeonEntries, setDungeonEntries] = useState<DailyDungeonEntries>(() =>
    refreshDailyDungeonEntries(initialSave.dungeonEntries),
  );
  const [dungeonEntryError, setDungeonEntryError] = useState<string | null>(null);
  const activeDungeonRunRef = useRef<{
    runId: string;
    dungeonId: DungeonId;
    stage: number;
    rewarded: boolean;
  } | null>(null);

  const [dailyMissions, setDailyMissions] = useState<DailyMissionsState>(() =>
    refreshDailyMissions(initialSave.dailyMissions),
  );
  const [weeklyMissions, setWeeklyMissions] = useState<WeeklyMissionsState>(() =>
    refreshWeeklyMissions(initialSave.weeklyMissions),
  );
  const [loginCalendar, setLoginCalendar] = useState<LoginCalendarState>(
    initialSave.loginCalendar,
  );
  const [claimedAchievements, setClaimedAchievements] = useState<string[]>(
    initialSave.claimedAchievements,
  );
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>(
    initialSave.claimedMilestones,
  );
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>(
    initialSave.lifetimeStats,
  );
  const [apexSkinEnabled, setApexSkinEnabled] = useState<boolean>(
    initialSave.apexSkinEnabled,
  );
  const [pendingOfflineEarnings, setPendingOfflineEarnings] =
    useState<OfflineEarningsSummary | null>(() => {
      const statsAtLoad = computeTankStats(
        initialSave.upgradeLevels,
        initialSave.equippedGear,
        initialSave.tankLevel,
      );
      return calculateOfflineEarnings({
        lastActiveAt: initialSave.lastActiveAt || initialSave.savedAt,
        tankStats: statsAtLoad,
        highestStage: initialSave.highestStage,
      });
    });
  const [claimedEquipmentDrop, setClaimedEquipmentDrop] = useState<EquipmentItem | null>(
    null,
  );

  const [stage, setStage] = useState<number>(initialSave.stage);
  const [highestStage, setHighestStage] = useState<number>(initialSave.highestStage);
  const [totalKills, setTotalKills] = useState<number>(initialSave.totalKills);
  const [isMuted, setIsMuted] = useState<boolean>(initialSave.muted);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(() => isDocumentFullscreen());
  const [isExpandedFullscreen, setIsExpandedFullscreen] = useState<boolean>(false);
  const isFullscreen = isNativeFullscreen || isExpandedFullscreen;
  const canFullscreen = useMemo(() => isFullscreenSupported(), []);
  const manualExitFullscreenRef = useRef<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  // Modals & transient Forge/Chest/Dungeon summaries
  const [forgeOpen, setForgeOpen] = useState<boolean>(false);
  const [selectedForgeSlot, setSelectedForgeSlot] = useState<EquipmentSlot>('cannon');
  const [selectedForgeTier, setSelectedForgeTier] = useState<ForgeTierId>('standard');
  const [inspectedSlot, setInspectedSlot] = useState<EquipmentSlot | null>(null);
  const [inlineForgeNotice, setInlineForgeNotice] = useState<InlineForgeNotice | null>(null);
  const [inlineStorageWarning, setInlineStorageWarning] = useState<string | null>(null);
  const [lastForgedItem, setLastForgedItem] = useState<EquipmentItem | null>(null);
  const [autoForgeSummary, setAutoForgeSummary] = useState<AutoForgeSummary>({
    attempts: 0,
    scrapSpent: 0,
    coresSpent: 0,
    salvagedCount: 0,
    lastItem: null,
    stopReason: null,
  });
  const [chestReward, setChestReward] = useState<ChestReward | null>(null);
  const [dungeonResult, setDungeonResult] = useState<DungeonCompletionResult | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return 'upgrades';
    }
    return 'battle';
  });

  const tankStats = useMemo(
    () => computeTankStats(upgradeLevels, equippedGear, tankLevel),
    [upgradeLevels, equippedGear, tankLevel],
  );

  const tankPower = useMemo(() => computeTankPower(tankStats), [tankStats]);

  // Keep refs for callbacks invoked by engine/timers without stale closures
  const stateRef = useRef({
    wallet,
    chests,
    tankLevel,
    tankXp,
    equippedGear,
    equipmentInventory,
    skills,
    equippedSkillIds,
    autoForge,
    dungeonProgress,
    dungeonEntries,
    dailyMissions,
    weeklyMissions,
    loginCalendar,
    claimedAchievements,
    claimedMilestones,
    lifetimeStats,
    apexSkinEnabled,
  });
  stateRef.current = {
    wallet,
    chests,
    tankLevel,
    tankXp,
    equippedGear,
    equipmentInventory,
    skills,
    equippedSkillIds,
    autoForge,
    dungeonProgress,
    dungeonEntries,
    dailyMissions,
    weeklyMissions,
    loginCalendar,
    claimedAchievements,
    claimedMilestones,
    lifetimeStats,
    apexSkinEnabled,
  };

  const latestSaveRef = useRef<SaveData>({
    ...initialSave,
    wallet,
    chests,
    upgradeLevels,
    tankLevel,
    tankXp,
    equippedGear,
    equipmentInventory,
    skills,
    equippedSkillIds,
    autoSkillsEnabled,
    autoForge,
    dungeonProgress,
    dungeonEntries,
    dailyMissions,
    weeklyMissions,
    loginCalendar,
    claimedAchievements,
    claimedMilestones,
    lifetimeStats,
    apexSkinEnabled,
    lastActiveAt: Date.now(),
    stage,
    highestStage,
    totalKills,
    muted: isMuted,
  });

  useEffect(() => {
    latestSaveRef.current = {
      version: initialSave.version,
      wallet,
      chests,
      upgradeLevels,
      tankLevel,
      tankXp,
      equippedGear,
      equipmentInventory,
      skills,
      equippedSkillIds,
      autoSkillsEnabled,
      autoForge,
      dungeonProgress,
      dungeonEntries,
      dailyMissions,
      weeklyMissions,
      loginCalendar,
      claimedAchievements,
      claimedMilestones,
      lifetimeStats,
      apexSkinEnabled,
      lastActiveAt: Date.now(),
      stage,
      highestStage,
      totalKills,
      muted: isMuted,
      savedAt: Date.now(),
    };
  }, [
    initialSave.version,
    wallet,
    chests,
    upgradeLevels,
    tankLevel,
    tankXp,
    equippedGear,
    equipmentInventory,
    skills,
    equippedSkillIds,
    autoSkillsEnabled,
    autoForge,
    dungeonProgress,
    dungeonEntries,
    dailyMissions,
    weeklyMissions,
    loginCalendar,
    claimedAchievements,
    claimedMilestones,
    lifetimeStats,
    apexSkinEnabled,
    stage,
    highestStage,
    totalKills,
    isMuted,
  ]);

  const recordObjectiveProgress = useCallback(
    (objective: MissionObjectiveType, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      setDailyMissions(
        (prevDaily) =>
          recordMissionProgress({
            daily: prevDaily,
            weekly: stateRef.current.weeklyMissions,
            objective,
            amount,
          }).daily,
      );
      setWeeklyMissions(
        (prevWeekly) =>
          recordMissionProgress({
            daily: stateRef.current.dailyMissions,
            weekly: prevWeekly,
            objective,
            amount,
          }).weekly,
      );
    },
    [],
  );

  const [hud, setHud] = useState<BattleHudSnapshot>(() => ({
    mode: 'campaign',
    activeDungeonId: null,
    activeDungeonName: null,
    dungeonStage: 0,
    stage: initialSave.stage,
    wave: 1,
    wavesPerStage: 3,
    stageThemeName: 'Sector 01 · Proving Grounds',
    isBossWave: false,
    bossName: null,
    bossHp: 0,
    bossMaxHp: 0,
    enemiesRemaining: 4,
    enemiesTotalInWave: 4,
    enemiesDefeatedInWave: 0,
    playerHp: tankStats.maxHp,
    playerMaxHp: tankStats.maxHp,
    isRecovering: false,
    recoveryTimer: 0,
    waveTransitionTimer: 0,
    stageBannerText: null,
    stageBannerTimer: 0,
    totalKills: initialSave.totalKills,
    highestStage: initialSave.highestStage,
    skillCooldowns: [],
    autoSkillsEnabled: initialSave.autoSkillsEnabled,
    overdriveActive: false,
    repairDroneActive: false,
  }));

  const engineRef = useRef<BattleEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new BattleEngine(
      tankStats,
      initialSave.stage,
      initialSave.highestStage,
      initialSave.totalKills,
      initialSave.equippedSkillIds,
      initialSave.skills,
      {
        onScrapCollected: (amount) => {
          setWallet((prev) => addCurrency(prev, 'scrap', amount));
          setLifetimeStats((prev) => ({
            ...prev,
            scrapCollected: prev.scrapCollected + amount,
          }));
          recordObjectiveProgress('collect_scrap', amount);
        },
        onXpGained: (xp) => {
          setTankXp((prevXp) => {
            const res = applyTankXp(stateRef.current.tankLevel, prevXp, xp);
            if (res.levelsGained > 0) {
              setTankLevel(res.tankLevel);
            }
            return res.tankXp;
          });
        },
        onKillRecorded: () => {
          setTotalKills((prev) => prev + 1);
          setLifetimeStats((prev) => ({
            ...prev,
            enemiesDefeated: prev.enemiesDefeated + 1,
          }));
          recordObjectiveProgress('defeat_enemies', 1);
        },
        onBossDefeated: (isDungeonBoss) => {
          setLifetimeStats((prev) => ({
            ...prev,
            bossesDefeated: prev.bossesDefeated + 1,
            dungeonBossesDefeated:
              prev.dungeonBossesDefeated + (isDungeonBoss ? 1 : 0),
          }));
          recordObjectiveProgress('defeat_bosses', 1);
          if (isDungeonBoss) {
            recordObjectiveProgress('defeat_dungeon_bosses', 1);
          }
        },
        onSkillActivated: () => {
          setLifetimeStats((prev) => ({
            ...prev,
            skillsActivated: prev.skillsActivated + 1,
          }));
          recordObjectiveProgress('activate_skills', 1);
        },
        onStageChanged: (newStage) => {
          setStage(newStage);
          setHighestStage((prev) => Math.max(prev, newStage));
          if (newStage > 1 && isBossStage(newStage - 1)) {
            setChests((prev) => addChest(prev, 'standard', 1));
          }
        },
        onDungeonEnded: (dungeonId, dungeonStage, victory, wavesCleared, totalWaves) => {
          const activeRun = activeDungeonRunRef.current;
          if (
            !activeRun ||
            activeRun.rewarded ||
            activeRun.dungeonId !== dungeonId ||
            activeRun.stage !== dungeonStage
          ) {
            return;
          }
          activeRun.rewarded = true;

          const cur = stateRef.current;
          const rewards = generateDungeonRewards({
            dungeonId,
            stage: dungeonStage,
            tankLevel: cur.tankLevel,
            victory,
            wavesCleared,
            totalWaves,
          });

          let newlyUnlockedStage: number | null = null;
          if (victory) {
            const applied = applyDungeonRewards({
              wallet: cur.wallet,
              chests: cur.chests,
              inventory: cur.equipmentInventory,
              rewards,
            });
            setWallet(applied.wallet);
            setChests(applied.chests);
            setEquipmentInventory(applied.inventory);

            const completion = recordDungeonCompletion(
              dungeonId,
              dungeonStage,
              true,
              cur.dungeonProgress,
            );
            newlyUnlockedStage = completion.newlyUnlockedStage;
            setDungeonProgress(completion.progress);

            const foundPrototype = rewards.equipment.some(
              (item) => item.rarity === 'prototype',
            );
            setLifetimeStats((prev) => ({
              ...prev,
              dungeonsCompleted: prev.dungeonsCompleted + 1,
              scrapCollected: prev.scrapCollected + rewards.scrap,
              prototypeObtained: prev.prototypeObtained || foundPrototype,
            }));
            recordObjectiveProgress('complete_dungeons', 1);
            if (rewards.scrap > 0) {
              recordObjectiveProgress('collect_scrap', rewards.scrap);
            }

            soundFx.playWaveClear();
          }

          const cfg = DUNGEON_CONFIGS[dungeonId];
          const isFinalBoss = dungeonStage === MAX_DUNGEON_STAGE;
          setIsPaused(true);
          setDungeonResult({
            runId: activeRun.runId,
            dungeonId,
            dungeonName: cfg.name,
            stage: dungeonStage,
            victory,
            wavesCleared,
            totalWaves,
            bossName: isFinalBoss ? cfg.finalBossName : cfg.bossName,
            isFinalBoss,
            newlyUnlockedStage,
            rewards,
          });
        },
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
      },
    );
  }
  const engine = engineRef.current;

  // Sync TankStats into BattleEngine whenever upgrades, equipment, or tank level changes
  useEffect(() => {
    engine.updatePlayerStats(tankStats);
  }, [engine, tankStats]);

  // Sync Lv. 50 Apex Vanguard tank visual customization
  useEffect(() => {
    engine.setApexCustomization(tankLevel >= 50 && apexSkinEnabled);
  }, [engine, tankLevel, apexSkinEnabled]);

  // Sync Skill loadout & auto-cast setting into BattleEngine
  useEffect(() => {
    engine.updateSkillLoadout(equippedSkillIds, skills);
  }, [engine, equippedSkillIds, skills]);

  useEffect(() => {
    engine.setAutoSkillsEnabled(autoSkillsEnabled);
  }, [engine, autoSkillsEnabled]);

  useEffect(() => {
    soundFx.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    engine.setPaused(isPaused);
  }, [engine, isPaused]);

  // Playgama lifecycle, fullscreen default & visibility persistence
  useEffect(() => {
    void initPlaygamaBridge((hidden) => {
      if (hidden) {
        persistSaveData(latestSaveRef.current);
      }
    });
    signalPlaygamaGameplayStart();

    const syncFullscreenState = () => {
      const active = isDocumentFullscreen();
      setIsNativeFullscreen(active);
      if (active) {
        setIsExpandedFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    document.addEventListener('msfullscreenchange', syncFullscreenState);

    // Attempt native fullscreen immediately on launch; if browser blocks pre-gesture fullscreen,
    // attempt native fullscreen on the first user interaction.
    let gestureTriggered = false;
    const handleFirstGesture = (event: Event) => {
      if (gestureTriggered) return;
      gestureTriggered = true;
      window.removeEventListener('pointerdown', handleFirstGesture, true);
      window.removeEventListener('keydown', handleFirstGesture, true);

      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-fullscreen-toggle]')) return;

      if (!manualExitFullscreenRef.current && !isDocumentFullscreen()) {
        void enterFullscreen().then((entered) => {
          if (entered) setIsNativeFullscreen(true);
        });
      }
    };

    if (canFullscreen) {
      void enterFullscreen().then((entered) => {
        if (entered) {
          setIsNativeFullscreen(true);
        } else if (!manualExitFullscreenRef.current) {
          window.addEventListener('pointerdown', handleFirstGesture, true);
          window.addEventListener('keydown', handleFirstGesture, true);
        }
      });
    }

    const handleBeforeUnload = () => persistSaveData(latestSaveRef.current);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistSaveData(latestSaveRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      document.removeEventListener('msfullscreenchange', syncFullscreenState);
      window.removeEventListener('pointerdown', handleFirstGesture, true);
      window.removeEventListener('keydown', handleFirstGesture, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canFullscreen]);

  // Periodic save & daily/weekly calendar resets
  useEffect(() => {
    const timer = window.setInterval(() => {
      persistSaveData(latestSaveRef.current);
      setDungeonEntries((prev) => refreshDailyDungeonEntries(prev));
      setDailyMissions((prev) => refreshDailyMissions(prev));
      setWeeklyMissions((prev) => refreshWeeklyMissions(prev));
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    persistSaveData(latestSaveRef.current);
  }, [
    upgradeLevels,
    stage,
    tankLevel,
    equippedGear,
    skills,
    equippedSkillIds,
    autoSkillsEnabled,
    dungeonProgress,
    dungeonEntries,
    dailyMissions,
    weeklyMissions,
    loginCalendar,
    claimedAchievements,
    claimedMilestones,
    apexSkinEnabled,
    isMuted,
  ]);

  // Auto Forge timed loop
  useEffect(() => {
    if (!autoForge.enabled || !forgeOpen) return;

    const timer = window.setInterval(() => {
      const cur = stateRef.current;
      const stepRes = runAutoForgeStep({
        settings: cur.autoForge,
        tankLevel: cur.tankLevel,
        wallet: cur.wallet,
        inventory: cur.equipmentInventory,
      });

      setWallet(stepRes.wallet);
      setEquipmentInventory(stepRes.inventory);
      if (stepRes.forgedItem) {
        const forged = stepRes.forgedItem;
        setLastForgedItem(forged);
        setLifetimeStats((prev) => ({
          ...prev,
          itemsForged: prev.itemsForged + 1,
          prototypeObtained: prev.prototypeObtained || forged.rarity === 'prototype',
        }));
        recordObjectiveProgress('forge_equipment', 1);
        const isHigh = EQUIPMENT_RARITY_META[forged.rarity].rank >= 4;
        soundFx.playForgeClang(isHigh);
      }

      setAutoForgeSummary((prev) => ({
        attempts: prev.attempts + (stepRes.forgedItem ? 1 : 0),
        scrapSpent: prev.scrapSpent + stepRes.scrapSpent,
        coresSpent: prev.coresSpent + stepRes.coresSpent,
        salvagedCount: prev.salvagedCount + (stepRes.salvaged ? 1 : 0),
        lastItem: stepRes.forgedItem ?? prev.lastItem,
        stopReason: stepRes.stopReason,
      }));

      if (!stepRes.continueLoop) {
        setAutoForge((prev) => ({ ...prev, enabled: false }));
      }
    }, 360);

    return () => window.clearInterval(timer);
  }, [autoForge.enabled, forgeOpen, recordObjectiveProgress]);

  const scrapBalance = getCurrencyBalance(wallet, 'scrap');
  const forgeCoresBalance = getCurrencyBalance(wallet, 'forgeCores');
  const skillTechBalance = getCurrencyBalance(wallet, 'skillTech');

  const affordableUpgradesCount = useMemo(() => {
    return UPGRADE_ORDER.filter((key) => {
      const lvl = upgradeLevels[key];
      if (isUpgradeMaxed(key, lvl)) return false;
      return scrapBalance >= getUpgradeCost(key, lvl);
    }).length;
  }, [upgradeLevels, scrapBalance]);

  const unopenedChestsCount = useMemo(
    () => (chests.standard ?? 0) + (chests.advanced ?? 0) + (chests.elite ?? 0),
    [chests],
  );

  const refreshedDungeonEntries = useMemo(
    () => refreshDailyDungeonEntries(dungeonEntries),
    [dungeonEntries],
  );

  const dungeonReadyCount = refreshedDungeonEntries.remaining;

  const achievementContext: AchievementContext = useMemo(
    () => ({
      lifetimeStats,
      equippedGear,
      equipmentInventory,
      skills,
      dungeonProgress,
      tankLevel,
      highestStage,
      totalKills,
    }),
    [
      lifetimeStats,
      equippedGear,
      equipmentInventory,
      skills,
      dungeonProgress,
      tankLevel,
      highestStage,
      totalKills,
    ],
  );

  const claimableProgressionCount = useMemo(() => {
    const dailyReady = dailyMissions.missions.filter(
      (m) => !m.claimed && m.progress >= m.target,
    ).length;
    const weeklyReady = weeklyMissions.missions.filter(
      (m) => !m.claimed && m.progress >= m.target,
    ).length;
    const loginReady = canClaimLoginReward(loginCalendar) ? 1 : 0;
    const achReady = ACHIEVEMENTS.filter(
      (a) =>
        !claimedAchievements.includes(a.id) &&
        getAchievementProgress(a, achievementContext) >= a.target,
    ).length;
    const milestoneReady = TANK_MILESTONES.filter(
      (m) => tankLevel >= m.level && !claimedMilestones.includes(m.level),
    ).length;
    return dailyReady + weeklyReady + loginReady + achReady + milestoneReady;
  }, [
    dailyMissions.missions,
    weeklyMissions.missions,
    loginCalendar,
    claimedAchievements,
    claimedMilestones,
    achievementContext,
    tankLevel,
  ]);

  const inInventoryIds = useMemo(
    () => new Set(equipmentInventory.map((item) => item.id)),
    [equipmentInventory],
  );

  // Handlers: Upgrades
  const handleUpgrade = useCallback(
    (key: UpgradeKey) => {
      soundFx.unlock();
      const currentLevel = upgradeLevels[key];
      if (isUpgradeMaxed(key, currentLevel)) return;
      const cost = getUpgradeCost(key, currentLevel);

      const result = spendCurrency(wallet, 'scrap', cost);
      if (!result.success) return;

      const nextLevels: UpgradeLevels = {
        ...upgradeLevels,
        [key]: currentLevel + 1,
      };
      setWallet(result.wallet);
      setUpgradeLevels(nextLevels);
      soundFx.playUpgrade();
    },
    [upgradeLevels, wallet],
  );

  // Handlers: Forge & Equipment
  const handleManualForge = useCallback(
    (tierId: ForgeTierId) => {
      soundFx.unlock();
      if (equipmentInventory.length >= MAX_EQUIPMENT_INVENTORY) {
        setAutoForgeSummary((prev) => ({
          ...prev,
          stopReason: 'Armory storage full (24/24). Salvage or equip an item before forging.',
        }));
        return;
      }

      const res = forgeSingleItem({
        wallet,
        tierId,
        tankLevel,
      });
      if (!res.success || !res.item) return;

      const forged = res.item;
      setWallet(res.wallet);
      setEquipmentInventory((prev) => [forged, ...prev]);
      setLastForgedItem(forged);
      setInlineStorageWarning(null);
      setLifetimeStats((prev) => ({
        ...prev,
        itemsForged: prev.itemsForged + 1,
        prototypeObtained: prev.prototypeObtained || forged.rarity === 'prototype',
      }));
      recordObjectiveProgress('forge_equipment', 1);
      soundFx.playForgeClang(EQUIPMENT_RARITY_META[forged.rarity].rank >= 4);
    },
    [equipmentInventory.length, recordObjectiveProgress, tankLevel, wallet],
  );

  const handleInlineForge = useCallback(
    (slot: EquipmentSlot, tierId: ForgeTierId) => {
      soundFx.unlock();
      const currentEquipped = equippedGear[slot];
      if (currentEquipped !== null && equipmentInventory.length >= MAX_EQUIPMENT_INVENTORY) {
        setInlineStorageWarning('Storage full (24/24). Salvage gear before forging.');
        return;
      }

      const res = forgeSingleItem({
        wallet,
        tierId,
        tankLevel,
        forcedSlot: slot,
      });
      if (!res.success || !res.item) return;

      const forged = res.item;
      setInlineStorageWarning(null);
      setWallet(res.wallet);
      setLastForgedItem(forged);
      setLifetimeStats((prev) => ({
        ...prev,
        itemsForged: prev.itemsForged + 1,
        prototypeObtained: prev.prototypeObtained || forged.rarity === 'prototype',
      }));
      recordObjectiveProgress('forge_equipment', 1);

      const shouldAutoEquip =
        currentEquipped === null || forged.powerScore > currentEquipped.powerScore;

      if (shouldAutoEquip) {
        setEquippedGear((prev) => ({
          ...prev,
          [slot]: forged,
        }));
        if (currentEquipped) {
          setEquipmentInventory((prev) =>
            [currentEquipped, ...prev].slice(0, MAX_EQUIPMENT_INVENTORY),
          );
        }
      } else {
        setEquipmentInventory((prev) =>
          [forged, ...prev].slice(0, MAX_EQUIPMENT_INVENTORY),
        );
      }

      setInlineForgeNotice({
        item: forged,
        autoEquipped: shouldAutoEquip,
        timestamp: Date.now(),
      });
      soundFx.playForgeClang(EQUIPMENT_RARITY_META[forged.rarity].rank >= 4);
    },
    [equipmentInventory.length, equippedGear, recordObjectiveProgress, tankLevel, wallet],
  );

  const handleEquipItem = useCallback(
    (item: EquipmentItem) => {
      soundFx.unlock();
      const previous = equippedGear[item.slot];
      setEquippedGear((prev) => ({
        ...prev,
        [item.slot]: item,
      }));
      setEquipmentInventory((prev) => {
        const filtered = prev.filter((i) => i.id !== item.id);
        return previous ? [previous, ...filtered] : filtered;
      });
      setInlineForgeNotice((prev) =>
        prev && prev.item.id === item.id ? { ...prev, autoEquipped: true } : prev,
      );
      setClaimedEquipmentDrop((prev) => (prev?.id === item.id ? null : prev));
      setInlineStorageWarning(null);
      soundFx.playUpgrade();
    },
    [equippedGear],
  );

  const handleUpgradeItem = useCallback(
    (itemId: string, equippedSlot?: EquipmentSlot) => {
      soundFx.unlock();
      if (equippedSlot) {
        const target = equippedGear[equippedSlot];
        if (!target || target.id !== itemId) return;
        const res = upgradeEquipmentItem(target, wallet);
        if (!res.success) return;
        setWallet(res.wallet);
        setEquippedGear((prev) => ({ ...prev, [equippedSlot]: res.item }));
        setLifetimeStats((prev) => ({
          ...prev,
          equipmentUpgraded: prev.equipmentUpgraded + 1,
        }));
        recordObjectiveProgress('upgrade_equipment', 1);
        soundFx.playUpgrade();
        return;
      }

      const target = equipmentInventory.find((i) => i.id === itemId);
      if (!target) return;
      const res = upgradeEquipmentItem(target, wallet);
      if (!res.success) return;
      setWallet(res.wallet);
      setEquipmentInventory((prev) => prev.map((i) => (i.id === itemId ? res.item : i)));
      setLifetimeStats((prev) => ({
        ...prev,
        equipmentUpgraded: prev.equipmentUpgraded + 1,
      }));
      recordObjectiveProgress('upgrade_equipment', 1);
      soundFx.playUpgrade();
    },
    [equipmentInventory, equippedGear, recordObjectiveProgress, wallet],
  );

  const handleSalvageItem = useCallback(
    (itemId: string) => {
      soundFx.unlock();
      const target = equipmentInventory.find((i) => i.id === itemId);
      if (!target) return;
      setWallet((prev) => salvageEquipmentItem(target, prev));
      setEquipmentInventory((prev) => prev.filter((i) => i.id !== itemId));
      setInlineStorageWarning(null);
      soundFx.playUpgrade();
    },
    [equipmentInventory],
  );

  const handleUpdateAutoForge = useCallback((patch: Partial<AutoForgeSettings>) => {
    setAutoForge((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleToggleAutoForgeRun = useCallback(() => {
    soundFx.unlock();
    setAutoForge((prev) => {
      const nextEnabled = !prev.enabled;
      if (nextEnabled) {
        setAutoForgeSummary({
          attempts: 0,
          scrapSpent: 0,
          coresSpent: 0,
          salvagedCount: 0,
          lastItem: null,
          stopReason: null,
        });
      }
      return { ...prev, enabled: nextEnabled };
    });
  }, []);

  // Handlers: Skills & Chests
  const handleToggleAutoSkills = useCallback(() => {
    soundFx.unlock();
    setAutoSkillsEnabled((prev) => !prev);
  }, []);

  const handleAssignSkillSlot = useCallback(
    (skillId: SkillId, slotIndex?: number) => {
      soundFx.unlock();
      if (!skills[skillId]?.unlocked) return;
      setEquippedSkillIds((prev) => {
        const next = [...prev];
        const existingIdx = next.indexOf(skillId);
        if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < MAX_EQUIPPED_SKILLS) {
          if (existingIdx !== -1 && existingIdx !== slotIndex) {
            next[existingIdx] = next[slotIndex];
          }
          next[slotIndex] = skillId;
          return next;
        }
        if (existingIdx !== -1) return prev;
        const emptyIdx = next.findIndex((s) => s === null);
        if (emptyIdx === -1) return prev;
        next[emptyIdx] = skillId;
        return next;
      });
      soundFx.playUpgrade();
    },
    [skills],
  );

  const handleUnequipSkillSlot = useCallback((slotIndex: number) => {
    setEquippedSkillIds((prev) => {
      if (slotIndex < 0 || slotIndex >= MAX_EQUIPPED_SKILLS) return prev;
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  const handleUnlockSkill = useCallback(
    (skillId: SkillId) => {
      soundFx.unlock();
      const res = unlockSkillWithTech(skillId, skills, wallet);
      if (!res.success) return;
      setSkills(res.skills);
      setWallet(res.wallet);
      soundFx.playUpgrade();
    },
    [skills, wallet],
  );

  const handleUpgradeSkill = useCallback(
    (skillId: SkillId) => {
      soundFx.unlock();
      const res = upgradeSkillWithDuplicates(skillId, skills);
      if (!res.success) return;
      setSkills(res.skills);
      setLifetimeStats((prev) => ({
        ...prev,
        skillsUpgraded: prev.skillsUpgraded + 1,
      }));
      recordObjectiveProgress('upgrade_skills', 1);
      soundFx.playUpgrade();
    },
    [recordObjectiveProgress, skills],
  );

  const handleOpenChest = useCallback(
    (tier: ChestTierId) => {
      soundFx.unlock();
      const res = openSkillChest({
        tier,
        chests,
        skills,
        wallet,
      });
      if (!res.success || !res.reward) return;
      setChests(res.chests);
      setSkills(res.skills);
      setWallet(res.wallet);
      setChestReward(res.reward);
      soundFx.playChestOpen();
    },
    [chests, skills, wallet],
  );

  const handleCraftChest = useCallback(() => {
    soundFx.unlock();
    const res = craftChestWithSkillTech(chests, wallet);
    if (!res.success) return;
    setChests(res.chests);
    setWallet(res.wallet);
    soundFx.playUpgrade();
  }, [chests, wallet]);

  // Handlers: Stage 3 Progression & Retention
  const applyProgressionRewards = useCallback((rewards: ProgressionRewardBundle) => {
    const cur = stateRef.current;
    const bundled = grantProgressionRewardBundle({
      rewards,
      wallet: cur.wallet,
      chests: cur.chests,
      inventory: cur.equipmentInventory,
      tankLevel: cur.tankLevel,
    });
    setWallet(bundled.wallet);
    setChests(bundled.chests);
    setEquipmentInventory(bundled.inventory);
    if (bundled.droppedEquipment) {
      setClaimedEquipmentDrop(bundled.droppedEquipment);
    }
    if (bundled.obtainedPrototype) {
      setLifetimeStats((prev) => ({ ...prev, prototypeObtained: true }));
    }
  }, []);

  const handleClaimDailyMission = useCallback(
    (missionId: string) => {
      soundFx.unlock();
      const res = claimDailyMission(dailyMissions, missionId);
      setDailyMissions(res.state);
      if (!res.success || !res.rewards) return;
      applyProgressionRewards(res.rewards);
      soundFx.playWaveClear();
    },
    [applyProgressionRewards, dailyMissions],
  );

  const handleClaimWeeklyMission = useCallback(
    (missionId: string) => {
      soundFx.unlock();
      const res = claimWeeklyMission(weeklyMissions, missionId);
      setWeeklyMissions(res.state);
      if (!res.success || !res.rewards) return;
      applyProgressionRewards(res.rewards);
      soundFx.playWaveClear();
    },
    [applyProgressionRewards, weeklyMissions],
  );

  const handleClaimLoginReward = useCallback(() => {
    soundFx.unlock();
    const res = claimLoginReward(loginCalendar);
    if (!res.success || !res.rewardDay) return;
    setLoginCalendar(res.state);
    applyProgressionRewards(res.rewardDay.rewards);
    soundFx.playChestOpen();
  }, [applyProgressionRewards, loginCalendar]);

  const handleClaimAchievement = useCallback(
    (achievementId: string) => {
      soundFx.unlock();
      const res = claimAchievement(
        achievementId,
        claimedAchievements,
        achievementContext,
      );
      if (!res.success || !res.definition) return;
      setClaimedAchievements(res.claimedIds);
      applyProgressionRewards(res.definition.rewards);
      soundFx.playWaveClear();
    },
    [achievementContext, applyProgressionRewards, claimedAchievements],
  );

  const handleClaimMilestone = useCallback(
    (level: number) => {
      soundFx.unlock();
      const res = claimTankMilestone(level, claimedMilestones, tankLevel);
      if (!res.success || !res.milestone) return;
      setClaimedMilestones(res.claimedLevels);
      applyProgressionRewards(res.milestone.rewards);
      soundFx.playChestOpen();
    },
    [applyProgressionRewards, claimedMilestones, tankLevel],
  );

  const handleClaimOfflineEarnings = useCallback(() => {
    soundFx.unlock();
    if (!pendingOfflineEarnings) return;
    const earned = pendingOfflineEarnings.scrapEarned;
    setPendingOfflineEarnings(null);
    setWallet((prev) => addCurrency(prev, 'scrap', earned));
    soundFx.playWaveClear();
  }, [pendingOfflineEarnings]);

  // Handlers: Dungeons
  const handleEnterDungeon = useCallback(
    (dungeonId: DungeonId, dungeonStage: number) => {
      soundFx.unlock();
      const check = canEnterDungeonStage(
        dungeonId,
        dungeonStage,
        dungeonProgress,
        dungeonEntries,
      );
      if (check.refreshedEntries !== dungeonEntries) {
        setDungeonEntries(check.refreshedEntries);
      }
      if (!check.allowed) {
        setDungeonEntryError(check.reason ?? 'Cannot enter dungeon stage.');
        return;
      }

      // Initialize dungeon combat FIRST; do NOT consume daily entry if loading fails
      let started = false;
      try {
        started = engine.startDungeon(dungeonId, dungeonStage);
      } catch {
        started = false;
      }
      if (!started) {
        setDungeonEntryError('Failed to load dungeon encounter. No daily entry consumed.');
        return;
      }

      const entryRes = consumeDailyDungeonEntry(check.refreshedEntries);
      if (!entryRes.success) {
        engine.returnToCampaign();
        setDungeonEntryError('Daily dungeon entries depleted (0/5).');
        return;
      }

      setDungeonEntryError(null);
      setDungeonEntries(entryRes.entries);
      activeDungeonRunRef.current = {
        runId: `${dungeonId}_${dungeonStage}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        dungeonId,
        stage: dungeonStage,
        rewarded: false,
      };
      setDungeonResult(null);
      setIsPaused(false);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setActiveTab('battle');
      }
    },
    [dungeonEntries, dungeonProgress, engine],
  );

  const handleRetreatDungeon = useCallback(() => {
    activeDungeonRunRef.current = null;
    setIsPaused(false);
    setDungeonResult(null);
    engine.returnToCampaign();
  }, [engine]);

  const handleReplayDungeon = useCallback(() => {
    if (!dungeonResult) return;
    const { dungeonId, stage: dStage } = dungeonResult;
    setDungeonResult(null);
    handleEnterDungeon(dungeonId, dStage);
  }, [dungeonResult, handleEnterDungeon]);

  const handleNextStageDungeon = useCallback(() => {
    if (!dungeonResult || !dungeonResult.victory) return;
    const nextStage = Math.min(MAX_DUNGEON_STAGE, dungeonResult.stage + 1);
    const id = dungeonResult.dungeonId;
    setDungeonResult(null);
    handleEnterDungeon(id, nextStage);
  }, [dungeonResult, handleEnterDungeon]);

  const handleReturnFromDungeonSummary = useCallback(() => {
    activeDungeonRunRef.current = null;
    setDungeonResult(null);
    setIsPaused(false);
    engine.returnToCampaign();
  }, [engine]);

  // Handlers: Controls & Reset
  const handleTogglePause = useCallback(() => {
    soundFx.unlock();
    setIsPaused((prev) => !prev);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundFx.setMuted(next);
      if (!next) soundFx.unlock();
      return next;
    });
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    soundFx.unlock();
    if (isDocumentFullscreen()) {
      manualExitFullscreenRef.current = true;
      setIsExpandedFullscreen(false);
      await exitFullscreen();
      setIsNativeFullscreen(isDocumentFullscreen());
      return;
    }

    if (isExpandedFullscreen) {
      manualExitFullscreenRef.current = true;
      setIsExpandedFullscreen(false);
      return;
    }

    manualExitFullscreenRef.current = false;
    const entered = await enterFullscreen();
    if (entered) {
      setIsNativeFullscreen(true);
      setIsExpandedFullscreen(false);
    } else {
      // Fallback for iframes / mobile Safari where native Fullscreen API is blocked
      setActiveTab('battle');
      setIsExpandedFullscreen(true);
    }
  }, [isExpandedFullscreen]);

  const handleConfirmReset = useCallback(() => {
    const fresh = clearSaveData();
    const freshStats = computeTankStats(
      fresh.upgradeLevels,
      fresh.equippedGear,
      fresh.tankLevel,
    );
    setWallet(fresh.wallet);
    setChests(fresh.chests);
    setUpgradeLevels(fresh.upgradeLevels);
    setTankLevel(fresh.tankLevel);
    setTankXp(fresh.tankXp);
    setEquippedGear(fresh.equippedGear);
    setEquipmentInventory(fresh.equipmentInventory);
    setSkills(fresh.skills);
    setEquippedSkillIds(fresh.equippedSkillIds);
    setAutoSkillsEnabled(fresh.autoSkillsEnabled);
    setAutoForge(fresh.autoForge);
    setDungeonProgress(fresh.dungeonProgress);
    setDungeonEntries(fresh.dungeonEntries);
    setDailyMissions(generateDailyMissions(getLocalDateKey()));
    setWeeklyMissions(generateWeeklyMissions(getWeekStartDateKey()));
    setLoginCalendar(createDefaultLoginCalendar());
    setClaimedAchievements([]);
    setClaimedMilestones([]);
    setLifetimeStats(createDefaultLifetimeStats());
    setApexSkinEnabled(true);
    setPendingOfflineEarnings(null);
    setClaimedEquipmentDrop(null);
    setDungeonEntryError(null);
    activeDungeonRunRef.current = null;
    setStage(fresh.stage);
    setHighestStage(fresh.highestStage);
    setTotalKills(fresh.totalKills);
    setLastForgedItem(null);
    setInlineForgeNotice(null);
    setInlineStorageWarning(null);
    setInspectedSlot(null);
    setDungeonResult(null);
    setChestReward(null);
    setIsPaused(false);
    engine.resetProgress(freshStats, fresh.equippedSkillIds, fresh.skills);
    setShowResetModal(false);
  }, [engine]);

  return (
    <div className="h-dvh w-screen flex flex-col bg-[#090a0d] text-zinc-100 overflow-hidden">
      <TopHud
        scrap={scrapBalance}
        forgeCores={forgeCoresBalance}
        tankLevel={tankLevel}
        tankXp={tankXp}
        isPaused={isPaused}
        isMuted={isMuted}
        isFullscreen={isFullscreen}
        canFullscreen={canFullscreen}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
        onToggleFullscreen={handleToggleFullscreen}
        onRequestReset={() => setShowResetModal(true)}
      />

      {/* Fullscreen Responsive Workspace */}
      <main
        className={`flex-1 min-h-0 w-full flex flex-col ${
          isExpandedFullscreen
            ? 'lg:grid lg:grid-cols-1 lg:gap-1 lg:p-1.5'
            : 'lg:grid lg:grid-cols-[1fr_410px] xl:grid-cols-[1fr_440px] lg:gap-2 lg:p-2'
        }`}
      >
        {/* Main Battlefield Column */}
        <div
          className={`flex-col gap-1.5 min-h-0 ${
            activeTab === 'battle' || isExpandedFullscreen
              ? 'flex flex-1 p-1.5 lg:p-0'
              : activeTab === 'upgrades'
                ? 'flex shrink-0 p-1.5 pb-0 lg:flex-1 lg:p-0'
                : 'hidden lg:flex lg:flex-1 lg:p-0'
          }`}
        >
          <div className="flex-1 min-h-0 flex flex-col">
            <BattleCanvas
              engine={engine}
              isPaused={isPaused}
              compactOnMobile={activeTab === 'upgrades' && !isExpandedFullscreen}
            />
          </div>

          {/* Compact Tank Status + (!) Stats Popup */}
          <div
            className={
              activeTab === 'battle' || isExpandedFullscreen
                ? 'block shrink-0'
                : 'hidden lg:block shrink-0'
            }
          >
            <TankStatusBar
              hud={hud}
              stats={tankStats}
              tankLevel={tankLevel}
              tankXp={tankXp}
              equippedSkillIds={equippedSkillIds}
              skills={skills}
              autoSkillsEnabled={autoSkillsEnabled}
              onToggleAutoSkills={handleToggleAutoSkills}
              onOpenSkillsTab={() => setActiveTab('skills')}
              onRetreatDungeon={handleRetreatDungeon}
            />
          </div>

          {/* 6 Equipment Slots + Compact Inline Forging Strip */}
          <div
            className={
              activeTab === 'battle' && !isExpandedFullscreen
                ? 'block shrink-0'
                : isExpandedFullscreen
                  ? 'hidden'
                  : 'hidden lg:block shrink-0'
            }
          >
            <BattleForgeStrip
              wallet={wallet}
              equippedGear={equippedGear}
              selectedSlot={selectedForgeSlot}
              selectedTier={selectedForgeTier}
              lastNotice={inlineForgeNotice}
              storageWarning={inlineStorageWarning}
              inInventoryIds={inInventoryIds}
              onSelectSlot={(slot) => {
                soundFx.unlock();
                setSelectedForgeSlot(slot);
              }}
              onInspectSlot={(slot) => {
                soundFx.unlock();
                setInspectedSlot(slot);
              }}
              onSelectTier={setSelectedForgeTier}
              onForgeSlot={handleInlineForge}
              onEquipItem={handleEquipItem}
              onOpenAutoForge={() => {
                soundFx.unlock();
                setForgeOpen(true);
              }}
            />
          </div>
        </div>

        {/* Right Command Panel (Desktop Sidebar / Mobile Tab View) */}
        <aside
          aria-label="Command Console"
          className={`flex-col min-h-0 lg:bg-[#12151b] lg:border lg:border-zinc-800 lg:rounded-xl lg:shadow-lg lg:overflow-hidden ${
            isExpandedFullscreen
              ? 'hidden'
              : activeTab === 'battle'
                ? 'hidden lg:flex'
                : 'flex flex-1 min-h-0'
          }`}
        >
          {/* Desktop Navigation Bar */}
          <div className="hidden lg:grid grid-cols-5 gap-1 p-2 bg-[#161a22] border-b border-zinc-800 shrink-0">
            <DesktopTabButton
              active={activeTab === 'battle'}
              onClick={() => setActiveTab('battle')}
              icon={Crosshair}
              label="Battle"
            />
            <DesktopTabButton
              active={activeTab === 'upgrades'}
              onClick={() => setActiveTab('upgrades')}
              icon={ShieldAlert}
              label="Upgrades"
              badge={affordableUpgradesCount}
            />
            <DesktopTabButton
              active={activeTab === 'skills'}
              onClick={() => setActiveTab('skills')}
              icon={Zap}
              label="Skills"
              badge={unopenedChestsCount}
            />
            <DesktopTabButton
              active={activeTab === 'dungeons'}
              onClick={() => setActiveTab('dungeons')}
              icon={Skull}
              label="Dungeons"
              badge={dungeonReadyCount}
            />
            <DesktopTabButton
              active={activeTab === 'missions'}
              onClick={() => setActiveTab('missions')}
              icon={Trophy}
              label="Missions"
              badge={claimableProgressionCount}
            />
          </div>

          {/* Scrollable Tab Content */}
          <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll p-3 lg:p-4">
            {activeTab === 'battle' && (
              <BattleIntelPanel
                hud={hud}
                onJumpToUpgrades={() => setActiveTab('upgrades')}
              />
            )}
            {activeTab === 'upgrades' && (
              <UpgradePanel
                scrap={scrapBalance}
                levels={upgradeLevels}
                onUpgrade={handleUpgrade}
              />
            )}
            {activeTab === 'skills' && (
              <SkillsPanel
                skills={skills}
                equippedSkillIds={equippedSkillIds}
                skillCooldowns={hud.skillCooldowns}
                chests={chests}
                skillTech={skillTechBalance}
                autoSkillsEnabled={autoSkillsEnabled}
                onToggleAutoSkills={handleToggleAutoSkills}
                onAssignSkillSlot={handleAssignSkillSlot}
                onUnequipSlot={handleUnequipSkillSlot}
                onUnlockSkill={handleUnlockSkill}
                onUpgradeSkill={handleUpgradeSkill}
                onOpenChest={handleOpenChest}
                onCraftChest={handleCraftChest}
              />
            )}
            {activeTab === 'dungeons' && (
              <DungeonsPanel
                tankPower={tankPower}
                dungeonProgress={dungeonProgress}
                dungeonEntries={refreshedDungeonEntries}
                activeDungeonId={hud.activeDungeonId}
                entryErrorMessage={dungeonEntryError}
                onEnterDungeon={handleEnterDungeon}
              />
            )}
            {activeTab === 'missions' && (
              <MissionsPanel
                dailyMissions={dailyMissions}
                weeklyMissions={weeklyMissions}
                loginCalendar={loginCalendar}
                claimedAchievements={claimedAchievements}
                claimedMilestones={claimedMilestones}
                achievementContext={achievementContext}
                tankLevel={tankLevel}
                apexSkinEnabled={apexSkinEnabled}
                claimedEquipmentDrop={claimedEquipmentDrop}
                onClaimDailyMission={handleClaimDailyMission}
                onClaimWeeklyMission={handleClaimWeeklyMission}
                onClaimLoginReward={handleClaimLoginReward}
                onClaimAchievement={handleClaimAchievement}
                onClaimMilestone={handleClaimMilestone}
                onToggleApexSkin={() => setApexSkinEnabled((prev) => !prev)}
                onEquipDroppedItem={handleEquipItem}
                onDismissDroppedItem={() => setClaimedEquipmentDrop(null)}
              />
            )}
          </div>
        </aside>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isExpandedFullscreen && (
        <BottomNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          affordableUpgradesCount={affordableUpgradesCount}
          unopenedChestsCount={unopenedChestsCount}
          dungeonReadyCount={dungeonReadyCount}
          claimableProgressionCount={claimableProgressionCount}
        />
      )}

      {/* Dedicated Forge & Equipment Modal */}
      <ForgeModal
        open={forgeOpen}
        wallet={wallet}
        tankLevel={tankLevel}
        equippedGear={equippedGear}
        inventory={equipmentInventory}
        lastForgedItem={lastForgedItem}
        autoForgeSettings={autoForge}
        autoForgeSummary={autoForgeSummary}
        onClose={() => {
          setAutoForge((prev) => ({ ...prev, enabled: false }));
          setForgeOpen(false);
        }}
        onManualForge={handleManualForge}
        onEquipItem={handleEquipItem}
        onUpgradeItem={handleUpgradeItem}
        onSalvageItem={handleSalvageItem}
        onUpdateAutoForge={handleUpdateAutoForge}
        onToggleAutoForgeRun={handleToggleAutoForgeRun}
      />

      {/* Equipment Slot Inspector / Manager Modal */}
      <EquipmentSlotModal
        slot={inspectedSlot}
        equippedItem={inspectedSlot ? equippedGear[inspectedSlot] : null}
        inventory={equipmentInventory}
        wallet={wallet}
        onClose={() => setInspectedSlot(null)}
        onEquipItem={handleEquipItem}
        onUpgradeItem={handleUpgradeItem}
        onSalvageItem={handleSalvageItem}
      />

      {/* Skill Chest Reward Reveal Modal */}
      <SkillChestModal
        reward={chestReward}
        onClose={() => setChestReward(null)}
      />

      {/* Dungeon Completion Summary Modal */}
      <DungeonSummaryModal
        result={dungeonResult}
        entriesRemaining={refreshedDungeonEntries.remaining}
        onNextStage={handleNextStageDungeon}
        onReplay={handleReplayDungeon}
        onReturnCampaign={handleReturnFromDungeonSummary}
      />

      {/* Offline Earnings Popup Modal */}
      <OfflineEarningsModal
        summary={pendingOfflineEarnings}
        onClaim={handleClaimOfflineEarnings}
      />

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="animate-modal-in w-full max-w-sm bg-[#14171d] border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="space-y-1.5">
              <h2
                id="reset-dialog-title"
                className="font-display text-lg font-bold text-zinc-100"
              >
                Reset Campaign Progress?
              </h2>
              <p className="text-sm text-zinc-400">
                This clears your Scrap, Forge Cores, Equipment, Skills, Dungeons, and Stage progress back to Stage 1.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold shadow-sm transition-all active:scale-[0.97]"
              >
                Reset Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface DesktopTabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}

const DesktopTabButton: React.FC<DesktopTabButtonProps> = ({
  active,
  onClick,
  icon: Icon,
  label,
  badge = 0,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all relative ${
      active
        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/50'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 border border-transparent'
    }`}
  >
    <Icon className="w-3.5 h-3.5 shrink-0" />
    <span>{label}</span>
    {badge > 0 && !active && (
      <span className="font-mono-num text-[10px] font-bold text-amber-400">
        {badge}
      </span>
    )}
  </button>
);
