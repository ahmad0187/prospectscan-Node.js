#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import pLimit from 'p-limit';
import { auditSite } from './audit/audit.js';
import { draftEmail } from './outreach/email.js';
import { toCsv } from './report/csv.js';
import type { AuditResult, OutreachEmail } from './types.js';

const program = new Command();
program.name('prospectscan').description('Audit business websites and draft personalized outreach.').version('1.0.0');

program
  .command('audit')
  .description('Audit one or more websites')
  .argument('[urls...]', 'website URLs or domains')
  .option('-f, --file <path>', 'text/CSV file with one URL per line (first column)')
  .option('-o, --out <path>', 'write results to a CSV file')
  .option('--json <path>', 'write full results to a JSON file')
  .option('--sender <name>', 'your name for the email signature', 'Your Name')
  .option('--company <name>', 'your company for the email signature')
  .option('--offer <text>', 'one sentence about what you offer', 'I help local businesses fix issues like these in a few days')
  .option('-c, --concurrency <n>', 'sites audited in parallel', '4')
  .option('--links <n>', 'internal links to test per site for 404s', '12')
  .option('--allow-private', 'allow localhost/private IPs (for local testing)', false)
  .option('--no-email', 'skip drafting outreach emails')
  .action(async (urls: string[], o) => {
    const list = [...urls];
    if (o.file) {
      list.push(...readFileSync(o.file, 'utf8').split(/\r?\n/).map((l) => l.split(',')[0].trim())
        .filter((l) => l && !/^url$/i.test(l)));
    }
    if (!list.length) program.error('Give at least one URL, or --file urls.txt');

    const limit = pLimit(Number(o.concurrency));
    const rows: { result: AuditResult; email?: OutreachEmail }[] = await Promise.all([...new Set(list)].map((u) => limit(async () => {
      const result = await auditSite(u, { linkSample: Number(o.links), allowPrivateNetworks: o.allowPrivate });
      const email = result.ok && o.email ? await draftEmail(result, { senderName: o.sender, senderCompany: o.company, offer: o.offer }) : undefined;
      printResult(result);
      return { result, email };
    })));

    rows.sort((a, b) => b.result.score - a.result.score);
    if (o.out) { writeFileSync(o.out, toCsv(rows)); console.log(`\nSaved ${rows.length} rows to ${o.out}`); }
    if (o.json) { writeFileSync(o.json, JSON.stringify(rows, null, 2)); console.log(`Saved full results to ${o.json}`); }
    const hot = rows.filter((r) => r.result.grade === 'hot' && r.result.ok).length;
    console.log(`\nDone: ${rows.length} sites, ${hot} hot prospect${hot === 1 ? '' : 's'}.`);
  });

const COLORS = { hot: '\x1b[31m', warm: '\x1b[33m', cool: '\x1b[36m' } as const;
function printResult(r: AuditResult) {
  if (!r.ok) {
    console.log(`\n\x1b[2m- ${r.url}  skipped: ${r.skippedReason}\x1b[0m`);
    return;
  }
  console.log(`\n${COLORS[r.grade]}${r.grade.toUpperCase().padEnd(5)}\x1b[0m ${String(r.score).padStart(3)}/100  ${r.business ?? ''} (${r.url})`);
  for (const f of r.findings.slice(0, 5)) console.log(`        · ${f.title}`);
  if (r.emails.length) console.log(`        ✉ ${r.emails.join(', ')}`);
}

program.parseAsync();
