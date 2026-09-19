import { rentSection } from '../src/utils/rent-load';

describe('rent partial loading', () => {
  it('an unavailable supplementary route does not reject the main data load', async () => {
    const [core, debts] = await Promise.all([
      Promise.resolve({ amount: 2800 }),
      rentSection(Promise.reject(new Error('Cannot GET /api/rent/departed-debts'))),
    ]);
    expect(core.amount).toBe(2800);
    expect(debts.data).toBeNull();
    expect(debts.error).toContain('departed-debts');
  });
  it('distinguishes a confirmed empty result from failure', async () => {
    expect(await rentSection(Promise.resolve({data: []}))).toEqual({data: [], error: ''});
  });
  it('preserves the returned debt amounts', async () => {
    expect((await rentSection(Promise.resolve({data: [{remainingAmount: 300}]}))).data).toEqual([{remainingAmount: 300}]);
  });
});
