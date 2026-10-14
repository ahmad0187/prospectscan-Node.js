import type { Finding, Grade, PageFacts } from '../types.js';

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/;

/**
 * Turns page facts into findings. Each finding carries points: the bigger the gap,
 * the bigger the sales opportunity. `now` is injectable so tests are deterministic.
 */
export function runChecks(f: PageFacts, brokenLinks: string[] = [], now = new Date()): Finding[] {
  const out: Finding[] = [];
  const add = (x: Finding) => out.push(x);

  if (f.status >= 400) {
    add({ id: 'http_error', category: 'availability', severity: 'critical', points: 60,
      title: `Home page returns HTTP ${f.status}`, detail: 'Visitors see an error instead of the website.',
      pitch: `your website is currently returning an error (HTTP ${f.status}), so visitors can't see it at all` });
    return out;
  }

  const url = new URL(f.finalUrl);
  if (url.protocol !== 'https:' && !LOCAL_HOST.test(url.hostname)) {
    add({ id: 'no_https', category: 'trust', severity: 'high', points: 15,
      title: 'No HTTPS', detail: 'Browsers mark the site "Not secure", and Google ranks it lower.',
      pitch: 'browsers show a "Not secure" warning on your site because it has no HTTPS' });
  }

  if (f.loadMs > 3000) {
    add({ id: 'slow', category: 'speed', severity: 'high', points: 15,
      title: `Slow to load (${(f.loadMs / 1000).toFixed(1)}s)`, detail: 'Over half of mobile visitors leave if a page takes more than 3 seconds.',
      pitch: `your home page took ${(f.loadMs / 1000).toFixed(1)} seconds to load when I checked, which is long enough for most mobile visitors to give up` });
  } else if (f.loadMs > 1500) {
    add({ id: 'sluggish', category: 'speed', severity: 'medium', points: 8,
      title: `Could be faster (${(f.loadMs / 1000).toFixed(1)}s)`, detail: 'Aim for under 1.5 seconds for the HTML.',
      pitch: `your home page takes ${(f.loadMs / 1000).toFixed(1)} seconds to load` });
  }
  if (f.scripts > 25) {
    add({ id: 'script_bloat', category: 'speed', severity: 'medium', points: 5,
      title: `${f.scripts} external scripts`, detail: 'Every script slows the page down; many are usually unused.' });
  }

  if (!f.hasViewport) {
    add({ id: 'not_mobile', category: 'mobile', severity: 'high', points: 18,
      title: 'Not mobile-friendly', detail: 'No viewport meta tag: on phones the page shows as a tiny desktop page.',
      pitch: "on a phone your site shows up as a shrunken desktop page, so people have to pinch and zoom to read it" });
  }

  if (!f.title) {
    add({ id: 'no_title', category: 'seo', severity: 'medium', points: 6, title: 'Missing page title', detail: 'Google shows the URL instead of your name.' });
  }
  if (!f.metaDescription) {
    add({ id: 'no_meta_description', category: 'seo', severity: 'medium', points: 6,
      title: 'No meta description', detail: 'Google writes its own snippet, often from random page text.',
      pitch: "your Google listing has no description, so Google fills it with random text from the page" });
  }
  if (f.h1Count === 0) {
    add({ id: 'no_h1', category: 'seo', severity: 'low', points: 4, title: 'No main heading (H1)', detail: 'Search engines use the H1 to understand what the page is about.' });
  }
  if (f.imagesTotal >= 3 && f.imagesMissingAlt / f.imagesTotal > 0.3) {
    add({ id: 'missing_alt', category: 'seo', severity: 'low', points: 4,
      title: `${f.imagesMissingAlt} of ${f.imagesTotal} images have no alt text`, detail: 'Hurts accessibility and image search.' });
  }
  if (!f.hasLocalBusinessSchema) {
    add({ id: 'no_schema', category: 'seo', severity: 'low', points: 3, title: 'No LocalBusiness structured data', detail: 'Helps Google show hours, reviews and location in results.' });
  }
  if (!f.hasOpenGraph) {
    add({ id: 'no_og', category: 'seo', severity: 'low', points: 2, title: 'No social sharing tags', detail: 'Links shared on Facebook/WhatsApp show no image or summary.' });
  }

  if (f.tech.booking.length === 0) {
    add({ id: 'no_booking', category: 'conversion', severity: 'high', points: 14,
      title: 'No online booking', detail: 'Customers have to call during opening hours to book.',
      pitch: "there's no way to book online, so anyone visiting in the evening has to wait and call during opening hours" });
  }
  if (f.tech.chat.length === 0) {
    add({ id: 'no_chat', category: 'conversion', severity: 'medium', points: 8,
      title: 'No live chat or AI assistant', detail: 'Questions asked after hours go unanswered.',
      pitch: "visitors with a quick question have no way to get an answer outside office hours" });
  }
  if (!f.hasTelLink) {
    add({ id: 'no_tap_to_call', category: 'conversion', severity: 'medium', points: 8,
      title: 'Phone number is not tap-to-call', detail: 'On mobile, visitors must copy the number by hand.',
      pitch: "on a phone your number isn't tap-to-call, so people have to copy it by hand" });
  }
  if (!f.hasForm) {
    add({ id: 'no_form', category: 'conversion', severity: 'medium', points: 6, title: 'No contact form', detail: 'Visitors who prefer not to call have no easy way to reach you.' });
  }
  if (f.emails.length === 0) {
    add({ id: 'no_email', category: 'conversion', severity: 'low', points: 2, title: 'No email address on the site', detail: 'Some customers prefer email.' });
  }
  if (f.tech.analytics.length === 0) {
    add({ id: 'no_analytics', category: 'conversion', severity: 'low', points: 4,
      title: 'No analytics', detail: "There's no way to see how many visitors arrive or where they come from." });
  }

  if (f.copyrightYear && f.copyrightYear <= now.getFullYear() - 2) {
    add({ id: 'outdated', category: 'freshness', severity: 'medium', points: 8,
      title: `Looks outdated (© ${f.copyrightYear})`, detail: 'An old copyright year makes visitors wonder if the business is still open.',
      pitch: `the footer still says © ${f.copyrightYear}, which makes the site look unmaintained` });
  }
  if (!f.hasPrivacyLink) {
    add({ id: 'no_privacy', category: 'trust', severity: 'low', points: 3, title: 'No privacy policy', detail: 'Required in many regions if you collect any personal data.' });
  }
  if (brokenLinks.length) {
    add({ id: 'broken_links', category: 'trust', severity: 'medium', points: 8,
      title: `${brokenLinks.length} broken link${brokenLinks.length > 1 ? 's' : ''}`, detail: brokenLinks.slice(0, 5).join(', '),
      pitch: `a few links on your site lead to error pages (for example ${new URL(brokenLinks[0]).pathname})` });
  }

  return out;
}

export function score(findings: Finding[]): number {
  return Math.min(100, findings.reduce((s, f) => s + f.points, 0));
}

export function grade(s: number): Grade {
  return s >= 60 ? 'hot' : s >= 35 ? 'warm' : 'cool';
}
