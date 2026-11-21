import React, { useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Check,
  Coins,
  Cpu,
  Flame,
  Gift,
  Lock,
  Package,
  Shield,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  EQUIPMENT_RARITY_META,
  LOGIN_REWARD_CALENDAR,
  TANK_MILESTONES,
} from '../game/config';
import { formatCompactNumber } from '../game/economy';
import {
  canClaimLoginReward,
  getAchievementProgress,
  getNextLoginDayNumber,
  type AchievementContext,
} from '../game/progressionSystems';
import type {
  AchievementCategory,
  DailyMissionsState,
  EquipmentItem,
  LoginCalendarState,
  MissionItem,
  ProgressionRewardBundle,
  WeeklyMissionsState,
} from '../game/types';

type SubTabId = 'daily' | 'weekly' | 'login' | 'achievements' | 'milestones';

interface MissionsPanelProps {
  dailyMissions: DailyMissionsState;
  weeklyMissions: WeeklyMissionsState;
  loginCalendar: LoginCalendarState;
  claimedAchievements: string[];
  claimedMilestones: number[];
  achievementContext: AchievementContext;
  tankLevel: number;
  apexSkinEnabled: boolean;
  claimedEquipmentDrop: EquipmentItem | null;
  onClaimDailyMission: (missionId: string) => void;
  onClaimWeeklyMission: (missionId: string) => void;
  onClaimLoginReward: () => void;
  onClaimAchievement: (achievementId: string) => void;
  onClaimMilestone: (level: number) => void;
  onToggleApexSkin: () => void;
  onEquipDroppedItem: (item: EquipmentItem) => void;
  onDismissDroppedItem: () => void;
}

const RewardSummaryStrip: React.FC<{ rewards: ProgressionRewardBundle }> = ({ rewards }) => {
  const chips: { key: string; label: string; colorClass: string; icon: React.ReactNode }[] = [];

  if (rewards.scrap) {
    chips.push({
      key: 'scrap',
      label: `+${formatCompactNumber(rewards.scrap)} Scrap`,
      colorClass: 'border-amber-700/50 bg-amber-950/40 text-amber-300',
      icon: <Coins className="w-3 h-3 text-amber-400 shrink-0" />,
    });
  }
  if (rewards.forgeCores) {
    chips.push({
      key: 'cores',
      label: `+${rewards.forgeCores} Cores`,
      colorClass: 'border-orange-700/50 bg-orange-950/40 text-orange-300',
      icon: <Flame className="w-3 h-3 text-orange-400 shrink-0" />,
    });
  }
  if (rewards.skillTech) {
    chips.push({
      key: 'tech',
      label: `+${rewards.skillTech} Tech`,
      colorClass: 'border-sky-700/50 bg-sky-950/40 text-sky-300',
      icon: <Cpu className="w-3 h-3 text-sky-400 shrink-0" />,
    });
  }
  if (rewards.alloyPlates) {
    chips.push({
      key: 'alloy',
      label: `+${rewards.alloyPlates} Alloys`,
      colorClass: 'border-zinc-700 bg-zinc-800/70 text-zinc-200',
      icon: <Shield className="w-3 h-3 text-zinc-400 shrink-0" />,
    });
  }
  if (rewards.chests?.standard) {
    chips.push({
      key: 'sc',
      label: `${rewards.chests.standard}x Skill Chest`,
      colorClass: 'border-purple-700/50 bg-purple-950/40 text-purple-300',
      icon: <Package className="w-3 h-3 text-purple-400 shrink-0" />,
    });
  }
  if (rewards.chests?.advanced) {
    chips.push({
      key: 'ac',
      label: `${rewards.chests.advanced}x Adv Skill Chest`,
      colorClass: 'border-sky-700/50 bg-sky-950/40 text-sky-300',
      icon: <Package className="w-3 h-3 text-sky-400 shrink-0" />,
    });
  }
  if (rewards.chests?.elite) {
    chips.push({
      key: 'ec',
      label: `${rewards.chests.elite}x Elite Skill Chest`,
      colorClass: 'border-amber-600/50 bg-amber-950/50 text-amber-300',
      icon: <Package className="w-3 h-3 text-amber-400 shrink-0" />,
    });
  }
  if (rewards.equipmentChest) {
    chips.push({
      key: 'eqc',
      label:
        rewards.equipmentChest === 'premium'
          ? 'Premium Equipment Chest'
          : 'Equipment Chest',
      colorClass:
        rewards.equipmentChest === 'premium'
          ? 'border-amber-600/50 bg-amber-950/50 text-amber-300'
          : 'border-emerald-700/50 bg-emerald-950/45 text-emerald-300',
      icon: <Gift className="w-3 h-3 text-emerald-400 shrink-0" />,
    });
  }
  if (rewards.featureUnlockLabel) {
    chips.push({
      key: 'unlock',
      label: rewards.featureUnlockLabel,
      colorClass: 'border-amber-700/50 bg-amber-950/40 text-amber-300',
      icon: <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />,
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold font-mono-num ${c.colorClass}`}
        >
          {c.icon}
          <span>{c.label}</span>
        </span>
      ))}
    </div>
  );
};

export const MissionsPanel: React.FC<MissionsPanelProps> = ({
  dailyMissions,
  weeklyMissions,
  loginCalendar,
  claimedAchievements,
  claimedMilestones,
  achievementContext,
  tankLevel,
  apexSkinEnabled,
  claimedEquipmentDrop,
  onClaimDailyMission,
  onClaimWeeklyMission,
  onClaimLoginReward,
  onClaimAchievement,
  onClaimMilestone,
  onToggleApexSkin,
  onEquipDroppedItem,
  onDismissDroppedItem,
}) => {
  const [subTab, setSubTab] = useState<SubTabId>('daily');
  const [achCategory, setAchCategory] = useState<AchievementCategory | 'all'>('all');

  const claimableDailyCount = useMemo(
    () => dailyMissions.missions.filter((m) => !m.claimed && m.progress >= m.target).length,
    [dailyMissions.missions],
  );
  const claimableWeeklyCount = useMemo(
    () => weeklyMissions.missions.filter((m) => !m.claimed && m.progress >= m.target).length,
    [weeklyMissions.missions],
  );
  const loginAvailable = useMemo(
    () => canClaimLoginReward(loginCalendar),
    [loginCalendar],
  );
  const claimableAchCount = useMemo(
    () =>
      ACHIEVEMENTS.filter(
        (a) =>
          !claimedAchievements.includes(a.id) &&
          getAchievementProgress(a, achievementContext) >= a.target,
      ).length,
    [claimedAchievements, achievementContext],
  );
  const claimableMilestoneCount = useMemo(
    () =>
      TANK_MILESTONES.filter(
        (m) => tankLevel >= m.level && !claimedMilestones.includes(m.level),
      ).length,
    [tankLevel, claimedMilestones],
  );

  const nextLoginDay = getNextLoginDayNumber(loginCalendar);

  const filteredAchievements = useMemo(
    () =>
      achCategory === 'all'
        ? ACHIEVEMENTS
        : ACHIEVEMENTS.filter((a) => a.category === achCategory),
    [achCategory],
  );

  const renderMissionCard = (
    m: MissionItem,
    onClaim: (id: string) => void,
    accentColor: 'amber' | 'purple',
  ) => {
    const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
    const ready = !m.claimed && m.progress >= m.target;
    const barColor = m.claimed
      ? 'bg-emerald-600/60'
      : ready
        ? 'bg-emerald-500'
        : accentColor === 'purple'
          ? 'bg-purple-500'
          : 'bg-amber-500';

    return (
      <div
        key={m.id}
        className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
          ready
            ? 'bg-[#151b18] border-emerald-700/60'
            : m.claimed
              ? 'bg-[#0d0f14] border-zinc-800 opacity-70'
              : 'bg-[#12151b] border-zinc-800'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-zinc-100 leading-tight">{m.title}</h4>
            <p className="text-xs text-zinc-400 mt-0.5">{m.description}</p>
          </div>
          <span className="font-mono-num text-xs font-bold text-zinc-300 shrink-0">
            {formatCompactNumber(m.progress)} / {formatCompactNumber(m.target)}
          </span>
        </div>

        <div className="h-2 rounded-sm bg-[#090a0d] overflow-hidden border border-zinc-800">
          <div className={`h-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <RewardSummaryStrip rewards={m.rewards} />

          {m.claimed ? (
            <span className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-bold inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Claimed</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={!ready}
              onClick={() => onClaim(m.id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
                ready
                  ? 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950'
                  : 'bg-[#0d0f14] border border-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {ready ? 'Claim Reward' : `${pct}%`}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header + 5 Sub-Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-zinc-100">
              Operations &amp; Progression
            </h2>
            <p className="text-xs text-zinc-400">
              Complete missions, claim login supplies, and unlock tank milestones.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1 bg-[#0d0f14] p-1 rounded-xl border border-zinc-800">
          {(
            [
              { id: 'daily', label: 'Daily', icon: Target, count: claimableDailyCount },
              { id: 'weekly', label: 'Weekly', icon: Flame, count: claimableWeeklyCount },
              { id: 'login', label: 'Login', icon: Calendar, count: loginAvailable ? 1 : 0 },
              { id: 'achievements', label: 'Feats', icon: Trophy, count: claimableAchCount },
              { id: 'milestones', label: 'Levels', icon: Award, count: claimableMilestoneCount },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`min-h-[44px] px-1 py-1.5 rounded-lg text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  active
                    ? 'bg-amber-600/20 border border-amber-500/50 text-amber-300'
                    : 'border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                }`}
              >
                <div className="relative">
                  <Icon className="w-3.5 h-3.5" />
                  {tab.count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 font-mono-num text-[10px] font-bold text-amber-400">
                      {tab.count}
                    </span>
                  )}
                </div>
                <span className="leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Dropped Equipment Notification */}
      {claimedEquipmentDrop && (
        <div
          className={`rounded-xl border p-3 flex items-center justify-between gap-2.5 ${EQUIPMENT_RARITY_META[claimedEquipmentDrop.rarity].bgClass} ${EQUIPMENT_RARITY_META[claimedEquipmentDrop.rarity].borderClass}`}
        >
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-bold text-zinc-400">
              Equipment Chest Opened
            </div>
            <div
              className={`text-sm font-bold truncate ${EQUIPMENT_RARITY_META[claimedEquipmentDrop.rarity].textClass}`}
            >
              {claimedEquipmentDrop.name}
            </div>
            <div className="font-mono-num text-xs text-zinc-300">
              Power {formatCompactNumber(claimedEquipmentDrop.powerScore)} · Stored in Armory
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEquipDroppedItem(claimedEquipmentDrop)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold"
            >
              Equip
            </button>
            <button
              type="button"
              onClick={onDismissDroppedItem}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: DAILY MISSIONS */}
      {subTab === 'daily' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Daily Directives (5 / Day)
            </span>
            <span className="font-mono-num text-[11px] text-zinc-400">
              Cycle {dailyMissions.dateKey}
            </span>
          </div>
          {dailyMissions.missions.map((m) =>
            renderMissionCard(m, onClaimDailyMission, 'amber'),
          )}
        </div>
      )}

      {/* SUB-TAB 2: WEEKLY MISSIONS */}
      {subTab === 'weekly' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Weekly Operations (7-Day Reset)
            </span>
            <span className="font-mono-num text-[11px] text-zinc-400">
              Week of {weeklyMissions.weekStartDate}
            </span>
          </div>
          {weeklyMissions.missions.map((m) =>
            renderMissionCard(m, onClaimWeeklyMission, 'purple'),
          )}
        </div>
      )}

      {/* SUB-TAB 3: 7-DAY LOGIN REWARDS */}
      {subTab === 'login' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#12151b] border border-zinc-800 p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                7-Day Supply Drop
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Claim 1 reward per calendar day. Completing Day 7 resets the cycle.
              </p>
            </div>
            <span className="font-mono-num text-sm font-bold text-zinc-100 shrink-0">
              Day {loginCalendar.claimedDays}/7
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {LOGIN_REWARD_CALENDAR.map((entry) => {
              const isCycleResetAvailable = loginCalendar.claimedDays >= 7 && loginAvailable;
              const isClaimed =
                !isCycleResetAvailable && entry.day <= loginCalendar.claimedDays;
              const isAvailableToday = loginAvailable && entry.day === nextLoginDay;
              const isDay7 = entry.day === 7;

              return (
                <div
                  key={entry.day}
                  className={`rounded-xl border p-2.5 flex flex-col justify-between gap-2 ${
                    isDay7 ? 'col-span-2 sm:col-span-3' : ''
                  } ${
                    isAvailableToday
                      ? 'bg-[#1a1812] border-amber-500/80'
                      : isClaimed
                        ? 'bg-[#0d0f14] border-emerald-800/50 opacity-75'
                        : 'bg-[#12151b] border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-num text-xs font-bold text-zinc-200">
                      DAY {entry.day}
                    </span>
                    {isClaimed ? (
                      <span className="text-[11px] font-bold text-emerald-400 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Claimed
                      </span>
                    ) : isAvailableToday ? (
                      <span className="text-[11px] font-bold text-amber-400">Ready</span>
                    ) : (
                      <span className="text-[11px] font-semibold text-zinc-500">Upcoming</span>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-zinc-100 mb-1">{entry.label}</div>
                    <RewardSummaryStrip rewards={entry.rewards} />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!loginAvailable}
            onClick={onClaimLoginReward}
            className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl font-display text-sm font-bold tracking-wide transition-colors active:scale-[0.98] ${
              loginAvailable
                ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 text-zinc-950'
                : 'bg-[#0d0f14] border border-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {loginAvailable
              ? `Claim Day ${nextLoginDay} Login Reward`
              : 'Today’s Login Reward Claimed · Return Tomorrow'}
          </button>
        </div>
      )}

      {/* SUB-TAB 4: PERMANENT ACHIEVEMENTS */}
      {subTab === 'achievements' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Permanent Achievements
            </span>
            <span className="font-mono-num text-xs font-bold text-zinc-300">
              {claimedAchievements.length} / {ACHIEVEMENTS.length} Claimed
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setAchCategory('all')}
              className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                achCategory === 'all'
                  ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                  : 'bg-[#0d0f14] border-zinc-800 text-zinc-400 hover:text-zinc-100'
              }`}
            >
              All
            </button>
            {ACHIEVEMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setAchCategory(cat.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  achCategory === cat.id
                    ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                    : 'bg-[#0d0f14] border-zinc-800 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredAchievements.map((ach) => {
              const progress = Math.min(
                ach.target,
                getAchievementProgress(ach, achievementContext),
              );
              const claimed = claimedAchievements.includes(ach.id);
              const ready = !claimed && progress >= ach.target;
              const pct = Math.min(100, Math.round((progress / Math.max(1, ach.target)) * 100));

              return (
                <div
                  key={ach.id}
                  className={`rounded-xl border p-3 space-y-2 ${
                    ready
                      ? 'bg-[#1a1812] border-amber-600/60'
                      : claimed
                        ? 'bg-[#0d0f14] border-emerald-800/40 opacity-75'
                        : 'bg-[#12151b] border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400/80">
                        {ach.category}
                      </div>
                      <h4 className="text-sm font-bold text-zinc-100 leading-tight">{ach.title}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">{ach.description}</p>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-zinc-200 shrink-0">
                      {formatCompactNumber(progress)} / {formatCompactNumber(ach.target)}
                    </span>
                  </div>

                  <div className="h-1.5 rounded-sm bg-[#090a0d] overflow-hidden border border-zinc-800">
                    <div
                      className={`h-full transition-all ${
                        claimed
                          ? 'bg-emerald-500'
                          : ready
                            ? 'bg-amber-500'
                            : 'bg-zinc-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <RewardSummaryStrip rewards={ach.rewards} />
                    {claimed ? (
                      <span className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-bold inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => onClaimAchievement(ach.id)}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
                          ready
                            ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500 text-zinc-950'
                            : 'bg-[#0d0f14] border border-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {ready ? 'Claim' : `${pct}%`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: TANK PROGRESSION MILESTONES */}
      {subTab === 'milestones' && (
        <div className="space-y-2.5">
          <div className="rounded-xl bg-[#12151b] border border-zinc-800 p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Tank Level Milestones
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Earn permanent supply chests, Auto Forge, and Apex Tank styling as your tank levels up.
              </p>
            </div>
            <span className="font-mono-num text-sm font-bold text-amber-400 shrink-0">
              Lv. {tankLevel}
            </span>
          </div>

          {/* Lv. 50 Special Tank Visual Customization Toggle */}
          <div
            className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
              tankLevel >= 50
                ? 'bg-[#1a1812] border-amber-600/50'
                : 'bg-[#0d0f14] border-zinc-800'
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Apex Vanguard Tank Customization (Lv. 50)</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {tankLevel >= 50
                  ? 'Obsidian reactive side skirts, brushed gold trim, and heavy command chassis.'
                  : `Reach Tank Level 50 (${Math.max(0, 50 - tankLevel)} levels away) to unlock.`}
              </p>
            </div>

            {tankLevel >= 50 ? (
              <button
                type="button"
                onClick={onToggleApexSkin}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 transition-colors ${
                  apexSkinEnabled
                    ? 'bg-amber-600 text-zinc-950 border-amber-500'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                {apexSkinEnabled ? 'Skin Active' : 'Enable Skin'}
              </button>
            ) : (
              <span className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#12151b] border border-zinc-800 text-zinc-500 text-xs font-semibold inline-flex items-center gap-1 shrink-0">
                <Lock className="w-3.5 h-3.5" />
                Lv. 50
              </span>
            )}
          </div>

          <div className="space-y-2">
            {TANK_MILESTONES.map((ms) => {
              const unlocked = tankLevel >= ms.level;
              const claimed = claimedMilestones.includes(ms.level);
              const ready = unlocked && !claimed;

              return (
                <div
                  key={ms.level}
                  className={`rounded-xl border p-3 space-y-2 ${
                    ready
                      ? 'bg-[#151b18] border-emerald-700/60'
                      : claimed
                        ? 'bg-[#0d0f14] border-emerald-800/40 opacity-75'
                        : 'bg-[#12151b] border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200">
                          LV. {ms.level}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-100">{ms.title}</h4>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{ms.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <RewardSummaryStrip rewards={ms.rewards} />
                    {claimed ? (
                      <span className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-bold inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Claimed
                      </span>
                    ) : ready ? (
                      <button
                        type="button"
                        onClick={() => onClaimMilestone(ms.level)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-zinc-950 text-xs font-bold active:scale-95 transition-colors"
                      >
                        Claim Milestone
                      </button>
                    ) : (
                      <span className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#0d0f14] border border-zinc-800 text-zinc-500 text-xs font-semibold inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Lv. {ms.level}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
