import { DEFAULT_CHEST_INVENTORY } from './config';
import type { ChestInventory, ChestTierId, CurrencyType, Wallet } from './types';

export function createInitialWallet(): Wallet {
  return {
    scrap: 60,
    forgeCores: 6, // Starter cores so player can inspect/try forging early, then farm Salvage Yard
    skillTech: 15,
    alloyPlates: 4,
  };
}

export function createInitialChests(): ChestInventory {
  return { ...DEFAULT_CHEST_INVENTORY };
}

export function getCurrencyBalance(wallet: Wallet, currency: CurrencyType): number {
  return Math.max(0, Math.floor(wallet[currency] ?? 0));
}

export function canAfford(wallet: Wallet, currency: CurrencyType, cost: number): boolean {
  if (cost <= 0) return true;
  return getCurrencyBalance(wallet, currency) >= Math.ceil(cost);
}

export function canAffordAll(
  wallet: Wallet,
  costs: Partial<Record<CurrencyType, number>>,
): boolean {
  for (const key of Object.keys(costs) as CurrencyType[]) {
    const req = costs[key] ?? 0;
    if (!canAfford(wallet, key, req)) {
      return false;
    }
  }
  return true;
}

export function addCurrency(wallet: Wallet, currency: CurrencyType, amount: number): Wallet {
  if (!Number.isFinite(amount) || amount <= 0) return wallet;
  return {
    ...wallet,
    [currency]: Math.floor((wallet[currency] ?? 0) + amount),
  };
}

export function addCurrencies(
  wallet: Wallet,
  grants: Partial<Record<CurrencyType, number>>,
): Wallet {
  let next = wallet;
  for (const key of Object.keys(grants) as CurrencyType[]) {
    const amt = grants[key] ?? 0;
    if (amt > 0) {
      next = addCurrency(next, key, amt);
    }
  }
  return next;
}

export function spendCurrency(
  wallet: Wallet,
  currency: CurrencyType,
  cost: number,
): { wallet: Wallet; success: boolean } {
  if (cost <= 0) return { wallet, success: true };
  const roundedCost = Math.ceil(cost);
  if (!canAfford(wallet, currency, roundedCost)) {
    return { wallet, success: false };
  }
  return {
    wallet: {
      ...wallet,
      [currency]: Math.max(0, Math.floor((wallet[currency] ?? 0) - roundedCost)),
    },
    success: true,
  };
}

export function spendCurrencies(
  wallet: Wallet,
  costs: Partial<Record<CurrencyType, number>>,
): { wallet: Wallet; success: boolean } {
  if (!canAffordAll(wallet, costs)) {
    return { wallet, success: false };
  }
  let next = { ...wallet };
  for (const key of Object.keys(costs) as CurrencyType[]) {
    const req = Math.ceil(costs[key] ?? 0);
    if (req > 0) {
      next[key] = Math.max(0, Math.floor((next[key] ?? 0) - req));
    }
  }
  return { wallet: next, success: true };
}

export function addChest(
  chests: ChestInventory,
  tier: ChestTierId,
  amount = 1,
): ChestInventory {
  if (amount <= 0) return chests;
  return {
    ...chests,
    [tier]: Math.max(0, Math.floor((chests[tier] ?? 0) + amount)),
  };
}

export function consumeChest(
  chests: ChestInventory,
  tier: ChestTierId,
): { chests: ChestInventory; success: boolean } {
  if ((chests[tier] ?? 0) < 1) {
    return { chests, success: false };
  }
  return {
    chests: {
      ...chests,
      [tier]: Math.max(0, chests[tier] - 1),
    },
    success: true,
  };
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Math.floor(value).toLocaleString('en-US');
}
