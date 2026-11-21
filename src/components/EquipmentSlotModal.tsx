import React from 'react';
import { ArrowUpCircle, Check, Shield, Trash2, X } from 'lucide-react';
import { EQUIPMENT_RARITY_META, EQUIPMENT_SLOTS } from '../game/config';
import { canAffordAll } from '../game/economy';
import {
  getEquipmentSalvageYield,
  getEquipmentUpgradeCost,
} from '../game/forge';
import type {
  EquipmentItem,
  EquipmentSlot,
  Wallet,
} from '../game/types';
import { SLOT_ICONS, formatEquipmentBonuses } from './EquipmentSlotIcon';

interface EquipmentSlotModalProps {
  slot: EquipmentSlot | null;
  equippedItem: EquipmentItem | null;
  inventory: EquipmentItem[];
  wallet: Wallet;
  onClose: () => void;
  onEquipItem: (item: EquipmentItem) => void;
  onUpgradeItem: (itemId: string, equippedSlot?: EquipmentSlot) => void;
  onSalvageItem: (itemId: string) => void;
}

export const EquipmentSlotModal: React.FC<EquipmentSlotModalProps> = ({
  slot,
  equippedItem,
  inventory,
  wallet,
  onClose,
  onEquipItem,
  onUpgradeItem,
  onSalvageItem,
}) => {
  if (!slot) return null;

  const slotMeta = EQUIPMENT_SLOTS.find((s) => s.id === slot)!;
  const SlotIcon = SLOT_ICONS[slot];
  const slotInventory = inventory.filter((i) => i.slot === slot);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${slotMeta.label} Inspector`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in w-full max-w-md max-h-[85dvh] bg-[#14171d] border border-zinc-700 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="shrink-0 bg-[#12151b] border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-amber-400 shrink-0">
              <SlotIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold text-zinc-100 truncate">
                {slotMeta.label} Slot
              </h2>
              <div className="text-[11px] text-zinc-400">
                Inspect equipped component or swap from storage
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 active:scale-95 transition-colors"
            aria-label="Close slot inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll p-4 space-y-3.5">
          {/* Currently Equipped */}
          {equippedItem ? (
            (() => {
              const meta = EQUIPMENT_RARITY_META[equippedItem.rarity];
              const upgCost = getEquipmentUpgradeCost(equippedItem);
              const canUpgrade = canAffordAll(wallet, upgCost);
              return (
                <div className={`rounded-xl border p-3.5 space-y-2 ${meta.borderClass} ${meta.bgClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-zinc-400">Currently Equipped</div>
                      <div className={`font-display text-sm font-bold ${meta.textClass}`}>
                        {equippedItem.name}{' '}
                        <span className="font-mono-num text-zinc-100">Lv.{equippedItem.level}</span>
                      </div>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-zinc-100">
                      PWR {equippedItem.powerScore}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono-num text-emerald-400">
                    {formatEquipmentBonuses(equippedItem).map((b) => (
                      <span key={b}>{b}</span>
                    ))}
                  </div>

                  {equippedItem.passive && (
                    <div className="text-xs text-amber-400">
                      Passive · {equippedItem.passive.label}: {equippedItem.passive.description}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => onUpgradeItem(equippedItem.id, slot)}
                    className={`w-full min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      canUpgrade
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600 active:scale-[0.98]'
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
            })()
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-[#0d0f14] p-4 text-center space-y-1">
              <Shield className="w-5 h-5 text-zinc-500 mx-auto" />
              <div className="text-xs font-semibold text-zinc-200">Slot Empty</div>
              <div className="text-[11px] text-zinc-500">
                Forge directly on the Battle screen or equip from storage below.
              </div>
            </div>
          )}

          {/* Matching Storage Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200">
                Stored {slotMeta.label} Gear ({slotInventory.length})
              </span>
              <span className="text-[11px] text-zinc-400 font-mono-num">
                Total Storage: {inventory.length}/24
              </span>
            </div>

            {slotInventory.length === 0 ? (
              <div className="bg-[#0d0f14] border border-zinc-800 rounded-xl p-3 text-center text-xs text-zinc-500">
                No spare gear stored for this slot.
              </div>
            ) : (
              <div className="space-y-2">
                {slotInventory.map((item) => {
                  const meta = EQUIPMENT_RARITY_META[item.rarity];
                  const delta = item.powerScore - (equippedItem?.powerScore ?? 0);
                  const salvageVal = getEquipmentSalvageYield(item);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2.5 bg-[#0d0f14] space-y-1.5 ${meta.borderClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`text-xs font-bold truncate ${meta.textClass}`}>
                            {item.name}
                          </span>
                          <span className="font-mono-num text-[11px] text-zinc-400 ml-1.5">
                            Lv.{item.level}
                          </span>
                        </div>
                        <span
                          className={`font-mono-num text-[11px] font-bold shrink-0 ${
                            delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          PWR {item.powerScore} ({delta >= 0 ? `+${delta}` : delta})
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-2 text-[11px] font-mono-num text-zinc-200">
                        {formatEquipmentBonuses(item).map((b) => (
                          <span key={b}>{b}</span>
                        ))}
                      </div>

                      {item.passive && (
                        <div className="text-[11px] text-amber-400">
                          {item.passive.label}: {item.passive.description}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onEquipItem(item)}
                          className="flex-1 min-h-[38px] rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1 active:scale-[0.98] transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Equip</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSalvageItem(item.id)}
                          className="min-h-[38px] px-2.5 rounded-lg bg-zinc-800 hover:bg-red-950/70 border border-zinc-700 hover:border-red-700/60 text-zinc-300 hover:text-red-200 text-xs flex items-center gap-1 active:scale-95 transition-colors"
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
        </div>
      </div>
    </div>
  );
};
