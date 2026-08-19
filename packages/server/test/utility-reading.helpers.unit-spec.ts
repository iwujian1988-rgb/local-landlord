import { utilityTypesForFeeRules } from '../src/modules/utility-reading/utility-reading.helpers';

describe('utilityTypesForFeeRules', () => {
  it.each([
    [[], []],
    [[{ name: '物业费', type: 0, enabled: 1 }], []],
    [[{ name: '水费', type: 1, enabled: 1 }], [0]],
    [[{ name: '电费', type: 'manual', enabled: true }], [1]],
    [[{ name: '水电费', type: 1, enabled: 1 }], [0, 1]],
    [[{ name: '水电', type: 1, enabled: 1 }], [0, 1]],
    [[{ name: '水电费', type: 0, enabled: 1 }], []],
    [[{ name: '水电费', type: 1, enabled: 0 }], []],
  ])('maps fee rules to allowed utility types', (rules, expected) => {
    expect(utilityTypesForFeeRules(rules)).toEqual(expected);
  });
});
