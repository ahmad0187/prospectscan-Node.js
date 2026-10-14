import * as cheerio from 'cheerio';
import type { PageFacts } from '../types.js';
import { detectTech } from './detect.js';
import type { FetchedPage } from './fetchPage.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
const SOCIAL_RE = /(facebook|instagram|linkedin|twitter|x|tiktok|youtube)\.com\//i;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;

export function parsePage(page: FetchedPage): PageFacts {
  const $ = cheerio.load(page.html);
  const base = page.finalUrl;
  const origin = new URL(base).origin;
  const text = $('body').text().replace(/\s+/g, ' ');

  const links = $('a[href]')
    .map((_, a) => ({ href: ($(a).attr('href') ?? '').trim(), text: $(a).text().trim() }))
    .get();

  const absolute = (href: string): string | null => {
    try { return new URL(href, base).toString(); } catch { return null; }
  };

  const internal = new Set<string>();
  for (const { href } of links) {
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|sms):/i.test(href)) continue;
    const abs = absolute(href);
    if (abs && new URL(abs).origin === origin) internal.add(abs.split('#')[0]);
  }

  const contact = links.find((l) => /contact|get[-\s]?in[-\s]?touch|reach[-\s]?us/i.test(l.href + ' ' + l.text) && !/^(mailto|tel):/i.test(l.href));
  const contactUrl = contact ? absolute(contact.href) : null;

  const emails = new Set<string>();
  links.filter((l) => /^mailto:/i.test(l.href)).forEach((l) => emails.add(decodeURIComponent(l.href.slice(7).split('?')[0]).toLowerCase()));
  (text.match(EMAIL_RE) ?? []).forEach((e) => emails.add(e.toLowerCase()));

  const phones = new Set<string>();
  links.filter((l) => /^tel:/i.test(l.href)).forEach((l) => phones.add(l.href.slice(4).trim()));
  (text.match(PHONE_RE) ?? []).forEach((p) => phones.add(p.trim()));

  const years = [...page.html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const images = $('img');

  return {
    url: page.url,
    finalUrl: page.finalUrl,
    status: page.status,
    loadMs: page.loadMs,
    bytes: page.bytes,
    title: $('title').first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr('content')?.trim() || null,
    h1Count: $('h1').length,
    hasViewport: $('meta[name="viewport"]').length > 0,
    imagesTotal: images.length,
    imagesMissingAlt: images.filter((_, img) => !($(img).attr('alt') ?? '').trim()).length,
    scripts: $('script[src]').length,
    hasTelLink: links.some((l) => /^tel:/i.test(l.href)),
    hasForm: $('form').filter((_, f) => $(f).find('input, textarea').length >= 2).length > 0,
    hasPrivacyLink: links.some((l) => /privacy/i.test(l.href + ' ' + l.text)),
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasLocalBusinessSchema: /"@type"\s*:\s*"(?:LocalBusiness|Dentist|MedicalClinic|Restaurant|Plumber|HomeAndConstructionBusiness|ProfessionalService|[A-Za-z]*Store)"/.test(page.html),
    copyrightYear: years.length ? Math.max(...years) : null,
    emails: [...emails].filter((e) => !ASSET_EXT.test(e)),
    phones: [...phones],
    socials: [...new Set(links.map((l) => l.href).filter((h) => SOCIAL_RE.test(h)))],
    internalLinks: [...internal],
    contactPageUrl: contactUrl && new URL(contactUrl).origin === origin ? contactUrl : null,
    tech: detectTech(page.html),
  };
}

/** Best guess at the business name: og:site_name, else the first part of the <title>. */
export function businessName(html: string): string | null {
  const $ = cheerio.load(html);
  const site = $('meta[property="og:site_name"]').attr('content')?.trim();
  if (site) return site;
  const title = $('title').first().text().trim();
  return title ? title.split(/\s[|\-–—:]\s/)[0].trim() : null;
}
