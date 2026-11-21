import React, { useEffect, useState } from 'react';
import { Box, CopyPlus, Cpu, Sparkles, X } from 'lucide-react';
import {
  CHEST_CONFIGS,
  SKILL_DEFINITIONS,
  SKILL_RARITY_META,
} from '../game/config';
import type { ChestReward } from '../game/types';
import { SkillIcon } from './SkillIcon';

interface SkillChestModalProps {
  reward: ChestReward | null;
  onClose: () => void;
}

export const SkillChestModal: React.FC<SkillChestModalProps> = ({
  reward,
  onClose,
}) => {
  const [phase, setPhase] = useState<'opening' | 'revealed'>('opening');

  useEffect(() => {
    if (!reward) return;
    setPhase('opening');
    const timer = window.setTimeout(() => {
      setPhase('revealed');
    }, 620);
    return () => window.clearTimeout(timer);
  }, [reward]);

  if (!reward) return null;

  const chestCfg = CHEST_CONFIGS[reward.chestTier];
  const skillDef = SKILL_DEFINITIONS[reward.skillId];
  const rarityMeta = SKILL_RARITY_META[reward.rarity];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Skill Chest Reward"
      onClick={() => phase === 'revealed' && onClose()}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in w-full max-w-sm bg-[#14171d] border border-zinc-700 rounded-2xl p-5 text-center space-y-4 relative overflow-hidden shadow-2xl"
      >
        {phase === 'opening' ? (
          <div className="py-8 space-y-4">
            <div
              className="w-20 h-20 rounded-2xl mx-auto border-2 flex items-center justify-center animate-bounce"
              style={{
                borderColor: chestCfg.accentColor,
                backgroundColor: '#0d0f14',
              }}
            >
              <Box className="w-10 h-10" style={{ color: chestCfg.accentColor }} />
            </div>
            <div>
              <div className="font-display text-base font-bold text-zinc-100">
                Unsealing {chestCfg.name}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Decrypting tactical ordnance module...
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100"
              aria-label="Close reward"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pt-1 space-y-1">
              <div className="text-xs font-semibold text-amber-400 tracking-wide">
                {chestCfg.name} Opened
              </div>
              <h3 className="font-display text-lg font-bold text-zinc-100">
                {reward.isNewUnlock ? 'New Skill Unlocked!' : 'Duplicate Copy Acquired!'}
              </h3>
            </div>

            <div
              className={`animate-forge-result rounded-xl border p-4 space-y-3 ${rarityMeta.borderClass} ${rarityMeta.bgClass}`}
            >
              <div className="flex justify-center">
                <SkillIcon skillId={reward.skillId} size="lg" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: rarityMeta.color }} />
                  <span className={rarityMeta.textClass}>{rarityMeta.label} Skill</span>
                </div>

                <div className="font-display text-xl font-bold text-zinc-100">
                  {skillDef.name}
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  {skillDef.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-zinc-800 flex items-center justify-center gap-3 text-xs font-mono-num">
                {reward.isNewUnlock ? (
                  <span className="text-emerald-400 font-bold">Unlocked Lv. 1</span>
                ) : (
                  <span className="text-zinc-200 font-bold flex items-center gap-1">
                    <CopyPlus className="w-3.5 h-3.5 text-zinc-400" />+{reward.duplicatesGranted} Duplicate Copy
                  </span>
                )}
                <span className="text-zinc-600">·</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" />+{reward.bonusSkillTech} Tech
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-500 active:scale-[0.98] text-zinc-950 font-display font-bold text-sm tracking-wide transition-colors"
            >
              COLLECT REWARDS
            </button>
          </>
        )}
      </div>
    </div>
  );
};
