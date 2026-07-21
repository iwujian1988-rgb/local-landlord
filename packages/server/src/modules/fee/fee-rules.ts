import { BadRequestException } from '@nestjs/common';
import { FeeItem } from './fee-item.entity';

export type FeeRuleType = 0 | 1;
export type FeeCycleMode = 'rent' | 'monthly';

export interface FeeRule {
  name: string;
  type: FeeRuleType;
  amount: number;
  enabled: number;
  isRent: number;
  cycleMode: FeeCycleMode;
  sortOrder: number;
}

export function normalizeFeeRules(input: unknown): FeeRule[] {
  if (!Array.isArray(input)) {
    throw new BadRequestException('收费项目格式不正确');
  }
  if (input.length === 0) throw new BadRequestException('请至少保留一个收费项目');
  if (input.length > 50) throw new BadRequestException('收费项目不能超过50个');

  let rentCount = 0;
  const names = new Set<string>();
  const rules = input.map((raw: any, index) => {
    const name = String(raw?.name || '').trim();
    if (!name) throw new BadRequestException(`第${index + 1}个收费项目名称不能为空`);
    if (name.length > 32) throw new BadRequestException(`第${index + 1}个收费项目名称不能超过32个字`);
    if (names.has(name)) throw new BadRequestException(`收费项目“${name}”重复`);
    names.add(name);

    if (!['fixed', 'manual', 0, 1].includes(raw?.type)) {
      throw new BadRequestException(`第${index + 1}个收费项目类型不正确`);
    }
    if (raw?.enabled !== undefined && ![true, false, 0, 1].includes(raw.enabled)) {
      throw new BadRequestException(`第${index + 1}个收费项目启用状态不正确`);
    }
    if (raw?.isRent !== undefined && ![true, false, 0, 1].includes(raw.isRent)) {
      throw new BadRequestException(`第${index + 1}个收费项目房租标记不正确`);
    }
    if (raw?.cycleMode !== undefined && !['rent', 'monthly'].includes(raw.cycleMode)) {
      throw new BadRequestException(`第${index + 1}个收费项目收取周期不正确`);
    }

    const type: FeeRuleType = raw.type === 'manual' || raw.type === 1 ? 1 : 0;
    const amount = type === 1 ? 0 : Number(raw?.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99) {
      throw new BadRequestException(`第${index + 1}个收费项目金额不正确`);
    }
    const normalizedAmount = Math.round(amount * 100) / 100;
    if (Math.abs(amount - normalizedAmount) > Number.EPSILON * Math.max(1, Math.abs(amount))) {
      throw new BadRequestException(`第${index + 1}个收费项目金额最多保留2位小数`);
    }
    const isRent = raw?.isRent === true || raw?.isRent === 1 ? 1 : 0;
    if (isRent) rentCount += 1;
    if (rentCount > 1) throw new BadRequestException('只能设置一个房租项目');

    return {
      name,
      type: isRent ? 0 : type,
      amount: normalizedAmount,
      enabled: isRent ? 1 : (raw?.enabled === false || raw?.enabled === 0 ? 0 : 1),
      isRent,
      cycleMode: isRent ? 'rent' : (raw?.cycleMode === 'monthly' ? 'monthly' : 'rent'),
      sortOrder: index,
    } as FeeRule;
  });
  if (!rules.some(rule => rule.enabled)) throw new BadRequestException('请至少启用一个收费项目');
  if (!rules.some(rule => rule.isRent)) throw new BadRequestException('收费项目必须包含房租');
  return rules;
}

export function feeEntitiesToRules(items: FeeItem[]): FeeRule[] {
  return items.map((item, index) => ({
    name: item.name,
    type: item.type === 1 ? 1 : 0,
    amount: Number(item.amount) || 0,
    enabled: item.enabled ? 1 : 0,
    isRent: item.isRent ? 1 : 0,
    cycleMode: item.cycleMode === 'monthly' ? 'monthly' : 'rent',
    sortOrder: item.sortOrder ?? index,
  }));
}

export function defaultRentRule(rent: number): FeeRule {
  return {
    name: '房租',
    type: 0,
    amount: Number(rent) || 0,
    enabled: 1,
    isRent: 1,
    cycleMode: 'rent',
    sortOrder: 0,
  };
}

export function resolveFeeRules(
  tenantRules: FeeRule[] | null | undefined,
  legacyItems: FeeItem[],
  rent: number,
): FeeRule[] {
  if (Array.isArray(tenantRules)) {
    return tenantRules.some(rule => rule.isRent)
      ? tenantRules
      : [defaultRentRule(rent), ...tenantRules.map((rule, index) => ({ ...rule, sortOrder: index + 1 }))];
  }
  const legacyRules = feeEntitiesToRules(legacyItems);
  if (legacyRules.length === 0) return [defaultRentRule(rent)];
  return legacyRules.some(rule => rule.isRent || rule.name === '房租')
    ? legacyRules
    : [defaultRentRule(rent), ...legacyRules.map((rule, index) => ({ ...rule, sortOrder: index + 1 }))];
}

export function feeRuleCycleAmount(rule: FeeRule, payMonths: number): number {
  if (!rule.enabled || rule.type === 1) return 0;
  return Math.round(rule.amount * (rule.cycleMode === 'monthly' ? 1 : Math.max(1, payMonths)) * 100) / 100;
}

export function feeRulesToResponse(rules: FeeRule[]) {
  return [...rules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(rule => ({
      name: rule.name,
      type: rule.type === 1 ? 'manual' : 'fixed',
      amount: Number(rule.amount) || 0,
      enabled: !!rule.enabled,
      isRent: !!rule.isRent,
      cycleMode: rule.cycleMode === 'monthly' ? 'monthly' : 'rent',
    }));
}
