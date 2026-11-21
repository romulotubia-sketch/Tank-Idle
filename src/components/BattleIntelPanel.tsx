import React from 'react';
import {
  BOSS_STAGE_INTERVAL,
  ENEMY_ARCHETYPES,
  getBossDisplayName,
} from '../game/config';
import type { BattleHudSnapshot, EnemyArchetypeId } from '../game/types';

interface BattleIntelPanelProps {
  hud: BattleHudSnapshot;
  onJumpToUpgrades: () => void;
}

const ARCHETYPE_ORDER: EnemyArchetypeId[] = ['light', 'medium', 'heavy', 'assault', 'boss'];

export const BattleIntelPanel: React.FC<BattleIntelPanelProps> = ({
  hud,
  onJumpToUpgrades,
}) => {
  const nextBossStage =
    hud.stage % BOSS_STAGE_INTERVAL === 0
      ? hud.stage
      : hud.stage + (BOSS_STAGE_INTERVAL - (hud.stage % BOSS_STAGE_INTERVAL));

  return (
    <section aria-label="Combat Overview" className="space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">
          Field Operations
        </h2>
        <span className="text-xs text-zinc-400">
          Tap any enemy to prioritize fire
        </span>
      </div>

      {/* Campaign Progress Summary */}
      <div className="bg-[#12151b] border border-zinc-800 rounded-xl p-3.5 grid grid-cols-3 gap-2.5">
        <div>
          <div className="text-[11px] text-zinc-400">Best Stage</div>
          <div className="font-mono-num text-base font-bold text-zinc-100">
            {hud.highestStage}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-400">Hostiles Destroyed</div>
          <div className="font-mono-num text-base font-bold text-zinc-100">
            {hud.totalKills.toLocaleString('en-US')}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-400">Next Boss</div>
          <div className="font-mono-num text-base font-bold text-amber-400">
            Stage {nextBossStage}
          </div>
        </div>
      </div>

      {/* Hostile Archetypes Field Guide */}
      <div className="bg-[#12151b] border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-zinc-100">
            Enemy Unit Classifications
          </h3>
          <span className="text-[11px] text-amber-400/90 truncate">
            Target: {getBossDisplayName(nextBossStage)}
          </span>
        </div>

        <div className="divide-y divide-zinc-800">
          {ARCHETYPE_ORDER.map((id) => {
            const cfg = ENEMY_ARCHETYPES[id];
            return (
              <div key={id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-sm shrink-0 border border-zinc-600"
                    style={{
                      backgroundColor: cfg.hullAccent,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100 truncate">
                      {cfg.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {cfg.roleLabel} · {cfg.behavior === 'rush' ? 'Aggressive rusher' : cfg.behavior === 'siege' ? 'Heavy armor siege' : cfg.behavior === 'flank' ? 'Fast flanker' : cfg.behavior === 'command' ? 'Boss dreadnought' : 'Balanced combatant'}
                    </div>
                  </div>
                </div>
                <span className="font-mono-num text-[11px] font-semibold text-amber-400 shrink-0">
                  +{cfg.baseScrapReward} base
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onJumpToUpgrades}
        className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-500 active:scale-[0.98] text-zinc-950 font-bold text-sm transition-colors"
      >
        Open Tank Upgrades
      </button>
    </section>
  );
};
