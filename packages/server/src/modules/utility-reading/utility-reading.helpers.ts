export const UTILITY_TYPE = { water: 0, electricity: 1 } as const;

export function utilityName(type: number): string {
  return type === UTILITY_TYPE.electricity ? '电费' : '水费';
}

/** Legacy fee rules did not have a category; recognize their common names safely. */
export function isUtilityFeeName(name: string): boolean {
  const normalized = String(name || '').replace(/\s/g, '');
  return normalized === '水费' || normalized === '电费' || normalized === '水电费' || normalized === '水电';
}

export function toCentsAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toFourDecimal(value: number): number {
  return Math.round(value * 10000) / 10000;
}
