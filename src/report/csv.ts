import type { AuditResult, OutreachEmail } from '../types.js';

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: { result: AuditResult; email?: OutreachEmail }[]): string {
  const header = ['url', 'business', 'score', 'grade', 'emails', 'phones', 'platform', 'top_findings', 'email_subject', 'email_body', 'status'];
  const lines = rows.map(({ result: r, email }) => [
    r.url, r.business, r.ok ? r.score : '', r.ok ? r.grade : '', r.emails.join('; '), r.phones.join('; '),
    r.facts?.tech.platform ?? '', r.findings.slice(0, 5).map((f) => f.title).join('; '),
    email?.subject ?? '', email?.body ?? '', r.ok ? 'audited' : `skipped: ${r.skippedReason}`,
  ].map(cell).join(','));
  return [header.join(','), ...lines].join('\n') + '\n';
}
