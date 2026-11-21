import React, { useEffect, useState } from 'react';
import {
  Cog,
  Crosshair,
  Flame,
  Gauge,
  Heart,
  Shield,
  Zap,
} from 'lucide-react';
import { UPGRADE_DEFINITIONS, UPGRADE_ORDER } from '../game/config';
import { formatCompactNumber } from '../game/economy';
import {
  getStatValueAtLevel,
  getUpgradeCost,
  isUpgradeMaxed,
} from '../game/progression';
import type { UpgradeKey, UpgradeLevels } from '../game/types';

interface UpgradePanelProps {
  scrap: number;
  levels: UpgradeLevels;
  onUpgrade: (key: UpgradeKey) => void;
}

const UPGRADE_ICONS: Record<UpgradeKey, React.ComponentType<{ className?: string }>> = {
  maxHp: Heart,
  attackDamage: Crosshair,
  attackSpeed: Gauge,
  armor: Shield,
  critChance: Zap,
  critDamage: Flame,
};

const UPGRADE_ICON_STYLES: Record<UpgradeKey, string> = {
  maxHp: 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400',
  attackDamage: 'bg-amber-950/60 border-amber-700/50 text-amber-400',
  attackSpeed: 'bg-zinc-800 border-zinc-700 text-zinc-200',
  armor: 'bg-slate-800 border-slate-600/60 text-slate-300',
  critChance: 'bg-yellow-950/50 border-yellow-700/50 text-yellow-400',
  critDamage: 'bg-red-950/60 border-red-700/50 text-red-400',
};

export const UpgradePanel: React.FC<UpgradePanelProps> = ({
  scrap,
  levels,
  onUpgrade,
}) => {
  const [burstKey, setBurstKey] = useState<{ key: UpgradeKey; seq: number } | null>(null);

  useEffect(() => {
    if (!burstKey) return;
    const timer = window.setTimeout(() => setBurstKey(null), 280);
    return () => window.clearTimeout(timer);
  }, [burstKey]);

  const handleUpgradeClick = (key: UpgradeKey) => {
    setBurstKey((prev) => ({ key, seq: (prev?.seq ?? 0) + 1 }));
    onUpgrade(key);
  };

  return (
    <section aria-label="Tank Upgrades" className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">
          Tank Upgrades
        </h2>
        <span className="text-xs text-zinc-400">
          6 Core Systems · Instant Effect
        </span>
      </div>

      <div className="space-y-2">
        {UPGRADE_ORDER.map((key) => {
          const def = UPGRADE_DEFINITIONS[key];
          const level = levels[key];
          const maxed = isUpgradeMaxed(key, level);
          const cost = getUpgradeCost(key, level);
          const affordable = !maxed && scrap >= cost;
          const currentVal = getStatValueAtLevel(key, level);
          const Icon = UPGRADE_ICONS[key];
          const iconStyle = UPGRADE_ICON_STYLES[key];
          const isBursting = burstKey?.key === key;

          return (
            <div
              key={isBursting ? `${key}-${burstKey.seq}` : key}
              className={`bg-[#12151b] border rounded-xl p-3 flex items-center justify-between gap-3 transition-colors ${
                affordable ? 'border-zinc-700' : 'border-zinc-800'
              } ${isBursting ? 'animate-upgrade-burst' : ''}`}
            >
              {/* Left: Icon + Stat Name, Level & Benefit */}
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconStyle}`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-100 truncate">
                      {def.label}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono-num shrink-0">
                      Lv. {level}
                    </span>
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-mono-num font-semibold text-zinc-200">
                      {def.formatValue(currentVal)}
                    </span>
                    {!maxed ? (
                      <>
                        <span className="text-zinc-600">·</span>
                        <span className="font-mono-num font-semibold text-emerald-400">
                          {def.formatDelta(def.incrementPerLevel)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-zinc-600">·</span>
                        <span className="text-amber-400 font-semibold">Max Level</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Upgrade Action Button */}
              <button
                type="button"
                disabled={!affordable || maxed}
                onClick={() => handleUpgradeClick(key)}
                className={`min-h-[44px] min-w-[104px] px-3.5 py-2 rounded-lg font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap transition-colors ${
                  maxed
                    ? 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                    : affordable
                      ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 active:scale-[0.96] text-zinc-950 font-bold'
                      : 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                }`}
              >
                {maxed ? (
                  <span>Maxed</span>
                ) : (
                  <>
                    <Cog className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono-num">{formatCompactNumber(cost)}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
