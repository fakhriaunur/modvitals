import { Hono } from 'hono';

const app = new Hono();

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', app: 'mod-vitals', version: '0.1.0' });
});

// Trigger: post submit
app.post('/internal/triggers/post-submit', async (c) => {
  return c.json({ status: 'ok' }, 200);
});

// Trigger: comment create
app.post('/internal/triggers/comment-create', async (c) => {
  return c.json({ status: 'ok' }, 200);
});

// Trigger: mod action
app.post('/internal/triggers/mod-action', async (c) => {
  return c.json({ status: 'ok' }, 200);
});

// Scheduler: generate report
app.post('/internal/scheduler/generate-report', async (c) => {
  return c.json({ status: 'ok' }, 200);
});

export default app;
