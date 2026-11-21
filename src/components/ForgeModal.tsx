import React, { useState } from 'react';
import {
  Anvil,
  ArrowUpCircle,
  Check,
  Cog,
  Cpu,
  Layers,
  Lock,
  Play,
  Shield,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  AUTO_FORGE_UNLOCK_LEVEL,
  EQUIPMENT_RARITY_META,
  EQUIPMENT_RARITY_ORDER,
  EQUIPMENT_SLOTS,
  FORGE_TIERS,
} from '../game/config';
import { canAffordAll, formatCompactNumber } from '../game/economy';
import {
  getEquipmentSalvageYield,
  getEquipmentUpgradeCost,
  getForgeProbabilityList,
  isAutoForgeUnlocked,
} from '../game/forge';
import type {
  AutoForgeSettings,
  AutoForgeSummary,
  EquipmentItem,
  EquipmentRarity,
  EquipmentSlot,
  EquippedGearMap,
  ForgeTierId,
  Wallet,
} from '../game/types';

interface ForgeModalProps {
  open: boolean;
  wallet: Wallet;
  tankLevel: number;
  equippedGear: EquippedGearMap;
  inventory: EquipmentItem[];
  lastForgedItem: EquipmentItem | null;
  autoForgeSettings: AutoForgeSettings;
  autoForgeSummary: AutoForgeSummary;
  onClose: () => void;
  onManualForge: (tierId: ForgeTierId) => void;
  onEquipItem: (item: EquipmentItem) => void;
  onUpgradeItem: (itemId: string, isEquippedSlot?: EquipmentSlot) => void;
  onSalvageItem: (itemId: string) => void;
  onUpdateAutoForge: (patch: Partial<AutoForgeSettings>) => void;
  onToggleAutoForgeRun: () => void;
}

type ForgeTab = 'forge' | 'loadout';

function formatBonuses(item: EquipmentItem): string[] {
  const list: string[] = [];
  const b = item.bonuses;
  if (b.maxHp) list.push(`+${b.maxHp} HP`);
  if (b.attackDamage) list.push(`+${b.attackDamage} ATK`);
  if (b.attackSpeed) list.push(`+${b.attackSpeed.toFixed(2)}/s SPD`);
  if (b.armor) list.push(`+${Math.round(b.armor)} ARM`);
  if (b.critChance) list.push(`+${(b.critChance * 100).toFixed(1)}% CRIT`);
  if (b.critDamage) list.push(`+${Math.round(b.critDamage * 100)}% CDMG`);
  return list;
}

export const ForgeModal: React.FC<ForgeModalProps> = ({
  open,
  wallet,
  tankLevel,
  equippedGear,
  inventory,
  lastForgedItem,
  autoForgeSettings,
  autoForgeSummary,
  onClose,
  onManualForge,
  onEquipItem,
  onUpgradeItem,
  onSalvageItem,
  onUpdateAutoForge,
  onToggleAutoForgeRun,
}) => {
  const [subTab, setSubTab] = useState<ForgeTab>('forge');
  const [selectedTier, setSelectedTier] = useState<ForgeTierId>('standard');

  if (!open) return null;

  const tier = FORGE_TIERS[selectedTier];
  const canManualForge = canAffordAll(wallet, {
    scrap: tier.scrapCost,
    forgeCores: tier.coreCost,
  });
  const probabilities = getForgeProbabilityList(selectedTier);
  const autoUnlocked = isAutoForgeUnlocked(tankLevel);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Equipment Forge"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="animate-modal-in w-full max-w-2xl max-h-[92dvh] bg-[#14171d] border border-zinc-700 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="shrink-0 bg-[#12151b] border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-amber-400 shrink-0">
              <Anvil className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-zinc-100 tracking-wide truncate">
                Ordnance Forge & Armory
              </h2>
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span className="font-mono-num text-amber-400 font-semibold">{formatCompactNumber(wallet.scrap)} Scrap</span>
                <span>·</span>
                <span className="font-mono-num text-zinc-200 font-semibold">{formatCompactNumber(wallet.forgeCores)} Cores</span>
                <span>·</span>
                <span className="font-mono-num text-purple-400 font-semibold">{formatCompactNumber(wallet.alloyPlates)} Alloys</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 active:scale-95 transition-colors"
            aria-label="Close Forge"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="shrink-0 grid grid-cols-2 gap-2 p-2.5 bg-[#0d0f14] border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setSubTab('forge')}
            className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              subTab === 'forge'
                ? 'bg-amber-600 text-zinc-950 border border-amber-500'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800'
            }`}
          >
            Fabrication & Auto Forge
          </button>
          <button
            type="button"
            onClick={() => setSubTab('loadout')}
            className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              subTab === 'loadout'
                ? 'bg-amber-600 text-zinc-950 border border-amber-500'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800'
            }`}
          >
            6 Equipment Slots & Storage ({inventory.length})
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll p-4 space-y-4">
          {subTab === 'forge' ? (
            <>
              {/* Forge Calibration Tier Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">
                    Forge Calibration Tier
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Higher tiers yield superior rarities
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['standard', 'tactical', 'prototype'] as ForgeTierId[]).map((tid) => {
                    const cfg = FORGE_TIERS[tid];
                    const active = selectedTier === tid;
                    return (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => setSelectedTier(tid)}
                        className={`p-2.5 rounded-xl border text-left transition-colors ${
                          active
                            ? 'bg-zinc-800 border-amber-500'
                            : 'bg-[#0d0f14] border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="font-display text-xs sm:text-sm font-bold text-zinc-100">
                          {cfg.name}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-mono-num font-semibold">
                          <span className="text-amber-400 flex items-center gap-1">
                            <Cog className="w-3 h-3" /> {cfg.scrapCost}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-300 flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-zinc-400" /> {cfg.coreCost}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rarity Probability Table */}
              <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-100">
                    Reward Probabilities ({tier.name})
                  </span>
                  <span className="text-zinc-400">6 Equipment Slots</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {probabilities.map((p) => {
                    const meta = EQUIPMENT_RARITY_META[p.rarity];
                    return (
                      <div
                        key={p.rarity}
                        className={`rounded-lg border px-2 py-1.5 text-center ${meta.borderClass} ${meta.bgClass}`}
                      >
                        <div className={`text-[11px] font-semibold truncate ${meta.textClass}`}>
                          {p.label}
                        </div>
                        <div className="font-mono-num text-xs font-bold text-zinc-100 mt-0.5">
                          {p.chancePercent}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Manual Forge CTA */}
              <button
                type="button"
                disabled={!canManualForge || autoForgeSettings.enabled}
                onClick={() => onManualForge(selectedTier)}
                className={`w-full min-h-[48px] rounded-xl font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2.5 transition-colors ${
                  canManualForge && !autoForgeSettings.enabled
                    ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 active:scale-[0.985] text-zinc-950'
                    : 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                }`}
              >
                <Anvil className="w-4 h-4" />
                <span>
                  FORGE EQUIPMENT ({tier.scrapCost} Scrap · {tier.coreCost} Cores)
                </span>
              </button>

              {/* Latest Forged Result Card */}
              {lastForgedItem && (
                <EquipmentResultCard
                  item={lastForgedItem}
                  equippedInSlot={equippedGear[lastForgedItem.slot]}
                  inInventory={inventory.some((i) => i.id === lastForgedItem.id)}
                  onEquip={() => onEquipItem(lastForgedItem)}
                  onSalvage={() => onSalvageItem(lastForgedItem.id)}
                />
              )}

              {/* Auto Forge Section */}
              <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-zinc-100">
                      Auto Forge System
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Automatically repeats forging until target rarity or resources deplete.
                    </p>
                  </div>
                  {!autoUnlocked && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 shrink-0">
                      <Lock className="w-3.5 h-3.5" /> Lv. {AUTO_FORGE_UNLOCK_LEVEL}
                    </span>
                  )}
                </div>

                {!autoUnlocked ? (
                  <div className="bg-[#12151b] border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 flex items-center justify-between gap-3">
                    <span>
                      Locked · Reach <strong className="text-amber-400">Tank Level {AUTO_FORGE_UNLOCK_LEVEL}</strong> via combat XP to unlock.
                    </span>
                    <span className="font-mono-num font-bold text-zinc-200 shrink-0">
                      Lv. {tankLevel} / {AUTO_FORGE_UNLOCK_LEVEL}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          Target Rarity Stop Condition
                        </label>
                        <select
                          value={autoForgeSettings.targetRarity}
                          disabled={autoForgeSettings.enabled}
                          onChange={(e) =>
                            onUpdateAutoForge({ targetRarity: e.target.value as EquipmentRarity })
                          }
                          className="w-full min-h-[40px] rounded-lg bg-[#12151b] border border-zinc-700 px-3 text-xs font-semibold text-zinc-100"
                        >
                          {EQUIPMENT_RARITY_ORDER.slice(1).map((r) => (
                            <option key={r} value={r}>
                              {EQUIPMENT_RARITY_META[r].label} or higher
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">
                          Auto Forge Calibration
                        </label>
                        <select
                          value={autoForgeSettings.tierId}
                          disabled={autoForgeSettings.enabled}
                          onChange={(e) =>
                            onUpdateAutoForge({ tierId: e.target.value as ForgeTierId })
                          }
                          className="w-full min-h-[40px] rounded-lg bg-[#12151b] border border-zinc-700 px-3 text-xs font-semibold text-zinc-100"
                        >
                          {(['standard', 'tactical', 'prototype'] as ForgeTierId[]).map((tid) => (
                            <option key={tid} value={tid}>
                              {FORGE_TIERS[tid].name} ({FORGE_TIERS[tid].scrapCost}S / {FORGE_TIERS[tid].coreCost}C)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Explicit Auto-Salvage Consent Toggle */}
                    <label className="flex items-center justify-between gap-3 bg-[#12151b] border border-zinc-800 rounded-lg px-3 py-2 cursor-pointer">
                      <span className="text-xs text-zinc-300">
                        Auto-salvage rolls below target rarity into Scrap & Alloys
                      </span>
                      <input
                        type="checkbox"
                        checked={autoForgeSettings.autoSalvageLower}
                        disabled={autoForgeSettings.enabled}
                        onChange={(e) =>
                          onUpdateAutoForge({ autoSalvageLower: e.target.checked })
                        }
                        className="w-4 h-4 accent-amber-500"
                      />
                    </label>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={onToggleAutoForgeRun}
                        className={`min-h-[44px] px-4 rounded-lg font-display font-bold text-xs tracking-wider flex items-center gap-2 transition-colors active:scale-95 ${
                          autoForgeSettings.enabled
                            ? 'bg-red-700 hover:bg-red-600 border border-red-600 text-zinc-100'
                            : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950'
                        }`}
                      >
                        {autoForgeSettings.enabled ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>STOP AUTO FORGE</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>START AUTO FORGE</span>
                          </>
                        )}
                      </button>

                      <div className="text-right text-xs font-mono-num text-zinc-200">
                        <div>
                          Runs: {autoForgeSummary.attempts} · Salvaged: {autoForgeSummary.salvagedCount}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Spent: {autoForgeSummary.scrapSpent} Scrap · {autoForgeSummary.coresSpent} Cores
                        </div>
                      </div>
                    </div>

                    {autoForgeSummary.stopReason && (
                      <div className="text-xs text-amber-300 bg-amber-950/50 border border-amber-700/50 rounded-lg px-3 py-2">
                        {autoForgeSummary.stopReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 6 Equipped Slots */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-100">
                  Active Tank Loadout (6 Slots)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {EQUIPMENT_SLOTS.map((slot) => {
                    const eq = equippedGear[slot.id];
                    if (!eq) {
                      return (
                        <div
                          key={slot.id}
                          className="bg-[#0d0f14] border border-dashed border-zinc-700 rounded-xl p-3 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-semibold text-zinc-300">
                              {slot.label}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              Empty Slot · Forge gear to equip
                            </div>
                          </div>
                          <Shield className="w-4 h-4 text-zinc-600" />
                        </div>
                      );
                    }

                    const meta = EQUIPMENT_RARITY_META[eq.rarity];
                    const upgCost = getEquipmentUpgradeCost(eq);
                    const canUpgrade = canAffordAll(wallet, upgCost);

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-xl border p-3 space-y-2 ${meta.borderClass} ${meta.bgClass}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] text-zinc-400">{slot.label}</div>
                            <div className={`text-xs font-bold truncate ${meta.textClass}`}>
                              {eq.name} <span className="text-zinc-100">Lv.{eq.level}</span>
                            </div>
                          </div>
                          <span className="font-mono-num text-[11px] font-bold text-zinc-100 shrink-0">
                            PWR {eq.powerScore}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-mono-num text-emerald-400">
                          {formatBonuses(eq).map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </div>

                        {eq.passive && (
                          <div className="text-[11px] text-amber-400 leading-snug">
                            Passive: {eq.passive.description}
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={!canUpgrade}
                          onClick={() => onUpgradeItem(eq.id, slot.id)}
                          className={`w-full min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            canUpgrade
                              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600 active:scale-95'
                              : 'bg-[#0d0f14] text-zinc-500 border border-zinc-800 cursor-not-allowed'
                          }`}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            Upgrade ({upgCost.scrap} Scrap · {upgCost.alloyPlates} Alloys)
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Armory Storage Inventory */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-100">
                    Armory Storage ({inventory.length}/24)
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    Compare Power Score before equipping
                  </span>
                </div>

                {inventory.length === 0 ? (
                  <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-5 text-center text-xs text-zinc-500">
                    No stored gear. Forge equipment or raid Armored Stronghold to stock your armory.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inventory.map((item) => {
                      const meta = EQUIPMENT_RARITY_META[item.rarity];
                      const currentEquipped = equippedGear[item.slot];
                      const powerDelta = item.powerScore - (currentEquipped?.powerScore ?? 0);
                      const salvageVal = getEquipmentSalvageYield(item);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#0d0f14] ${meta.borderClass}`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold truncate ${meta.textClass}`}>
                                {item.name}
                              </span>
                              <span className="font-mono-num text-[11px] text-zinc-400">
                                Lv.{item.level} · PWR {item.powerScore}
                              </span>
                              {powerDelta !== 0 && (
                                <span
                                  className={`font-mono-num text-[11px] font-bold ${
                                    powerDelta > 0 ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  ({powerDelta > 0 ? `+${powerDelta}` : powerDelta})
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-x-2 text-[11px] font-mono-num text-zinc-200">
                              {formatBonuses(item).map((line) => (
                                <span key={line}>{line}</span>
                              ))}
                            </div>

                            {item.passive && (
                              <div className="text-[11px] text-amber-400">
                                {item.passive.label}: {item.passive.description}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onEquipItem(item)}
                              className="min-h-[40px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950 text-xs font-bold flex items-center gap-1 active:scale-95 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Equip</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSalvageItem(item.id)}
                              className="min-h-[40px] px-2.5 rounded-lg bg-zinc-800 hover:bg-red-950/70 border border-zinc-700 hover:border-red-700/60 text-zinc-300 hover:text-red-200 text-xs font-medium flex items-center gap-1 active:scale-95 transition-colors"
                              title={`Salvage for +${salvageVal.scrap} Scrap, +${salvageVal.alloyPlates} Alloys`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="font-mono-num">+{salvageVal.scrap}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const EquipmentResultCard: React.FC<{
  item: EquipmentItem;
  equippedInSlot: EquipmentItem | null;
  inInventory: boolean;
  onEquip: () => void;
  onSalvage: () => void;
}> = ({ item, equippedInSlot, inInventory, onEquip, onSalvage }) => {
  const meta = EQUIPMENT_RARITY_META[item.rarity];
  const powerDelta = item.powerScore - (equippedInSlot?.powerScore ?? 0);
  const salvageVal = getEquipmentSalvageYield(item);

  return (
    <div
      key={item.id}
      className={`animate-forge-result rounded-xl border p-3.5 space-y-2 ${meta.borderClass} ${meta.bgClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Latest Forged Component</span>
          </div>
          <div className={`font-display text-sm font-bold mt-0.5 ${meta.textClass}`}>
            {item.name}
          </div>
        </div>
        <div className="text-right font-mono-num">
          <div className="text-xs font-bold text-zinc-100">PWR {item.powerScore}</div>
          <div
            className={`text-[11px] font-bold ${
              powerDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {powerDelta >= 0 ? `+${powerDelta}` : powerDelta} vs equipped
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono-num text-zinc-100">
        {formatBonuses(item).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      {item.passive && (
        <div className="text-xs text-amber-400">
          Passive · {item.passive.label}: {item.passive.description}
        </div>
      )}

      {inInventory ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onEquip}
            className="flex-1 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950 text-xs font-bold active:scale-95 transition-colors"
          >
            Equip Now
          </button>
          <button
            type="button"
            onClick={onSalvage}
            className="min-h-[40px] px-3 rounded-lg bg-zinc-800 hover:bg-red-950/70 border border-zinc-700 hover:border-red-700/60 text-zinc-300 text-xs font-medium active:scale-95 transition-colors"
          >
            Salvage (+{salvageVal.scrap} Scrap)
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-zinc-400 pt-0.5">
          Processed (Equipped or Auto-Salvaged)
        </div>
      )}
    </div>
  );
};
