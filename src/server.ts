import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { JobStore } from './jobs.js';
import { toCsv } from './report/csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const AuditRequest = z.object({
  urls: z.array(z.string().trim().min(3).max(300)).min(1).max(50),
  senderName: z.string().trim().min(1).max(80),
  senderCompany: z.string().trim().max(80).optional(),
  offer: z.string().trim().min(5).max(300),
});

export function createApp(store = new JobStore(Number(process.env.CONCURRENCY || 4), {
  allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === 'true',
})) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, emailWriter: process.env.ANTHROPIC_API_KEY ? 'claude' : 'template' });
  });

  app.post('/api/audits', (req, res) => {
    const parsed = AuditRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
      return;
    }
    const { urls, ...outreach } = parsed.data;
    const unique = [...new Set(urls.filter(Boolean))];
    const job = store.create(unique, outreach);
    res.status(202).json({ id: job.id, total: unique.length });
  });

  app.get('/api/audits/:id', (req, res) => {
    const job = store.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const done = job.rows.filter((r) => r.status === 'done').length;
    res.json({ ...job, progress: { done, total: job.rows.length } });
  });

  app.get('/api/audits/:id/export.csv', (req, res) => {
    const job = store.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const rows = job.rows.filter((r) => r.result).map((r) => ({ result: r.result!, email: r.email }));
    res.type('text/csv').attachment('prospects.csv').send(toCsv(rows));
  });

  app.use(express.static(path.join(here, '..', 'public')));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`ProspectScan dashboard on http://localhost:${port}`));
}
