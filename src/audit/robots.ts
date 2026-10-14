import { USER_AGENT } from './fetchPage.js';

/**
 * Minimal robots.txt check: is `path` disallowed for our bot (or for `*`)?
 * Supports User-agent groups, Disallow/Allow prefixes (longest match wins) and `*` / `$` patterns.
 */
export function isDisallowed(robotsTxt: string, path: string, agent = 'ProspectScanBot'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'disallow' || key === 'allow') && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: key === 'allow', pattern: value });
    } else {
      lastWasAgent = false;
    }
  }

  const name = agent.toLowerCase();
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && name.includes(a))) ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return false;

  let best: { allow: boolean; len: number } | null = null;
  for (const rule of group.rules) {
    if (matches(rule.pattern, path) && (!best || rule.pattern.length > best.len || (rule.pattern.length === best.len && rule.allow))) {
      best = { allow: rule.allow, len: rule.pattern.length };
    }
  }
  return best ? !best.allow : false;
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(path);
}

export async function fetchRobots(origin: string): Promise<string> {
  try {
    const res = await fetch(new URL('/robots.txt', origin), { signal: AbortSignal.timeout(6000), headers: { 'user-agent': USER_AGENT } });
    return res.ok ? (await res.text()).slice(0, 100_000) : '';
  } catch {
    return '';
  }
}
