import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';
import { auditSite, type AuditOptions } from './audit/audit.js';
import { draftEmail } from './outreach/email.js';
import type { AuditResult, OutreachEmail, OutreachOptions } from './types.js';

export interface JobRow {
  input: string;
  status: 'queued' | 'running' | 'done';
  result?: AuditResult;
  email?: OutreachEmail;
}

export interface Job {
  id: string;
  createdAt: string;
  status: 'running' | 'done';
  outreach: OutreachOptions;
  rows: JobRow[];
}

/** In-memory job store. Fine for a single instance; swap for Redis/BullMQ to scale out. */
export class JobStore {
  private jobs = new Map<string, Job>();

  constructor(private readonly concurrency = 4, private readonly auditOptions: AuditOptions = {}, private readonly maxJobs = 50) {}

  create(urls: string[], outreach: OutreachOptions): Job {
    const job: Job = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'running',
      outreach,
      rows: urls.map((input) => ({ input, status: 'queued' })),
    };
    this.jobs.set(job.id, job);
    this.trim();
    void this.run(job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  private async run(job: Job) {
    const limit = pLimit(this.concurrency);
    await Promise.all(job.rows.map((row) => limit(async () => {
      row.status = 'running';
      row.result = await auditSite(row.input, this.auditOptions);
      if (row.result.ok) row.email = await draftEmail(row.result, job.outreach);
      row.status = 'done';
    })));
    job.status = 'done';
  }

  private trim() {
    while (this.jobs.size > this.maxJobs) this.jobs.delete(this.jobs.keys().next().value!);
  }
}
