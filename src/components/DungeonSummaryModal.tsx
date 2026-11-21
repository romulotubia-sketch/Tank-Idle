import React from 'react';
import {
  ArrowRight,
  Box,
  Cog,
  Cpu,
  Crown,
  Layers,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { EQUIPMENT_RARITY_META, MAX_DUNGEON_STAGE } from '../game/config';
import type { DungeonCompletionResult } from '../game/types';

interface DungeonSummaryModalProps {
  result: DungeonCompletionResult | null;
  entriesRemaining: number;
  onNextStage?: () => void;
  onReplay: () => void;
  onReturnCampaign: () => void;
}

export const DungeonSummaryModal: React.FC<DungeonSummaryModalProps> = ({
  result,
  entriesRemaining,
  onNextStage,
  onReplay,
  onReturnCampaign,
}) => {
  if (!result) return null;

  const { rewards } = result;
  const canUseEntry = entriesRemaining > 0;
  const hasNextStage =
    result.victory && result.stage < MAX_DUNGEON_STAGE && canUseEntry && Boolean(onNextStage);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dungeon Completion Summary"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        className={`animate-modal-in w-full max-w-md bg-[#14171d] border rounded-2xl p-5 space-y-4 shadow-2xl ${
          result.victory ? 'border-emerald-700/60' : 'border-red-800/60'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className={`text-xs font-bold tracking-wide ${
                result.victory ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {result.victory
                ? result.isFinalBoss
                  ? 'Final Boss Conquered'
                  : `Stage ${result.stage} Cleared`
                : `Stage ${result.stage} Failed · Hull Breached`}
            </div>
            <h2 className="font-display text-lg font-bold text-zinc-100 mt-0.5">
              {result.dungeonName} · Stage {result.stage}/{MAX_DUNGEON_STAGE}
            </h2>
            <div className="text-xs text-zinc-400 font-mono-num">
              Waves Cleared: {result.wavesCleared} / {result.totalWaves} · Boss: {result.bossName}
            </div>
          </div>

          <button
            type="button"
            onClick={onReturnCampaign}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 active:scale-95 transition-colors"
            aria-label="Close summary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result.newlyUnlockedStage !== null && (
          <div className="rounded-xl bg-amber-950/50 border border-amber-700/50 px-3 py-2 flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Stage {result.newlyUnlockedStage} Unlocked!</span>
          </div>
        )}

        {/* Rewards Breakdown */}
        {result.victory ? (
          <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Victory Rewards Claimed</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono-num font-semibold">
              {rewards.scrap > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Cog className="w-3.5 h-3.5" />
                  <span>+{rewards.scrap} Scrap</span>
                </div>
              )}
              {rewards.forgeCores > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-200">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  <span>+{rewards.forgeCores} Forge Cores</span>
                </div>
              )}
              {rewards.skillTech > 0 && (
                <div className="flex items-center gap-1.5 text-sky-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>+{rewards.skillTech} Skill Tech</span>
                </div>
              )}
              {rewards.alloyPlates > 0 && (
                <div className="flex items-center gap-1.5 text-purple-400">
                  <Layers className="w-3.5 h-3.5" />
                  <span>+{rewards.alloyPlates} Alloy Plates</span>
                </div>
              )}
              {(rewards.chests.standard ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-200">
                  <Box className="w-3.5 h-3.5 text-zinc-400" />
                  <span>+{rewards.chests.standard} Standard Skill Chest</span>
                </div>
              )}
              {(rewards.chests.advanced ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-sky-400">
                  <Box className="w-3.5 h-3.5" />
                  <span>+{rewards.chests.advanced} Advanced Skill Chest</span>
                </div>
              )}
              {(rewards.chests.elite ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Box className="w-3.5 h-3.5" />
                  <span>+{rewards.chests.elite} Elite Skill Chest</span>
                </div>
              )}
            </div>

            {rewards.equipment.length > 0 && (
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                {rewards.equipment.map((eq) => {
                  const meta = EQUIPMENT_RARITY_META[eq.rarity];
                  return (
                    <div key={eq.id} className={`text-xs font-semibold ${meta.textClass}`}>
                      + Equipment: {eq.name} ({meta.label} · PWR {eq.powerScore})
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0d0f14] border border-red-900/50 rounded-xl p-3.5 space-y-1.5">
            <div className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>0 Rewards Granted</span>
            </div>
            <p className="text-xs text-zinc-400">
              Clear all waves and defeat {result.bossName} to earn rewards and unlock the next stage.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] font-mono-num text-zinc-400 px-0.5">
          <span>Remaining Daily Entries</span>
          <span className="font-bold text-zinc-200">{entriesRemaining} / 5</span>
        </div>

        <div className="flex items-center gap-2">
          {hasNextStage && (
            <button
              type="button"
              onClick={onNextStage}
              className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 active:scale-[0.98] text-zinc-950 font-display font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>STAGE {result.stage + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {canUseEntry && (
            <button
              type="button"
              onClick={onReplay}
              className="flex-1 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-500 active:scale-[0.98] text-zinc-950 font-display font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{result.victory ? 'REPLAY' : 'RETRY'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReturnCampaign}
            className="flex-1 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-display font-bold text-xs tracking-wide active:scale-[0.98] transition-colors"
          >
            RETURN
          </button>
        </div>
      </div>
    </div>
  );
};
