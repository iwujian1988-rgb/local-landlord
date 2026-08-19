import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('contracts page layout regressions', () => {
  const pageSource = readFileSync(
    resolve(__dirname, '../src/pages/contracts/index.tsx'),
    'utf8',
  );
  const pageStyles = readFileSync(
    resolve(__dirname, '../src/pages/contracts/index.scss'),
    'utf8',
  );

  it('TC-CONTRACTS-PAGE-001: category filters use a dedicated horizontal track', () => {
    expect(pageSource).toContain('className="contracts-filter-track"');
    expect(pageSource).toContain('className={`contracts-filter-tab');
    expect(pageStyles).toContain('.contracts-filter-track');
    expect(pageStyles).toContain('display: inline-flex');
    expect(pageStyles).toContain('min-width: max-content');
  });

  it('TC-CONTRACTS-PAGE-002: category filters do not reuse the global filter-tab class', () => {
    expect(pageSource).not.toContain('className={`filter-tab');
    expect(pageStyles).not.toMatch(/(^|\n)\.filter-tab[\s.{:]/);
  });
});
