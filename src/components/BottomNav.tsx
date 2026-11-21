import React from 'react';
import { Crosshair, ShieldAlert, Skull, Trophy, Zap } from 'lucide-react';
import type { NavTab } from '../game/types';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  affordableUpgradesCount: number;
  unopenedChestsCount: number;
  dungeonReadyCount: number;
  claimableProgressionCount: number;
}

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'battle', label: 'Battle', icon: Crosshair },
  { id: 'upgrades', label: 'Upgrades', icon: ShieldAlert },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'dungeons', label: 'Dungeons', icon: Skull },
  { id: 'missions', label: 'Missions', icon: Trophy },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  affordableUpgradesCount,
  unopenedChestsCount,
  dungeonReadyCount,
  claimableProgressionCount,
}) => {
  return (
    <nav
      aria-label="Primary Navigation"
      className="lg:hidden shrink-0 bg-[#12151b] border-t border-zinc-800 grid grid-cols-5 h-14 px-1"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const badgeCount =
          item.id === 'upgrades'
            ? affordableUpgradesCount
            : item.id === 'skills'
              ? unopenedChestsCount
              : item.id === 'dungeons'
                ? dungeonReadyCount
                : item.id === 'missions'
                  ? claimableProgressionCount
                  : 0;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg mx-0.5 my-1 border transition-all active:scale-95 relative ${
              isActive
                ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <div className="relative">
              <Icon className="w-4 h-4" />
              {badgeCount > 0 && !isActive && (
                <span className="absolute -top-1 -right-2.5 font-mono-num text-[10px] font-bold text-amber-400">
                  {badgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
