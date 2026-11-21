import React from 'react';
import { Box, Cog, Crosshair, Eye, Gauge, Shield } from 'lucide-react';
import type { EquipmentItem, EquipmentSlot } from '../game/types';

export const SLOT_ICONS: Record<EquipmentSlot, React.ComponentType<{ className?: string }>> = {
  cannon: Crosshair,
  turret: Cog,
  hull: Box,
  armor: Shield,
  optics: Eye,
  treads: Gauge,
};

export function formatEquipmentBonuses(item: EquipmentItem): string[] {
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
