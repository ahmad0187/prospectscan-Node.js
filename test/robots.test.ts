import { describe, expect, it } from 'vitest';
import { isDisallowed } from '../src/audit/robots.js';

describe('robots.txt', () => {
  it('blocks everything for Disallow: /', () => {
    expect(isDisallowed('User-agent: *\nDisallow: /', '/')).toBe(true);
  });
  it('allows when empty or no matching group', () => {
    expect(isDisallowed('', '/')).toBe(false);
    expect(isDisallowed('User-agent: Googlebot\nDisallow: /', '/')).toBe(false);
  });
  it('uses the most specific rule (Allow can override)', () => {
    const txt = 'User-agent: *\nDisallow: /private\nAllow: /private/public';
    expect(isDisallowed(txt, '/private/x')).toBe(true);
    expect(isDisallowed(txt, '/private/public/page')).toBe(false);
    expect(isDisallowed(txt, '/about')).toBe(false);
  });
  it('prefers a group naming our bot over *', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: ProspectScanBot\nDisallow: /admin';
    expect(isDisallowed(txt, '/')).toBe(false);
    expect(isDisallowed(txt, '/admin/x')).toBe(true);
  });
  it('supports * and $ patterns', () => {
    const txt = 'User-agent: *\nDisallow: /*.pdf$';
    expect(isDisallowed(txt, '/files/menu.pdf')).toBe(true);
    expect(isDisallowed(txt, '/files/menu.pdf?x=1')).toBe(false);
  });
});
