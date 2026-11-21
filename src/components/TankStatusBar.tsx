import React, { useState } from 'react';
import { AlertCircle, LogOut, Power, X } from 'lucide-react';
import {
  MAX_EQUIPPED_SKILLS,
  SKILL_DEFINITIONS,
  getXpForNextLevel,
} from '../game/config';
import { formatCompactNumber } from '../game/economy';
import { computeEffectiveDps, computeTankPower } from '../game/progression';
import type { BattleHudSnapshot, SkillCollection, SkillId, TankStats } from '../game/types';
import { SkillIcon } from './SkillIcon';

interface TankStatusBarProps {
  hud: BattleHudSnapshot;
  stats: TankStats;
  tankLevel: number;
  tankXp: number;
  equippedSkillIds: (SkillId | null)[];
  skills: SkillCollection;
  autoSkillsEnabled: boolean;
  onToggleAutoSkills: () => void;
  onOpenSkillsTab?: () => void;
  onRetreatDungeon?: () => void;
}

export const TankStatusBar: React.FC<TankStatusBarProps> = ({
  hud,
  stats,
  tankLevel,
  tankXp,
  equippedSkillIds,
  skills,
  autoSkillsEnabled,
  onToggleAutoSkills,
  onOpenSkillsTab,
  onRetreatDungeon,
}) => {
  const [statsOpen, setStatsOpen] = useState(false);

  const hpPercent = Math.max(0, Math.min(100, (hud.playerHp / Math.max(1, hud.playerMaxHp)) * 100));
  const wavePercent = Math.max(
    0,
    Math.min(100, (hud.enemiesDefeatedInWave / Math.max(1, hud.enemiesTotalInWave)) * 100),
  );
  const bossPercent =
    hud.bossMaxHp > 0
      ? Math.max(0, Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100))
      : 0;
  const xpNeeded = getXpForNextLevel(tankLevel);
  const dps = computeEffectiveDps(stats);
  const tankPower = computeTankPower(stats);

  return (
    <>
      <section
        aria-label="Tank Status"
        className="bg-[#12151b] border border-zinc-800 rounded-xl px-2.5 py-1.5 space-y-1 shadow-sm"
      >
        <div className="flex items-center justify-between gap-1.5">
          {/* Left: Stage/Wave + Tank Level + (!) Stats Info Button */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display text-[11px] sm:text-xs font-bold text-zinc-100 whitespace-nowrap">
              {hud.mode === 'dungeon'
                ? `Dungeon S${hud.dungeonStage} · W${hud.wave}/${hud.wavesPerStage}`
                : `Stg ${hud.stage} · W${hud.wave}/${hud.wavesPerStage}`}
            </span>
            <span className="text-zinc-600 text-[10px]">·</span>
            <span className="font-display text-[11px] sm:text-xs font-bold text-amber-400 whitespace-nowrap">
              Lv.{tankLevel}
            </span>
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-600/80 flex items-center justify-center text-amber-400 hover:text-amber-300 active:scale-95 transition-all shrink-0"
              aria-label="View Tank Statistics"
              title="View Tank Statistics"
            >
              <AlertCircle className="w-3.5 h-3.5" />
            </button>
            <span className="hidden sm:inline text-[11px] text-zinc-400 font-mono-num truncate">
              · Pwr {formatCompactNumber(tankPower)}
            </span>
          </div>

          {/* Right: 3 Compact Equipped Skill Slots + Auto Toggle + HP */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 3 Equipped Skills Cooldown Indicator Strip */}
            <div className="flex items-center gap-1">
              {Array.from({ length: MAX_EQUIPPED_SKILLS }).map((_, idx) => {
                const sid = equippedSkillIds[idx];
                if (!sid) {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={onOpenSkillsTab}
                      aria-label={`Empty skill slot ${idx + 1}`}
                      title={`Equip skill in Slot ${idx + 1}`}
                      className="w-7 h-7 rounded-md border border-dashed border-zinc-700 bg-[#0d0f14] flex items-center justify-center text-[10px] text-zinc-500 hover:border-zinc-500 transition-colors"
                    >
                      +
                    </button>
                  );
                }

                const def = SKILL_DEFINITIONS[sid];
                const cdInfo = hud.skillCooldowns.find((c) => c.id === sid);
                const rem = cdInfo?.cooldownRemaining ?? 0;
                const total = cdInfo?.cooldownTotal ?? def.cooldown;
                const active = (cdInfo?.activeRemaining ?? 0) > 0;
                const cdRatio = total > 0 ? Math.max(0, Math.min(1, rem / total)) : 0;
                const lvl = skills[sid]?.level ?? 1;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={onOpenSkillsTab}
                    aria-label={`${def.name} Lv.${lvl} ${rem > 0.05 ? `${rem.toFixed(1)}s cooldown` : 'Ready'}`}
                    title={`${def.name} Lv.${lvl}`}
                    className={`relative w-7 h-7 rounded-md overflow-hidden border transition-all active:scale-95 ${
                      active
                        ? 'border-amber-400'
                        : rem <= 0.05 && autoSkillsEnabled
                          ? 'border-emerald-600/80'
                          : 'border-zinc-700'
                    }`}
                  >
                    <div className="w-full h-full flex items-center justify-center bg-[#0d0f14]">
                      <SkillIcon skillId={sid} size="xs" />
                    </div>
                    {rem > 0.05 && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-black/75 transition-[height] duration-100 pointer-events-none"
                        style={{ height: `${Math.round(cdRatio * 100)}%` }}
                      />
                    )}
                    {rem > 0.05 && (
                      <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pointer-events-none">
                        {Math.ceil(rem)}
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={onToggleAutoSkills}
                aria-pressed={autoSkillsEnabled}
                aria-label={`Auto-cast skills ${autoSkillsEnabled ? 'enabled' : 'disabled'}`}
                title={`Auto-Cast Skills: ${autoSkillsEnabled ? 'ON' : 'OFF'}`}
                className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all active:scale-95 ${
                  autoSkillsEnabled
                    ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-400'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {hud.mode === 'dungeon' && onRetreatDungeon && (
              <button
                type="button"
                onClick={onRetreatDungeon}
                className="h-7 px-2 rounded bg-red-800 hover:bg-red-700 border border-red-700 text-white text-[10px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Retreat</span>
              </button>
            )}

            <div
              className={`font-mono-num text-[11px] font-bold whitespace-nowrap ${
                hud.isRecovering ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {hud.isRecovering
                ? `${hud.recoveryTimer.toFixed(1)}s`
                : `${hud.playerHp}/${hud.playerMaxHp}`}
            </div>
          </div>
        </div>

        {/* Compact Dual Bars: HP & Wave Progress (plus Boss HP when active) */}
        <div className="grid grid-cols-2 gap-2 items-center">
          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-[width] duration-150 ${
                hpPercent > 35 ? 'bg-emerald-600' : 'bg-red-600'
              }`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-1.5 flex-1 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-amber-500 transition-[width] duration-150"
                style={{ width: `${wavePercent}%` }}
              />
            </div>
            <span className="font-mono-num text-[10px] font-semibold text-zinc-300 whitespace-nowrap shrink-0">
              {hud.enemiesDefeatedInWave}/{hud.enemiesTotalInWave}
            </span>
          </div>
        </div>

        {/* Compact Boss Bar (only during Boss wave) */}
        {hud.bossName && hud.bossMaxHp > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[10px] font-display font-bold text-red-400 truncate max-w-[130px]">
              {hud.bossName}
            </span>
            <div className="h-1.5 flex-1 bg-zinc-950 rounded-full overflow-hidden border border-red-900/60">
              <div
                className="h-full bg-red-600 transition-[width] duration-100"
                style={{ width: `${bossPercent}%` }}
              />
            </div>
            <span className="font-mono-num text-[10px] text-red-300 shrink-0">
              {hud.bossHp}/{hud.bossMaxHp}
            </span>
          </div>
        )}
      </section>

      {/* Compact Tank Statistics Popup (Tap outside or X to dismiss) */}
      {statsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tank Combat Statistics"
          onClick={() => setStatsOpen(false)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-in w-full max-w-sm bg-[#14171d] border border-zinc-700 rounded-2xl p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-100">
                  Tank Combat Statistics
                </h2>
                <div className="text-[11px] text-zinc-400 font-mono-num">
                  Tank Lv.{tankLevel} ({tankXp}/{xpNeeded} XP) · Power {formatCompactNumber(tankPower)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatsOpen(false)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white active:scale-95 transition-all"
                aria-label="Close statistics"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Combat Statistics */}
            <div className="grid grid-cols-2 gap-2">
              <PopupStatRow label="Max HP" value={`${stats.maxHp}`} tone="text-emerald-400" />
              <PopupStatRow label="Est. DPS" value={`${Math.round(dps)}`} tone="text-amber-400" highlight />
              <PopupStatRow label="Attack" value={`${stats.attackDamage}`} tone="text-orange-400" />
              <PopupStatRow label="Fire Rate" value={`${stats.attackSpeed.toFixed(2)}/s`} tone="text-sky-400" />
              <PopupStatRow label="Armor" value={`${Math.round(stats.armor)}`} tone="text-zinc-200" />
              <PopupStatRow label="Crit %" value={`${(stats.critChance * 100).toFixed(1)}%`} tone="text-yellow-400" />
              <PopupStatRow label="Crit Mult" value={`${Math.round(stats.critDamage * 100)}%`} tone="text-purple-300" />
              <PopupStatRow label="Tank Power" value={formatCompactNumber(tankPower)} tone="text-zinc-100" />
            </div>

            {/* Active Equipment Passive Bonuses */}
            {(stats.armorPenetrationRatio > 0 ||
              stats.splashDamageRatio > 0 ||
              stats.lifestealOnKillRatio > 0 ||
              stats.skillHasteRatio > 0 ||
              stats.scrapBonusRatio > 0) && (
              <div className="pt-2 border-t border-zinc-800 space-y-1">
                <div className="text-[11px] font-semibold text-amber-400">
                  Active Equipment Passives
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono-num text-zinc-300">
                  {stats.armorPenetrationRatio > 0 && (
                    <div>Armor Pen: {Math.round(stats.armorPenetrationRatio * 100)}%</div>
                  )}
                  {stats.splashDamageRatio > 0 && (
                    <div>Splash: {Math.round(stats.splashDamageRatio * 100)}%</div>
                  )}
                  {stats.lifestealOnKillRatio > 0 && (
                    <div>Kill Repair: {(stats.lifestealOnKillRatio * 100).toFixed(1)}%</div>
                  )}
                  {stats.skillHasteRatio > 0 && (
                    <div>Skill Haste: {Math.round(stats.skillHasteRatio * 100)}%</div>
                  )}
                  {stats.scrapBonusRatio > 0 && (
                    <div>Scrap Bonus: +{Math.round(stats.scrapBonusRatio * 100)}%</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const PopupStatRow: React.FC<{
  label: string;
  value: string;
  tone: string;
  highlight?: boolean;
}> = ({ label, value, tone, highlight = false }) => (
  <div
    className={`rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 border ${
      highlight
        ? 'bg-amber-950/35 border-amber-700/60'
        : 'bg-[#0e1015] border-zinc-800'
    }`}
  >
    <span className="text-xs text-zinc-400">{label}</span>
    <span className={`font-mono-num text-xs sm:text-sm font-bold ${tone}`}>{value}</span>
  </div>
);
