import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobStore } from '../src/jobs.js';
import { createApp } from '../src/server.js';
import { startFixtureSites } from './fixtures.js';

let sites: Awaited<ReturnType<typeof startFixtureSites>>;
const app = createApp(new JobStore(4, { allowPrivateNetworks: true, delayMs: 0, linkSample: 3 }));
beforeAll(async () => { sites = await startFixtureSites(['harbor-yoga', 'bright-smile-dental']); });
afterAll(() => sites.close());

describe('HTTP API', () => {
  it('validates input', async () => {
    const res = await request(app).post('/api/audits').send({ urls: [], senderName: '', offer: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it('runs an audit job and exports CSV', async () => {
    const start = await request(app).post('/api/audits').send({
      urls: Object.values(sites.urls), senderName: 'Ahmad', senderCompany: 'Orbix Solutions', offer: 'I add online booking and AI chat to small-business websites',
    });
    expect(start.status).toBe(202);
    let job;
    for (let i = 0; i < 60; i++) {
      job = (await request(app).get(`/api/audits/${start.body.id}`)).body;
      if (job.status === 'done') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(job.status).toBe('done');
    expect(job.progress).toEqual({ done: 2, total: 2 });
    expect(job.rows.every((r: any) => r.result.ok && r.email.subject)).toBe(true);

    const csv = await request(app).get(`/api/audits/${start.body.id}/export.csv`);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\n')[0]).toMatch(/^url,business,score,grade/);
  });

  it('404s on unknown jobs', async () => {
    expect((await request(app).get('/api/audits/nope')).status).toBe(404);
  });

  it('reports health', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true, emailWriter: 'template' });
  });
});
