export const UTILITY_TYPE = { water: 0, electricity: 1 } as const;

export function utilityName(type: number): string {
  return type === UTILITY_TYPE.electricity ? '电费' : '水费';
}

/** Legacy fee rules did not have a category; recognize their common names safely. */
export function isUtilityFeeName(name: string): boolean {
  const normalized = String(name || '').replace(/\s/g, '');
  return normalized === '水费' || normalized === '电费' || normalized === '水电费' || normalized === '水电';
}

export function utilityTypesForFeeRules(
  rules: Array<{ name?: string; type?: number | string; enabled?: number | boolean }> | null | undefined,
): number[] {
  const result = new Set<number>();
  for (const rule of rules || []) {
    const enabled = rule.enabled !== 0 && rule.enabled !== false;
    const manual = rule.type === 1 || rule.type === 'manual';
    if (!enabled || !manual) continue;
    const name = String(rule.name || '').replace(/\s/g, '');
    if (name === '水费') result.add(UTILITY_TYPE.water);
    if (name === '电费') result.add(UTILITY_TYPE.electricity);
    if (name === '水电费' || name === '水电') {
      result.add(UTILITY_TYPE.water);
      result.add(UTILITY_TYPE.electricity);
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function toCentsAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toFourDecimal(value: number): number {
  return Math.round(value * 10000) / 10000;
}
