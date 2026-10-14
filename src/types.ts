export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Category = 'availability' | 'speed' | 'mobile' | 'seo' | 'conversion' | 'trust' | 'freshness';

/** One thing the audit noticed about a site. `points` is how much it adds to the opportunity score. */
export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  points: number;
  /** A sentence a salesperson could use about this issue (used by the email writer). */
  pitch?: string;
}

export interface TechInfo {
  platform: string | null;          // WordPress, Wix, Shopify, ...
  booking: string[];                // Calendly, Acuity, ...
  chat: string[];                   // Intercom, Tidio, ...
  analytics: string[];              // Google Analytics, Meta Pixel, ...
}

export interface PageFacts {
  url: string;
  finalUrl: string;
  status: number;
  loadMs: number;
  bytes: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  hasViewport: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
  scripts: number;
  hasTelLink: boolean;
  hasForm: boolean;
  hasPrivacyLink: boolean;
  hasOpenGraph: boolean;
  hasLocalBusinessSchema: boolean;
  copyrightYear: number | null;
  emails: string[];
  phones: string[];
  socials: string[];
  internalLinks: string[];
  contactPageUrl: string | null;
  tech: TechInfo;
}

export type Grade = 'hot' | 'warm' | 'cool';

export interface AuditResult {
  url: string;
  ok: boolean;
  business: string | null;
  score: number;
  grade: Grade;
  findings: Finding[];
  emails: string[];
  phones: string[];
  facts: PageFacts | null;
  brokenLinks: string[];
  skippedReason?: string;
  auditedAt: string;
  durationMs: number;
}

export interface OutreachOptions {
  senderName: string;
  senderCompany?: string;
  offer: string;
}

export interface OutreachEmail {
  subject: string;
  body: string;
  writer: 'claude' | 'template';
}
