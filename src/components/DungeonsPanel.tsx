import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Check,
  ChevronRight,
  Cog,
  Cpu,
  Crosshair,
  Crown,
  Layers,
  Lock,
  Shield,
  Skull,
  Swords,
} from 'lucide-react';
import {
  DAILY_DUNGEON_ENTRIES,
  DUNGEON_CONFIGS,
  DUNGEON_ORDER,
  MAX_DUNGEON_STAGE,
  getDungeonStageRecommendedPower,
  getDungeonWaveCount,
} from '../game/config';
import {
  canEnterDungeonStage,
  getDungeonStagePreviewRewards,
  isDungeonStageUnlocked,
  refreshDailyDungeonEntries,
} from '../game/dungeons';
import { formatCompactNumber } from '../game/economy';
import type {
  DailyDungeonEntries,
  DungeonId,
  DungeonProgressMap,
} from '../game/types';
import { DungeonArtwork } from './DungeonArtwork';

interface DungeonsPanelProps {
  tankPower: number;
  dungeonProgress: DungeonProgressMap;
  dungeonEntries: DailyDungeonEntries;
  activeDungeonId: DungeonId | null;
  entryErrorMessage?: string | null;
  onEnterDungeon: (id: DungeonId, stage: number) => void;
}

export const DungeonsPanel: React.FC<DungeonsPanelProps> = ({
  tankPower,
  dungeonProgress,
  dungeonEntries,
  activeDungeonId,
  entryErrorMessage,
  onEnterDungeon,
}) => {
  const [selectedDungeonId, setSelectedDungeonId] = useState<DungeonId | null>(null);
  const [selectedStageByDungeon, setSelectedStageByDungeon] = useState<Record<DungeonId, number>>(
    () => ({
      salvage_yard: Math.min(
        MAX_DUNGEON_STAGE,
        (dungeonProgress.salvage_yard?.highestClearedStage ?? 0) + 1,
      ),
      arsenal_depot: Math.min(
        MAX_DUNGEON_STAGE,
        (dungeonProgress.arsenal_depot?.highestClearedStage ?? 0) + 1,
      ),
      armored_stronghold: Math.min(
        MAX_DUNGEON_STAGE,
        (dungeonProgress.armored_stronghold?.highestClearedStage ?? 0) + 1,
      ),
      experimental_grounds: Math.min(
        MAX_DUNGEON_STAGE,
        (dungeonProgress.experimental_grounds?.highestClearedStage ?? 0) + 1,
      ),
    }),
  );

  const refreshedEntries = useMemo(
    () => refreshDailyDungeonEntries(dungeonEntries),
    [dungeonEntries],
  );

  const handleOpenDungeon = (id: DungeonId) => {
    const highestCleared = dungeonProgress[id]?.highestClearedStage ?? 0;
    const defaultNextStage = Math.min(MAX_DUNGEON_STAGE, Math.max(1, highestCleared + 1));
    setSelectedStageByDungeon((prev) => ({
      ...prev,
      [id]: isDungeonStageUnlocked(id, prev[id] ?? 1, dungeonProgress)
        ? prev[id]
        : defaultNextStage,
    }));
    setSelectedDungeonId(id);
  };

  if (selectedDungeonId) {
    const cfg = DUNGEON_CONFIGS[selectedDungeonId];
    const progress = dungeonProgress[selectedDungeonId] ?? {
      highestClearedStage: 0,
      clears: 0,
      bossClears: 0,
    };
    const stage = Math.max(
      1,
      Math.min(MAX_DUNGEON_STAGE, selectedStageByDungeon[selectedDungeonId] ?? 1),
    );
    const stageCheck = canEnterDungeonStage(
      selectedDungeonId,
      stage,
      dungeonProgress,
      refreshedEntries,
    );
    const recPower = getDungeonStageRecommendedPower(selectedDungeonId, stage);
    const powerReady = tankPower >= recPower;
    const waveCount = getDungeonWaveCount(stage);
    const isFinalStage = stage === MAX_DUNGEON_STAGE;
    const bossDisplayName = isFinalStage ? cfg.finalBossName : cfg.bossName;
    const preview = getDungeonStagePreviewRewards(selectedDungeonId, stage);
    const isCurrentlyRunning = activeDungeonId === selectedDungeonId;

    return (
      <section aria-label={`${cfg.name} Stage Selection`} className="space-y-3">
        {/* Top Back + Entries Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedDungeonId(null)}
            className="min-h-[40px] px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Dungeons</span>
          </button>

          <DailyEntryMeter entries={refreshedEntries} />
        </div>

        {/* Dungeon Banner Header */}
        <div
          style={{ borderColor: `${cfg.theme.borderHazard}66` }}
          className="relative rounded-xl overflow-hidden border bg-[#12151b]"
        >
          <DungeonArtwork dungeonId={selectedDungeonId} className="h-28 w-full" />
          <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-zinc-300">
                {cfg.subtitle} · {progress.highestClearedStage}/{MAX_DUNGEON_STAGE} Cleared
              </div>
              <h2 className="font-display text-lg font-bold text-zinc-100 leading-tight truncate">
                {cfg.name}
              </h2>
            </div>
            <div className="text-right shrink-0 font-mono-num">
              <div className="text-[10px] text-zinc-400">Your Power</div>
              <div className="text-sm font-bold text-amber-400">
                {formatCompactNumber(tankPower)}
              </div>
            </div>
          </div>
        </div>

        {entryErrorMessage && (
          <div
            role="alert"
            className="rounded-lg bg-red-950/70 border border-red-800/60 px-3 py-2 text-xs text-red-200"
          >
            {entryErrorMessage}
          </div>
        )}

        {/* 10-Stage Selector Grid */}
        <div className="bg-[#12151b] border border-zinc-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-display font-bold text-zinc-100">Select Stage (1–10)</span>
            <span className="text-[11px] text-zinc-400">
              Cleared stages can be replayed
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: MAX_DUNGEON_STAGE }).map((_, idx) => {
              const s = idx + 1;
              const unlocked = isDungeonStageUnlocked(selectedDungeonId, s, dungeonProgress);
              const cleared = s <= progress.highestClearedStage;
              const isSelected = stage === s;
              const isStage10 = s === MAX_DUNGEON_STAGE;

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setSelectedStageByDungeon((prev) => ({
                      ...prev,
                      [selectedDungeonId]: s,
                    }))
                  }
                  aria-label={`Stage ${s}${cleared ? ' cleared' : unlocked ? ' unlocked' : ' locked'}`}
                  className={`min-h-[44px] rounded-lg border font-mono-num text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-95 ${
                    isSelected
                      ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                      : cleared
                        ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300 hover:border-emerald-600'
                        : unlocked
                          ? 'bg-zinc-800 border-zinc-600 text-zinc-100 hover:border-zinc-500'
                          : 'bg-[#0d0f14] border-zinc-800 text-zinc-600'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {isStage10 ? (
                      <Crown className="w-3 h-3 text-amber-400" />
                    ) : cleared ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : !unlocked ? (
                      <Lock className="w-3 h-3 text-zinc-600" />
                    ) : null}
                    <span>{s}</span>
                  </span>
                  <span className="text-[9px] font-normal opacity-80">
                    {isStage10 ? 'Boss' : cleared ? 'Done' : unlocked ? 'Open' : 'Lock'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Stage Mission Briefing */}
        <div className="bg-[#12151b] border border-zinc-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <div>
              <div className="text-[11px] font-semibold text-amber-400">
                Stage {stage} · {waveCount} Waves {isFinalStage ? '· Final Boss Tier' : ''}
              </div>
              <h3 className="font-display text-sm font-bold text-zinc-100">
                Boss: {bossDisplayName}
              </h3>
            </div>
            <div className="text-right font-mono-num">
              <div className="text-[10px] text-zinc-400">Rec. Power</div>
              <div
                className={`text-xs font-bold ${
                  powerReady ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatCompactNumber(recPower)} · {powerReady ? 'Ready' : 'High Risk'}
              </div>
            </div>
          </div>

          {/* Enemy Lineup */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-zinc-400" />
              <span>Enemy Lineup</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {cfg.enemies.map((enemy) => (
                <div
                  key={enemy.name}
                  className="rounded-lg bg-[#0d0f14] border border-zinc-800 px-2.5 py-1.5 flex items-center gap-2 min-w-0"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0 border border-zinc-600"
                    style={{ backgroundColor: enemy.hullAccent }}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-zinc-100 truncate">
                      {enemy.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {enemy.roleLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Potential Victory Rewards */}
          <div className="rounded-lg bg-[#0d0f14] border border-zinc-800 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-emerald-400">Victory Rewards</span>
              <span className="text-zinc-500">Granted on clear only</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono-num">
              {preview.scrapEstimate > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Cog className="w-3.5 h-3.5 shrink-0" />
                  <span>~{formatCompactNumber(preview.scrapEstimate)} Scrap</span>
                </div>
              )}
              {preview.forgeCoresEstimate > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-200">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>+{preview.forgeCoresEstimate} Forge Cores</span>
                </div>
              )}
              {preview.alloyPlatesEstimate > 0 && (
                <div className="flex items-center gap-1.5 text-purple-400">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>+{preview.alloyPlatesEstimate} Alloy Plates</span>
                </div>
              )}
              {preview.skillTechEstimate > 0 && (
                <div className="flex items-center gap-1.5 text-sky-400">
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  <span>+{preview.skillTechEstimate} Skill Tech</span>
                </div>
              )}
            </div>
            {preview.equipmentSummary !== 'None' && (
              <div className="text-[11px] text-purple-300 flex items-center gap-1.5 pt-0.5">
                <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>{preview.equipmentSummary}</span>
              </div>
            )}
            {preview.skillChestSummary !== 'None' && (
              <div className="text-[11px] text-zinc-300 flex items-center gap-1.5 pt-0.5">
                <Box className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>{preview.skillChestSummary}</span>
              </div>
            )}
          </div>

          {!stageCheck.allowed && stageCheck.reason && (
            <div className="text-[11px] text-amber-400 font-medium">
              {stageCheck.reason}
            </div>
          )}

          {/* Start Dungeon Action */}
          <button
            type="button"
            disabled={!stageCheck.allowed || activeDungeonId !== null}
            onClick={() => onEnterDungeon(selectedDungeonId, stage)}
            className={`w-full min-h-[46px] rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-colors ${
              isCurrentlyRunning
                ? 'bg-zinc-800 text-amber-400 border border-amber-600/50 cursor-not-allowed'
                : activeDungeonId !== null
                  ? 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                  : stageCheck.allowed
                    ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 active:scale-[0.98] text-zinc-950'
                    : 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>
              {isCurrentlyRunning
                ? 'Dungeon Active'
                : `Start Stage ${stage} (1 Entry)`}
            </span>
          </button>
        </div>
      </section>
    );
  }

  // 4-Dungeon Overview Grid / List
  return (
    <section aria-label="Combat Dungeons" className="space-y-3">
      <div className="flex items-start justify-between gap-2 px-0.5">
        <div>
          <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">
            Combat Dungeons
          </h2>
          <p className="text-xs text-zinc-400">
            4 sectors · 10 stages each · Select a dungeon to deploy.
          </p>
        </div>

        <DailyEntryMeter entries={refreshedEntries} />
      </div>

      {entryErrorMessage && (
        <div
          role="alert"
          className="rounded-lg bg-red-950/70 border border-red-800/60 px-3 py-2 text-xs text-red-200"
        >
          {entryErrorMessage}
        </div>
      )}

      <div className="space-y-3">
        {DUNGEON_ORDER.map((id) => {
          const cfg = DUNGEON_CONFIGS[id];
          const progress = dungeonProgress[id] ?? {
            highestClearedStage: 0,
            clears: 0,
            bossClears: 0,
          };
          const nextStage = Math.min(MAX_DUNGEON_STAGE, progress.highestClearedStage + 1);
          const stage1Power = getDungeonStageRecommendedPower(id, 1);
          const nextStagePower = getDungeonStageRecommendedPower(id, nextStage);
          const powerReady = tankPower >= nextStagePower;
          const isCurrentlyRunning = activeDungeonId === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleOpenDungeon(id)}
              style={{ borderColor: `${cfg.theme.borderHazard}55` }}
              className="w-full text-left bg-[#12151b] hover:bg-[#161a22] active:scale-[0.99] border rounded-xl overflow-hidden transition-colors block"
            >
              {/* Artwork Banner */}
              <div className="relative h-24 w-full">
                <DungeonArtwork dungeonId={id} className="h-full w-full" />
                <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: '#0d0f14',
                        borderColor: `${cfg.theme.borderHazard}88`,
                      }}
                    >
                      <Skull
                        className="w-4 h-4"
                        style={{ color: cfg.theme.borderHazard }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm sm:text-base font-bold text-zinc-100 leading-tight truncate">
                        {cfg.name}
                      </h3>
                      <div className="text-[11px] text-zinc-300 truncate">
                        {cfg.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono-num">
                    <div className="text-[10px] text-zinc-400">Progress</div>
                    <div className="text-xs font-bold text-zinc-100">
                      {progress.highestClearedStage}/{MAX_DUNGEON_STAGE} Stages
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs bg-[#0d0f14] border border-zinc-800 rounded-lg p-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-500">Main Reward</div>
                    <div className="font-semibold text-amber-400 truncate">
                      {cfg.mainRewardType}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-500">Stage {nextStage} Pwr</div>
                    <div
                      className={`font-mono-num font-bold truncate ${
                        powerReady ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatCompactNumber(nextStagePower)}
                    </div>
                  </div>
                  <div className="text-right min-w-0">
                    <div className="text-[10px] text-zinc-500">Daily Entries</div>
                    <div className="font-mono-num font-bold text-zinc-200">
                      {refreshedEntries.remaining}/{refreshedEntries.max}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-zinc-400 truncate">
                    Boss: {cfg.bossName} · Start Pwr {formatCompactNumber(stage1Power)}
                  </span>
                  <span className="font-display font-bold text-amber-400 flex items-center gap-0.5 shrink-0">
                    <span>{isCurrentlyRunning ? 'In Combat' : 'Select Stage'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const DailyEntryMeter: React.FC<{ entries: DailyDungeonEntries }> = ({ entries }) => (
  <div className="text-right shrink-0">
    <div className="flex items-center justify-end gap-1">
      {Array.from({ length: DAILY_DUNGEON_ENTRIES }).map((_, idx) => {
        const filled = idx < entries.remaining;
        return (
          <span
            key={idx}
            className={`w-2.5 h-3 rounded-sm border ${
              filled
                ? 'bg-amber-500 border-amber-400'
                : 'bg-[#0d0f14] border-zinc-700'
            }`}
          />
        );
      })}
      <span className="font-mono-num text-xs font-bold text-zinc-200 ml-1">
        {entries.remaining}/{entries.max}
      </span>
    </div>
    <div className="text-[10px] text-zinc-500">Daily Entries · Resets Daily</div>
  </div>
);
