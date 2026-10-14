import type { TechInfo } from '../types.js';

type Signature = [name: string, pattern: RegExp];

const PLATFORMS: Signature[] = [
  ['WordPress', /wp-content\/|wp-includes\/|<meta[^>]+generator[^>]+wordpress/i],
  ['Wix', /static\.wixstatic\.com|wix\.com\/|X-Wix-/i],
  ['Squarespace', /squarespace\.com|static1\.squarespace/i],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme/i],
  ['Webflow', /webflow\.(?:com|io)|data-wf-page/i],
  ['GoDaddy Website Builder', /img1\.wsimg\.com|godaddy/i],
  ['Weebly', /weebly\.com|editmysite\.com/i],
];

const BOOKING: Signature[] = [
  ['Calendly', /calendly\.com/i],
  ['Acuity Scheduling', /acuityscheduling\.com|squarespacescheduling/i],
  ['Square Appointments', /squareup\.com\/appointments|square\.site\/book/i],
  ['Setmore', /setmore\.com/i],
  ['SimplyBook', /simplybook\.(?:me|it)/i],
  ['Booksy', /booksy\.com/i],
  ['Zocdoc', /zocdoc\.com/i],
  ['Mindbody', /mindbodyonline\.com|healcode/i],
  ['Cal.com', /cal\.com\//i],
  ['Online booking form', /book(?:ing)?[-\s]?(?:online|now|an?\s+appointment)/i],
];

const CHAT: Signature[] = [
  ['Intercom', /widget\.intercom\.io|intercomSettings/i],
  ['Tidio', /code\.tidio\.co/i],
  ['Crisp', /client\.crisp\.chat/i],
  ['tawk.to', /embed\.tawk\.to/i],
  ['Drift', /js\.driftt\.com/i],
  ['HubSpot Chat', /js\.hs-scripts\.com|hubspot.*conversations/i],
  ['Zendesk Chat', /static\.zdassets\.com|zopim/i],
  ['LiveChat', /cdn\.livechatinc\.com/i],
  ['WhatsApp chat button', /wa\.me\/|api\.whatsapp\.com\/send/i],
];

const ANALYTICS: Signature[] = [
  ['Google Analytics', /googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/i],
  ['Google Tag Manager', /googletagmanager\.com\/gtm\.js/i],
  ['Meta Pixel', /connect\.facebook\.net\/[^"']+\/fbevents\.js|fbq\(/i],
  ['Hotjar', /static\.hotjar\.com/i],
];

const all = (sigs: Signature[], html: string) => sigs.filter(([, re]) => re.test(html)).map(([name]) => name);

export function detectTech(html: string): TechInfo {
  return {
    platform: all(PLATFORMS, html)[0] ?? null,
    booking: all(BOOKING, html),
    chat: all(CHAT, html),
    analytics: all(ANALYTICS, html),
  };
}
