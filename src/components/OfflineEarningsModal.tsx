import React from 'react';
import { Clock, Coins, Sparkles } from 'lucide-react';
import { formatCompactNumber } from '../game/economy';
import { formatDurationShort } from '../game/progressionSystems';
import type { OfflineEarningsSummary } from '../game/types';

interface OfflineEarningsModalProps {
  summary: OfflineEarningsSummary | null;
  onClaim: () => void;
}

export const OfflineEarningsModal: React.FC<OfflineEarningsModalProps> = ({
  summary,
  onClaim,
}) => {
  if (!summary) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-earnings-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="animate-modal-in w-full max-w-sm bg-[#14171d] border border-zinc-700 rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-700/50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2
              id="offline-earnings-title"
              className="font-display text-lg font-bold text-zinc-100"
            >
              Welcome Back, Commander
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Your automated vanguard salvaged Scrap while you were away.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-400 font-semibold">
              Time Away
            </div>
            <div className="font-mono-num text-base font-bold text-zinc-100 mt-1">
              {formatDurationShort(summary.cappedSeconds)}
            </div>
            {summary.wasCapped && (
              <div className="text-[10px] text-amber-400 mt-0.5">
                Max 8h cap reached
              </div>
            )}
          </div>

          <div className="bg-[#0d0f14] border border-amber-700/40 rounded-xl p-3">
            <div className="text-[11px] uppercase tracking-wide text-amber-400 font-semibold flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Scrap Earned</span>
            </div>
            <div className="font-mono-num text-base font-bold text-amber-400 mt-1">
              +{formatCompactNumber(summary.scrapEarned)}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Campaign idle rate
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClaim}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-500 text-zinc-950 font-display text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          <span>Claim {formatCompactNumber(summary.scrapEarned)} Scrap</span>
        </button>
      </div>
    </div>
  );
};
