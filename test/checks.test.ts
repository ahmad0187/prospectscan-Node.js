import { describe, expect, it } from 'vitest';
import { grade, runChecks, score } from '../src/audit/checks.js';
import type { PageFacts } from '../src/types.js';

const NOW = new Date('2026-10-14T00:00:00Z');
const perfect: PageFacts = {
  url: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, loadMs: 400, bytes: 30000,
  title: 'Example Dental | Family dentist', metaDescription: 'Gentle dentistry.', h1Count: 1, hasViewport: true,
  imagesTotal: 4, imagesMissingAlt: 0, scripts: 6, hasTelLink: true, hasForm: true, hasPrivacyLink: true,
  hasOpenGraph: true, hasLocalBusinessSchema: true, copyrightYear: 2026, emails: ['hi@example.com'], phones: ['+15550000000'],
  socials: [], internalLinks: [], contactPageUrl: null,
  tech: { platform: 'WordPress', booking: ['Calendly'], chat: ['Tidio'], analytics: ['Google Analytics'] },
};
const ids = (f: Partial<PageFacts>, broken: string[] = []) => runChecks({ ...perfect, ...f }, broken, NOW).map((x) => x.id);

describe('checks', () => {
  it('a well-built site has no findings and a cool grade', () => {
    const findings = runChecks(perfect, [], NOW);
    expect(findings).toEqual([]);
    expect(grade(score(findings))).toBe('cool');
  });

  it('flags the classic small-business gaps', () => {
    const found = ids({
      hasViewport: false, loadMs: 4200, metaDescription: null, hasTelLink: false, copyrightYear: 2019,
      tech: { platform: null, booking: [], chat: [], analytics: [] },
    }, ['https://example.com/old']);
    expect(found).toEqual(expect.arrayContaining(['not_mobile', 'slow', 'no_meta_description', 'no_tap_to_call', 'outdated', 'no_booking', 'no_chat', 'no_analytics', 'broken_links']));
  });

  it('an error status short-circuits with a critical finding', () => {
    const f = runChecks({ ...perfect, status: 500 }, [], NOW);
    expect(f.map((x) => x.id)).toEqual(['http_error']);
    expect(f[0].severity).toBe('critical');
  });

  it('only flags HTTPS on public hosts', () => {
    expect(ids({ finalUrl: 'http://example.com/' })).toContain('no_https');
    expect(ids({ finalUrl: 'http://127.0.0.1:3000/' })).not.toContain('no_https');
  });

  it('treats last year copyright as current enough', () => {
    expect(ids({ copyrightYear: 2025 })).not.toContain('outdated');
    expect(ids({ copyrightYear: 2024 })).toContain('outdated');
  });

  it('caps the score at 100 and grades it', () => {
    expect(score([{ id: 'a', category: 'speed', severity: 'high', title: '', detail: '', points: 80 }, { id: 'b', category: 'speed', severity: 'high', title: '', detail: '', points: 50 }])).toBe(100);
    expect([grade(60), grade(59), grade(35), grade(34)]).toEqual(['hot', 'warm', 'warm', 'cool']);
  });
});
