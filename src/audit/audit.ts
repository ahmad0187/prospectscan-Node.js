import type { AuditResult } from '../types.js';
import { grade, runChecks, score } from './checks.js';
import { FetchError, fetchPage, linkStatus } from './fetchPage.js';
import { businessName, parsePage } from './parse.js';
import { assertPublicHost } from './netguard.js';
import { fetchRobots, isDisallowed } from './robots.js';

export interface AuditOptions {
  /** How many internal links to test for 404s (0 to skip). */
  linkSample?: number;
  timeoutMs?: number;
  /** Pause between requests to the same site, to stay polite. */
  delayMs?: number;
  now?: Date;
  /** Allow localhost / private IPs (for local testing). Off by default to prevent SSRF. */
  allowPrivateNetworks?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme); // throws on garbage, which callers report per-URL
  url.hash = '';
  return url.toString();
}

export async function auditSite(input: string, opts: AuditOptions = {}): Promise<AuditResult> {
  const { linkSample = 12, timeoutMs = 15000, delayMs = 150, now = new Date() } = opts;
  const started = Date.now();
  const base = (url: string): AuditResult => ({
    url, ok: false, business: null, score: 0, grade: 'cool', findings: [], emails: [], phones: [],
    facts: null, brokenLinks: [], auditedAt: now.toISOString(), durationMs: 0,
  });

  let url: string;
  try {
    url = normalizeUrl(input);
  } catch {
    return { ...base(input), skippedReason: 'Not a valid URL' };
  }

  if (!opts.allowPrivateNetworks) {
    try {
      await assertPublicHost(url);
    } catch (err) {
      const msg = (err as NodeJS.ErrnoException).code === 'ENOTFOUND' ? 'Domain not found' : (err as Error).message;
      return { ...base(url), skippedReason: msg, durationMs: Date.now() - started };
    }
  }

  const origin = new URL(url).origin;
  const robots = await fetchRobots(origin);
  if (isDisallowed(robots, new URL(url).pathname)) {
    return { ...base(url), skippedReason: 'robots.txt asks bots not to crawl this site', durationMs: Date.now() - started };
  }

  let home;
  try {
    home = await fetchPage(url, timeoutMs);
  } catch (err) {
    const reason = err instanceof FetchError ? err.message : 'Could not load the site';
    return { ...base(url), skippedReason: reason, durationMs: Date.now() - started };
  }

  const facts = parsePage(home);
  const business = businessName(home.html);

  // The contact page often holds the email address, the phone link and the form.
  if (facts.contactPageUrl && facts.contactPageUrl !== facts.finalUrl && !isDisallowed(robots, new URL(facts.contactPageUrl).pathname)) {
    await sleep(delayMs);
    try {
      const contact = parsePage(await fetchPage(facts.contactPageUrl, timeoutMs));
      facts.emails = [...new Set([...facts.emails, ...contact.emails])];
      facts.phones = [...new Set([...facts.phones, ...contact.phones])];
      facts.hasForm ||= contact.hasForm;
      facts.hasTelLink ||= contact.hasTelLink;
      facts.tech.booking = [...new Set([...facts.tech.booking, ...contact.tech.booking])];
      facts.tech.chat = [...new Set([...facts.tech.chat, ...contact.tech.chat])];
    } catch {
      /* a broken contact page is reported by the link check */
    }
  }

  const brokenLinks: string[] = [];
  if (home.status < 400) {
    const sample = facts.internalLinks.filter((l) => l !== facts.finalUrl && !isDisallowed(robots, new URL(l).pathname)).slice(0, linkSample);
    for (const link of sample) {
      await sleep(delayMs);
      const status = await linkStatus(link, Math.min(timeoutMs, 8000));
      if (status === 0 || status >= 400) brokenLinks.push(link);
    }
  }

  const findings = runChecks(facts, brokenLinks, now).sort((a, b) => b.points - a.points);
  const s = score(findings);
  return {
    url, ok: true, business, score: s, grade: grade(s), findings,
    emails: facts.emails, phones: facts.phones, facts, brokenLinks,
    auditedAt: now.toISOString(), durationMs: Date.now() - started,
  };
}
