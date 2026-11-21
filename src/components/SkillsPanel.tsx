import React, { useState } from 'react';
import {
  ArrowUpCircle,
  Box,
  CheckCircle2,
  CopyPlus,
  Cpu,
  Info,
  Lock,
  PlusCircle,
  Power,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CHEST_CONFIGS,
  MAX_EQUIPPED_SKILLS,
  MAX_SKILL_LEVEL,
  SKILL_DEFINITIONS,
  SKILL_ORDER,
  SKILL_RARITY_META,
} from '../game/config';
import { formatCompactNumber } from '../game/economy';
import {
  CHEST_CRAFT_TECH_COST,
  canUpgradeSkillWithDuplicates,
  getRequiredDuplicatesForNextLevel,
  getSkillComputedStats,
  getSkillNextLevelPreview,
} from '../game/skills';
import type {
  ChestInventory,
  ChestTierId,
  SkillCollection,
  SkillCooldownSnapshot,
  SkillId,
} from '../game/types';
import { SkillIcon } from './SkillIcon';

interface SkillsPanelProps {
  skills: SkillCollection;
  equippedSkillIds: (SkillId | null)[];
  skillCooldowns: SkillCooldownSnapshot[];
  chests: ChestInventory;
  skillTech: number;
  autoSkillsEnabled: boolean;
  onToggleAutoSkills: () => void;
  onAssignSkillSlot: (skillId: SkillId, slotIndex?: number) => void;
  onUnequipSlot: (slotIndex: number) => void;
  onUnlockSkill: (skillId: SkillId) => void;
  onUpgradeSkill: (skillId: SkillId) => void;
  onOpenChest: (tier: ChestTierId) => void;
  onCraftChest: () => void;
}

const CHEST_ACTIVE_STYLES: Record<ChestTierId, string> = {
  standard:
    'bg-zinc-800 hover:bg-zinc-700 border-zinc-600',
  advanced:
    'bg-slate-800 hover:bg-slate-700 border-slate-500',
  elite:
    'bg-amber-950/60 hover:bg-amber-900/60 border-amber-600/70',
};

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  skills,
  equippedSkillIds,
  skillCooldowns,
  chests,
  skillTech,
  autoSkillsEnabled,
  onToggleAutoSkills,
  onAssignSkillSlot,
  onUnequipSlot,
  onUnlockSkill,
  onUpgradeSkill,
  onOpenChest,
  onCraftChest,
}) => {
  const [showChestOdds, setShowChestOdds] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<SkillId | null>(null);
  const [upgradedPulseId, setUpgradedPulseId] = useState<SkillId | null>(null);

  const handleUpgradeClick = (id: SkillId) => {
    onUpgradeSkill(id);
    setUpgradedPulseId(id);
    window.setTimeout(() => {
      setUpgradedPulseId((cur) => (cur === id ? null : cur));
    }, 320);
  };

  const canCraftChest = skillTech >= CHEST_CRAFT_TECH_COST;

  return (
    <section aria-label="Tank Skills and Skill Chests" className="space-y-4">
      {/* Skill Chest Armory */}
      <div className="bg-[#12151b] border border-zinc-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-zinc-100">
              Skill Chest Armory
            </h2>
            <p className="text-[11px] text-zinc-400">
              Collect skills and duplicate copies from Bosses & Dungeons.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-[#0d0f14] border border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono-num text-zinc-200 font-semibold">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
              <span>{formatCompactNumber(skillTech)}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowChestOdds((p) => !p)}
              className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border active:scale-95 transition-colors ${
                showChestOdds
                  ? 'bg-zinc-700 border-zinc-500 text-zinc-100'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-100'
              }`}
              title="Chest Drop Probabilities"
              aria-label="Toggle chest probabilities"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showChestOdds && (
          <div className="bg-[#0d0f14] border border-zinc-800 rounded-lg p-2.5 text-[11px] space-y-1.5">
            {(['standard', 'advanced', 'elite'] as ChestTierId[]).map((tid) => {
              const cfg = CHEST_CONFIGS[tid];
              return (
                <div key={tid} className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-100">{cfg.name}</span>
                  <span className="font-mono-num text-zinc-400">
                    Std {cfg.rarityWeights.common}% · Tac {cfg.rarityWeights.rare}% · Ops{' '}
                    {cfg.rarityWeights.epic}% · Proto {cfg.rarityWeights.legendary}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {(['standard', 'advanced', 'elite'] as ChestTierId[]).map((tid) => {
            const cfg = CHEST_CONFIGS[tid];
            const count = chests[tid] ?? 0;
            return (
              <button
                key={tid}
                type="button"
                disabled={count < 1}
                onClick={() => onOpenChest(tid)}
                className={`min-h-[60px] rounded-xl border p-2 flex flex-col items-center justify-center gap-1 transition-colors ${
                  count > 0
                    ? `${CHEST_ACTIVE_STYLES[tid]} active:scale-[0.96]`
                    : 'bg-[#0d0f14] border-zinc-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Box className="w-4 h-4" style={{ color: cfg.accentColor }} />
                  <span className="font-mono-num text-xs font-bold text-zinc-100">x{count}</span>
                </div>
                <span className="text-[11px] font-semibold text-zinc-300 truncate max-w-full">
                  {tid === 'standard' ? 'Standard' : tid === 'advanced' ? 'Advanced' : 'Elite'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Exchange Skill Tech for a Standard Skill Chest */}
        <button
          type="button"
          disabled={!canCraftChest}
          onClick={onCraftChest}
          className={`w-full min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
            canCraftChest
              ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-100 active:scale-[0.98]'
              : 'bg-[#0d0f14] border-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-zinc-300" />
            <span>Fabricate Standard Skill Chest</span>
          </span>
          <span className="font-mono-num text-amber-400 font-bold">
            {CHEST_CRAFT_TECH_COST} Tech
          </span>
        </button>
      </div>

      {/* 3 Equipped Skill Slots + Auto-Skill Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h3 className="font-display text-sm font-bold text-zinc-100 tracking-wide">
            Equipped Loadout ({equippedSkillIds.filter(Boolean).length}/{MAX_EQUIPPED_SKILLS})
          </h3>
          <button
            type="button"
            onClick={onToggleAutoSkills}
            aria-pressed={autoSkillsEnabled}
            className={`min-h-[32px] px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors active:scale-95 ${
              autoSkillsEnabled
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                : 'bg-[#0d0f14] border-zinc-700 text-zinc-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>Auto-Cast: {autoSkillsEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_EQUIPPED_SKILLS }).map((_, idx) => {
            const id = equippedSkillIds[idx];
            if (!id) {
              return (
                <div
                  key={idx}
                  className="min-h-[76px] rounded-xl border border-dashed border-zinc-700 bg-[#0d0f14] p-2 flex flex-col items-center justify-center text-center"
                >
                  <PlusCircle className="w-4 h-4 text-zinc-500 mb-1" />
                  <span className="text-[11px] text-zinc-500">Slot {idx + 1}</span>
                </div>
              );
            }
            const def = SKILL_DEFINITIONS[id];
            const state = skills[id];
            const runtime = skillCooldowns.find((s) => s.id === id);
            const rMeta = SKILL_RARITY_META[def.rarity];
            const ready = !runtime || runtime.cooldownRemaining <= 0.05;
            const active = !!runtime && runtime.activeRemaining > 0;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onUnequipSlot(idx)}
                className={`min-h-[76px] rounded-xl border p-2 text-left flex flex-col justify-between transition-colors active:scale-95 ${rMeta.borderClass} ${rMeta.bgClass} hover:bg-zinc-800/80`}
                title="Tap to unequip slot"
              >
                <div className="flex items-center justify-between gap-1">
                  <SkillIcon skillId={id} size="xs" />
                  <span className="font-mono-num text-[10px] font-bold text-zinc-300">
                    Lv.{state.level}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-zinc-100 truncate mt-1">
                  {def.name}
                </div>
                <div
                  className={`font-mono-num text-[10px] font-bold ${
                    active
                      ? 'text-amber-400'
                      : !autoSkillsEnabled
                        ? 'text-zinc-400'
                        : ready
                          ? 'text-emerald-400'
                          : 'text-zinc-400'
                  }`}
                >
                  {active
                    ? 'Active'
                    : !autoSkillsEnabled
                      ? 'Manual/Paused'
                      : ready
                        ? 'Ready'
                        : `CD ${runtime!.cooldownRemaining.toFixed(1)}s`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Full Skill Collection (8 Skills) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-display text-sm font-bold text-zinc-100 tracking-wide">
            Ordnance Collection ({SKILL_ORDER.filter((id) => skills[id].unlocked).length}/
            {SKILL_ORDER.length})
          </h3>
          <span className="text-[11px] text-zinc-400">Tap skill for details</span>
        </div>

        <div className="space-y-2.5">
          {SKILL_ORDER.map((id) => {
            const def = SKILL_DEFINITIONS[id];
            const state = skills[id];
            const rMeta = SKILL_RARITY_META[def.rarity];
            const equippedIdx = equippedSkillIds.indexOf(id);
            const isEquipped = equippedIdx !== -1;
            const computed = getSkillComputedStats(id, state.level);
            const reqDuplicates = getRequiredDuplicatesForNextLevel(state.level);
            const isMaxLevel = state.level >= MAX_SKILL_LEVEL || reqDuplicates === null;
            const canUpgrade = canUpgradeSkillWithDuplicates(id, skills);
            const canUnlock = !state.unlocked && skillTech >= def.unlockTechCost;
            const progressPct = isMaxLevel
              ? 100
              : Math.min(100, Math.round((state.duplicates / Math.max(1, reqDuplicates)) * 100));

            return (
              <div
                key={id}
                className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
                  upgradedPulseId === id ? 'animate-upgrade-burst' : ''
                } ${
                  state.unlocked
                    ? `${rMeta.borderClass} bg-[#12151b]`
                    : 'border-zinc-800 bg-[#0d0f14] opacity-80'
                }`}
              >
                {/* Tappable Header -> Opens Skill Details Modal */}
                <button
                  type="button"
                  onClick={() => setSelectedSkillId(id)}
                  className="w-full text-left flex items-start gap-2.5 group"
                >
                  <SkillIcon skillId={id} size="md" locked={!state.unlocked} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-display text-sm font-bold text-zinc-100 truncate group-hover:text-amber-300 transition-colors">
                          {def.name}
                        </span>
                        <span className={`text-[10px] font-semibold shrink-0 ${rMeta.textClass}`}>
                          {rMeta.label}
                        </span>
                      </div>
                      <span className="font-mono-num text-[11px] font-bold text-zinc-300 shrink-0">
                        {state.unlocked ? `Lv.${state.level}/${MAX_SKILL_LEVEL}` : 'Locked'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                      {def.description}
                    </p>

                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono-num text-emerald-400 font-semibold">
                      <span>
                        {computed.statLines[0].label}: {computed.statLines[0].value}
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-400">{def.cooldown}s CD</span>
                    </div>
                  </div>
                </button>

                {/* Duplicate Progress Bar & Upgrade / Equip Controls */}
                {state.unlocked ? (
                  <div className="pt-2 border-t border-zinc-800 space-y-2">
                    {/* Duplicate Counter & Progress Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-mono-num text-zinc-300 shrink-0">
                        <CopyPlus className="w-3.5 h-3.5 text-zinc-400" />
                        <span>
                          {isMaxLevel
                            ? 'MAX LEVEL'
                            : `${state.duplicates}/${reqDuplicates} Copies`}
                        </span>
                      </div>
                      <div className="h-2 flex-1 bg-[#0d0f14] rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className={`h-full transition-[width] duration-200 ${
                            isMaxLevel
                              ? 'bg-amber-500'
                              : canUpgrade
                                ? 'bg-emerald-500'
                                : 'bg-zinc-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSkillId(id)}
                        className="min-h-[38px] px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] font-semibold text-zinc-300 transition-colors"
                      >
                        Details
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canUpgrade}
                          onClick={() => handleUpgradeClick(id)}
                          className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                            canUpgrade
                              ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950 font-bold active:scale-95'
                              : 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                          }`}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span className="font-mono-num">
                            {isMaxLevel ? 'Maxed' : `Upgrade (${reqDuplicates})`}
                          </span>
                        </button>

                        {isEquipped ? (
                          <button
                            type="button"
                            onClick={() => onUnequipSlot(equippedIdx)}
                            className="min-h-[38px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-700/60 active:scale-95 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Slot {equippedIdx + 1}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedSkillId(id)}
                            className="min-h-[38px] px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 border border-amber-500 text-zinc-950 active:scale-95 transition-colors"
                          >
                            {equippedSkillIds.some((s) => s === null) ? 'Equip' : 'Swap'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500">
                      Obtain from Skill Chests or Workshop
                    </span>
                    <button
                      type="button"
                      disabled={!canUnlock}
                      onClick={() => onUnlockSkill(id)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        canUnlock
                          ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 text-zinc-950 font-bold active:scale-95'
                          : 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span className="font-mono-num">Unlock ({def.unlockTechCost} Tech)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skill Details & Slot Swap Modal */}
      {selectedSkillId && (
        <SkillDetailModal
          skillId={selectedSkillId}
          skills={skills}
          equippedSkillIds={equippedSkillIds}
          skillTech={skillTech}
          onClose={() => setSelectedSkillId(null)}
          onUpgrade={() => handleUpgradeClick(selectedSkillId)}
          onUnlock={() => onUnlockSkill(selectedSkillId)}
          onAssignSlot={(slotIdx) => {
            onAssignSkillSlot(selectedSkillId, slotIdx);
          }}
          onUnequipSlot={onUnequipSlot}
        />
      )}
    </section>
  );
};

interface SkillDetailModalProps {
  skillId: SkillId;
  skills: SkillCollection;
  equippedSkillIds: (SkillId | null)[];
  skillTech: number;
  onClose: () => void;
  onUpgrade: () => void;
  onUnlock: () => void;
  onAssignSlot: (slotIndex: number) => void;
  onUnequipSlot: (slotIndex: number) => void;
}

const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  skillId,
  skills,
  equippedSkillIds,
  skillTech,
  onClose,
  onUpgrade,
  onUnlock,
  onAssignSlot,
  onUnequipSlot,
}) => {
  const def = SKILL_DEFINITIONS[skillId];
  const state = skills[skillId];
  const rMeta = SKILL_RARITY_META[def.rarity];
  const computed = getSkillComputedStats(skillId, state.level);
  const nextPreview = getSkillNextLevelPreview(skillId, state.level);
  const reqDuplicates = getRequiredDuplicatesForNextLevel(state.level);
  const isMaxLevel = state.level >= MAX_SKILL_LEVEL || reqDuplicates === null;
  const canUpgrade = canUpgradeSkillWithDuplicates(skillId, skills);
  const canUnlock = !state.unlocked && skillTech >= def.unlockTechCost;
  const equippedIdx = equippedSkillIds.indexOf(skillId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${def.name} Details`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[3px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in w-full max-w-md max-h-[88dvh] overflow-y-auto tactical-scroll bg-[#14171d] border border-zinc-700 rounded-2xl p-4 space-y-4 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <SkillIcon skillId={skillId} size="lg" locked={!state.unlocked} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" style={{ color: rMeta.color }} />
                <span className={rMeta.textClass}>{rMeta.label} Skill</span>
                <span className="text-zinc-600">·</span>
                <span className="font-mono-num text-zinc-300">{def.cooldown}s CD</span>
              </div>
              <h2 className="font-display text-lg font-bold text-zinc-100 truncate mt-0.5">
                {def.name}
              </h2>
              <div className="font-mono-num text-xs text-zinc-400">
                {state.unlocked
                  ? `Level ${state.level} / ${MAX_SKILL_LEVEL}`
                  : 'Locked · Obtain in Skill Chest'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 active:scale-95"
            aria-label="Close skill details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{def.description}</p>

        {/* Current Combat Effectiveness */}
        <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3 space-y-2">
          <div className="text-xs font-display font-bold text-zinc-200">
            Current Performance (Lv.{state.level})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {computed.statLines.map((line) => (
              <div
                key={line.label}
                className="rounded-lg bg-[#14171d] border border-zinc-800 px-2.5 py-2"
              >
                <div className="text-[10px] text-zinc-400">{line.label}</div>
                <div className="font-mono-num text-xs font-bold text-emerald-400 mt-0.5">
                  {line.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next-Level Improvement Preview */}
        {state.unlocked && (
          <div className="bg-[#0d0f14] border border-emerald-700/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display font-bold text-emerald-400">
                {isMaxLevel ? 'Max Level Reached' : `Next Upgrade Preview (Lv.${state.level + 1})`}
              </span>
              {!isMaxLevel && (
                <span className="font-mono-num text-xs font-bold text-zinc-300">
                  {state.duplicates}/{reqDuplicates} Duplicates
                </span>
              )}
            </div>
            <ul className="space-y-1 text-xs text-zinc-300 font-mono-num">
              {nextPreview.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Level Milestone Roadmap */}
        <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3 space-y-1.5">
          <div className="text-xs font-display font-bold text-amber-400">Upgrade Milestones</div>
          <div className="space-y-1">
            {computed.milestones.map((m) => {
              const reached = state.unlocked && state.level >= m.level;
              return (
                <div
                  key={m.level}
                  className={`flex items-center justify-between gap-2 text-xs font-mono-num ${
                    reached ? 'text-emerald-400 font-semibold' : 'text-zinc-500'
                  }`}
                >
                  <span>Lv.{m.level}</span>
                  <span className="flex-1 text-right">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upgrade & Loadout Assignment Controls */}
        {state.unlocked ? (
          <div className="space-y-3 pt-1">
            <button
              type="button"
              disabled={!canUpgrade}
              onClick={onUpgrade}
              className={`w-full min-h-[44px] rounded-xl text-sm font-display font-bold flex items-center justify-center gap-2 transition-colors ${
                canUpgrade
                  ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950 active:scale-[0.98]'
                  : 'bg-[#0d0f14] border border-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>
                {isMaxLevel
                  ? 'MAXIMUM LEVEL (LV.10)'
                  : `UPGRADE TO LV.${state.level + 1} (${state.duplicates}/${reqDuplicates} COPIES)`}
              </span>
            </button>

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-400">
                Assign to Battle Loadout Slot (Replace or Equip)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: MAX_EQUIPPED_SKILLS }).map((_, idx) => {
                  const slotOccupant = equippedSkillIds[idx];
                  const isHere = equippedIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => (isHere ? onUnequipSlot(idx) : onAssignSlot(idx))}
                      className={`min-h-[44px] rounded-xl border px-2 py-1.5 text-center transition-colors active:scale-95 ${
                        isHere
                          ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300'
                          : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-100'
                      }`}
                    >
                      <div className="text-[11px] font-bold">
                        {isHere ? 'Unequip' : slotOccupant ? `Replace #${idx + 1}` : `Equip #${idx + 1}`}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {slotOccupant ? SKILL_DEFINITIONS[slotOccupant].name : 'Empty'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canUnlock}
            onClick={onUnlock}
            className={`w-full min-h-[44px] rounded-xl text-sm font-display font-bold flex items-center justify-center gap-2 transition-colors ${
              canUnlock
                ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 text-zinc-950 active:scale-[0.98]'
                : 'bg-[#0d0f14] border border-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>UNLOCK WITH TECH ({def.unlockTechCost} TECH)</span>
          </button>
        )}
      </div>
    </div>
  );
};
