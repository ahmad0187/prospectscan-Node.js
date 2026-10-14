import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditSite, normalizeUrl } from '../src/audit/audit.js';
import { templateEmail } from '../src/outreach/email.js';
import type { AuditResult } from '../src/types.js';
import { startFixtureSites } from './fixtures.js';

let sites: Awaited<ReturnType<typeof startFixtureSites>>;
const results: Record<string, AuditResult> = {};
const opts = { allowPrivateNetworks: true, delayMs: 0, now: new Date('2026-10-14T00:00:00Z') };

beforeAll(async () => {
  sites = await startFixtureSites();
  await Promise.all(Object.entries(sites.urls).map(async ([name, url]) => { results[name] = await auditSite(url, opts); }));
});
afterAll(() => sites.close());

describe('auditSite (against local fixture websites)', () => {
  it('outdated plumber site is a hot prospect with specific findings', () => {
    const r = results['oakridge-plumbing'];
    expect(r.ok).toBe(true);
    expect(r.business).toBe('Oakridge Plumbing & Heating');
    expect(r.grade).toBe('hot');
    const ids = r.findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['slow', 'not_mobile', 'outdated', 'no_tap_to_call', 'no_booking', 'no_form', 'broken_links', 'missing_alt']));
    expect(r.brokenLinks.map((u) => new URL(u).pathname).sort()).toEqual(['/about.html', '/services/boilers.html']);
    expect(r.emails).toEqual(['office@oakridgeplumbing.example']);
    expect(r.phones).toContain('(555) 201-7744');
    expect(r.findings[0].points).toBeGreaterThanOrEqual(r.findings.at(-1)!.points); // sorted by impact
  });

  it('yoga studio is warm: decent site, but no booking or chat', () => {
    const r = results['harbor-yoga'];
    expect(r.grade).toBe('warm');
    const ids = r.findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['no_booking', 'no_chat']));
    expect(ids).not.toContain('not_mobile');
    expect(ids).not.toContain('no_form');            // form found on the contact page
    expect(r.emails).toContain('hello@harboryoga.example');
  });

  it('modern dental site is cool and detects booking/chat/analytics', () => {
    const r = results['bright-smile-dental'];
    expect(r.grade).toBe('cool');
    expect(r.facts?.tech.booking).toContain('Calendly');
    expect(r.facts?.tech.chat).toContain('Tidio');
    expect(r.facts?.tech.analytics).toContain('Google Analytics');
    expect(r.facts?.hasLocalBusinessSchema).toBe(true);
  });

  it('respects robots.txt', () => {
    const r = results['sunset-bistro'];
    expect(r.ok).toBe(false);
    expect(r.skippedReason).toMatch(/robots\.txt/);
  });

  it('blocks private addresses unless explicitly allowed', async () => {
    const r = await auditSite(sites.urls['harbor-yoga']);
    expect(r.ok).toBe(false);
    expect(r.skippedReason).toMatch(/not allowed/);
  });

  it('reports unreachable sites instead of throwing', async () => {
    const r = await auditSite('http://127.0.0.1:9/', { ...opts, timeoutMs: 2000 });
    expect(r.ok).toBe(false);
    expect(r.skippedReason).toBeTruthy();
  });

  it('template email is specific and includes an opt-out', () => {
    const email = templateEmail(results['oakridge-plumbing'], { senderName: 'Ahmad', offer: 'I rebuild small-business sites in a week' });
    expect(email.subject).toMatch(/Oakridge Plumbing & Heating/);
    expect(email.body).toMatch(/seconds to load/);
    expect(email.body).toMatch(/pinch and zoom/);
    expect(email.body).toMatch(/reply "no"/);
    expect(email.writer).toBe('template');
  });
});

describe('normalizeUrl', () => {
  it('adds https and strips fragments', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('http://example.com/a#x')).toBe('http://example.com/a');
  });
  it('throws on garbage', () => {
    expect(() => normalizeUrl('not a url')).toThrow();
  });
});
