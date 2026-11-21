import React from 'react';
import {
  Bomb,
  Crosshair,
  Flame,
  Gauge,
  HeartPulse,
  Radio,
  Rocket,
  Zap,
} from 'lucide-react';
import { SKILL_DEFINITIONS } from '../game/config';
import type { SkillId } from '../game/types';

interface SkillIconProps {
  skillId: SkillId;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  locked?: boolean;
}

const ICON_MAP: Record<SkillId, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  missile_barrage: Rocket,
  artillery_strike: Crosshair,
  mine_deployment: Bomb,
  railgun_shot: Zap,
  repair_drone: HeartPulse,
  emp_pulse: Radio,
  overdrive: Gauge,
  rocket_salvo: Flame,
};

const SIZE_CLASSES: Record<NonNullable<SkillIconProps['size']>, { box: string; icon: string }> = {
  xs: { box: 'w-6 h-6 rounded-md', icon: 'w-3.5 h-3.5' },
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5' },
  lg: { box: 'w-14 h-14 rounded-2xl', icon: 'w-7 h-7' },
};

export const SkillIcon: React.FC<SkillIconProps> = ({
  skillId,
  size = 'md',
  locked = false,
}) => {
  const Icon = ICON_MAP[skillId];
  const def = SKILL_DEFINITIONS[skillId];
  const dims = SIZE_CLASSES[size];

  return (
    <div
      className={`${dims.box} flex items-center justify-center shrink-0 border transition-colors`}
      style={{
        borderColor: locked ? '#27272a' : `${def.accentColor}66`,
        backgroundColor: locked ? '#0d0f14' : '#14171d',
      }}
    >
      <Icon
        className={dims.icon}
        style={{ color: locked ? '#52525b' : def.accentColor }}
      />
    </div>
  );
};
