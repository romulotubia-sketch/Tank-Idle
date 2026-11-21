import React, { useEffect, useState } from 'react';
import {
  Anvil,
  Cog,
  Cpu,
  Info,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  EQUIPMENT_RARITY_META,
  EQUIPMENT_SLOTS,
  FORGE_TIERS,
} from '../game/config';
import { canAffordAll, formatCompactNumber } from '../game/economy';
import { getForgeProbabilityList } from '../game/forge';
import type {
  EquipmentItem,
  EquipmentSlot,
  EquippedGearMap,
  ForgeTierId,
  Wallet,
} from '../game/types';
import { SLOT_ICONS, formatEquipmentBonuses } from './EquipmentSlotIcon';

export interface InlineForgeNotice {
  item: EquipmentItem;
  autoEquipped: boolean;
  timestamp: number;
}

interface BattleForgeStripProps {
  wallet: Wallet;
  equippedGear: EquippedGearMap;
  selectedSlot: EquipmentSlot;
  selectedTier: ForgeTierId;
  lastNotice: InlineForgeNotice | null;
  storageWarning?: string | null;
  inInventoryIds: Set<string>;
  onSelectSlot: (slot: EquipmentSlot) => void;
  onInspectSlot: (slot: EquipmentSlot) => void;
  onSelectTier: (tier: ForgeTierId) => void;
  onForgeSlot: (slot: EquipmentSlot, tier: ForgeTierId) => void;
  onEquipItem: (item: EquipmentItem) => void;
  onOpenAutoForge: () => void;
}

const TIER_ORDER: ForgeTierId[] = ['standard', 'tactical', 'prototype'];

export const BattleForgeStrip: React.FC<BattleForgeStripProps> = ({
  wallet,
  equippedGear,
  selectedSlot,
  selectedTier,
  lastNotice,
  storageWarning,
  inInventoryIds,
  onSelectSlot,
  onInspectSlot,
  onSelectTier,
  onForgeSlot,
  onEquipItem,
  onOpenAutoForge,
}) => {
  const [showOdds, setShowOdds] = useState(false);
  const [recentForgedSlot, setRecentForgedSlot] = useState<EquipmentSlot | null>(null);

  useEffect(() => {
    if (!lastNotice) return;
    setRecentForgedSlot(lastNotice.item.slot);
    const timer = window.setTimeout(() => {
      setRecentForgedSlot(null);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [lastNotice]);

  const slotMeta = EQUIPMENT_SLOTS.find((s) => s.id === selectedSlot)!;
  const equippedItem = equippedGear[selectedSlot];
  const equippedRarity = equippedItem ? EQUIPMENT_RARITY_META[equippedItem.rarity] : null;
  const equippedBonusSummary = equippedItem
    ? formatEquipmentBonuses(equippedItem).slice(0, 1).join('')
    : null;
  const tier = FORGE_TIERS[selectedTier];
  const canForge = canAffordAll(wallet, {
    scrap: tier.scrapCost,
    forgeCores: tier.coreCost,
  });

  const cycleTier = () => {
    const idx = TIER_ORDER.indexOf(selectedTier);
    onSelectTier(TIER_ORDER[(idx + 1) % TIER_ORDER.length]);
  };

  const handleSlotTap = (slot: EquipmentSlot) => {
    if (selectedSlot === slot) {
      onInspectSlot(slot);
    } else {
      onSelectSlot(slot);
    }
  };

  return (
    <section
      aria-label="Equipment Slots and Compact Forge"
      className="bg-[#12151b] border border-zinc-800 rounded-xl p-1.5 space-y-1.5 shadow-sm"
    >
      {/* 6 Compact Horizontal Equipment Slots */}
      <div className="grid grid-cols-6 gap-1">
        {EQUIPMENT_SLOTS.map((slot) => {
          const item = equippedGear[slot.id];
          const Icon = SLOT_ICONS[slot.id];
          const isSelected = selectedSlot === slot.id;
          const rarityMeta = item ? EQUIPMENT_RARITY_META[item.rarity] : null;
          const isFlashing = recentForgedSlot === slot.id;

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => handleSlotTap(slot.id)}
              title={
                item
                  ? `${item.name} (${rarityMeta?.label}, Lv.${item.level}) · Tap to select, tap again to inspect`
                  : `${slot.label} (Empty)`
              }
              aria-label={`${slot.label}${item ? `: ${item.name}` : ': Empty'}`}
              className={`relative h-9 sm:h-11 rounded-lg border flex flex-col items-center justify-center transition-all active:scale-95 ${
                rarityMeta
                  ? `${rarityMeta.borderClass} ${rarityMeta.bgClass}`
                  : 'border-dashed border-zinc-700 bg-[#0d0f14]'
              } ${
                isSelected
                  ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-[#12151b]'
                  : 'hover:border-zinc-500'
              } ${isFlashing ? 'animate-forge-slot' : ''}`}
            >
              {rarityMeta && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: rarityMeta.color }}
                />
              )}

              <Icon
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  rarityMeta ? rarityMeta.textClass : 'text-zinc-500'
                }`}
              />

              <span
                className={`text-[9px] font-mono-num leading-none mt-0.5 truncate max-w-[92%] ${
                  rarityMeta ? 'text-zinc-100 font-semibold' : 'text-zinc-500'
                }`}
              >
                {item ? `L${item.level}` : slot.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Compact Inline Forging Row */}
      <div className="bg-[#0d0f14] border border-zinc-800 rounded-lg px-2 py-1.5 space-y-1">
        <div className="flex items-center justify-between gap-1.5">
          {/* Selected Slot & Equipped Preview (tap to inspect) */}
          <button
            type="button"
            onClick={() => onInspectSlot(selectedSlot)}
            className="min-w-0 flex-1 text-left flex items-center gap-1.5 group"
            title="Inspect or manage this equipment slot"
          >
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold truncate ${
                  equippedRarity ? equippedRarity.textClass : 'text-zinc-300'
                }`}
              >
                {equippedItem
                  ? `${equippedItem.name}${equippedBonusSummary ? ` · ${equippedBonusSummary}` : ''}`
                  : `${slotMeta.label} · Empty`}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-zinc-400 group-hover:text-amber-400 shrink-0">
                <Search className="w-2.5 h-2.5" />
              </span>
            </div>
          </button>

          {/* Compact Tier Cycle + Odds + Auto/Armory Trigger */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={cycleTier}
              className="h-7 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[10px] font-semibold text-zinc-200 whitespace-nowrap active:scale-95 transition-all"
              title="Switch Forge Calibration Tier"
            >
              {selectedTier === 'standard'
                ? 'Field'
                : selectedTier === 'tactical'
                  ? 'Tactical'
                  : 'Proto'}
            </button>

            <button
              type="button"
              onClick={() => setShowOdds((p) => !p)}
              className={`h-7 w-7 flex items-center justify-center rounded border active:scale-95 transition-all ${
                showOdds
                  ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
              }`}
              aria-label="Toggle rarity probabilities"
              title="Rarity probabilities"
            >
              <Info className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={onOpenAutoForge}
              className="h-7 px-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-amber-600/45 text-[10px] font-semibold text-amber-300 flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all"
              title="Auto Forge & Full Armory"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Auto</span>
            </button>
          </div>
        </div>

        {/* Expandable Compact Rarity Odds */}
        {showOdds && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-1 border-t border-zinc-800 text-[10px]">
            {getForgeProbabilityList(selectedTier).map((p) => {
              const meta = EQUIPMENT_RARITY_META[p.rarity];
              return (
                <div
                  key={p.rarity}
                  className={`rounded border px-1.5 py-0.5 flex items-center justify-between gap-1 ${meta.borderClass} ${meta.bgClass}`}
                >
                  <span className={`font-semibold ${meta.textClass}`}>{p.label.slice(0, 4)}</span>
                  <span className="font-mono-num text-zinc-100">{p.chancePercent}%</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Cost Requirements + FORGE CTA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-[11px] font-mono-num">
            <span
              className={`flex items-center gap-1 font-semibold ${
                wallet.scrap >= tier.scrapCost ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              <Cog className="w-3 h-3" />
              {formatCompactNumber(tier.scrapCost)}
            </span>
            <span
              className={`flex items-center gap-1 font-semibold ${
                wallet.forgeCores >= tier.coreCost ? 'text-zinc-200' : 'text-red-400'
              }`}
            >
              <Cpu className="w-3 h-3" />
              {formatCompactNumber(tier.coreCost)}
            </span>
          </div>

          <button
            type="button"
            disabled={!canForge}
            onClick={() => onForgeSlot(selectedSlot, selectedTier)}
            className={`h-8 px-3.5 rounded-lg font-display font-bold text-xs tracking-wider flex items-center gap-1.5 shrink-0 transition-all ${
              canForge
                ? 'bg-amber-600 hover:bg-amber-500 active:scale-[0.96] text-zinc-950 border border-amber-500'
                : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/60 cursor-not-allowed'
            }`}
          >
            <Anvil className="w-3.5 h-3.5" />
            <span>FORGE</span>
          </button>
        </div>

        {/* Storage Full Warning */}
        {storageWarning && (
          <div className="pt-1 border-t border-zinc-800 flex items-center justify-between gap-2 text-[10px] text-amber-400">
            <span className="truncate">{storageWarning}</span>
            <button
              type="button"
              onClick={onOpenAutoForge}
              className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-semibold shrink-0"
            >
              Armory
            </button>
          </div>
        )}

        {/* Compact Forge Result Notification */}
        {!storageWarning && lastNotice && (
          <div
            key={lastNotice.timestamp}
            className="animate-forge-result pt-1 border-t border-zinc-800 flex items-center justify-between gap-2 text-[10px]"
          >
            <div className="min-w-0 truncate">
              <span className="text-zinc-400">Forged: </span>
              <span className={`font-bold ${EQUIPMENT_RARITY_META[lastNotice.item.rarity].textClass}`}>
                {EQUIPMENT_RARITY_META[lastNotice.item.rarity].label}
              </span>
              <span className="text-zinc-100 font-semibold ml-1">
                {lastNotice.item.name}
              </span>
              <span className="font-mono-num text-zinc-400 ml-1">
                (PWR {lastNotice.item.powerScore})
              </span>
            </div>

            {lastNotice.autoEquipped ? (
              <span className="text-emerald-400 font-semibold shrink-0">Equipped</span>
            ) : inInventoryIds.has(lastNotice.item.id) ? (
              <button
                type="button"
                onClick={() => onEquipItem(lastNotice.item)}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold shrink-0"
              >
                Equip
              </button>
            ) : (
              <span className="text-zinc-500 shrink-0">Stored</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
