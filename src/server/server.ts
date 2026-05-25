import { Hono } from 'hono';
import { createServer, getServerPort } from '@devvit/web/server';
import { getRequestListener } from '@hono/node-server';
import registerTriggers from './routes/triggers.js';
import registerScheduler from './routes/scheduler.js';

// ---------------------------------------------------------------------------
// App assembly
// ---------------------------------------------------------------------------

const app = new Hono();

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', app: 'mod-vitals', version: '0.1.0' });
});

/**
 * Settings validation: report-hour
 * Validates that the report hour is between 0 and 23.
 * Devvit calls this endpoint when the mod saves the setting.
 */
app.post('/internal/settings/validate-hour', async (c) => {
  const body = await c.req.json<{ value: number }>();
  const hour = body.value;

  console.log('[settings:validate-hour] validating', { hour });

  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return c.json(
      { error: 'Report hour must be an integer between 0 and 23.' },
      400,
    );
  }

  return c.json({ status: 'ok' }, 200);
});

/**
 * Settings validation: inactive-threshold
 * Validates that the inactive threshold is a positive integer >= 1.
 * Devvit calls this endpoint when the mod saves the setting.
 */
app.post('/internal/settings/validate-threshold', async (c) => {
  const body = await c.req.json<{ value: number }>();
  const threshold = body.value;

  console.log('[settings:validate-threshold] validating', { threshold });

  if (typeof threshold !== 'number' || !Number.isInteger(threshold) || threshold < 1 || threshold > 365) {
    return c.json(
      { error: 'Threshold must be an integer between 1 and 365.' },
      400,
    );
  }

  return c.json({ status: 'ok' }, 200);
});

// Register route modules
registerTriggers(app);
registerScheduler(app);

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

const port = getServerPort();
const requestListener = getRequestListener(app.fetch);
const server = createServer(requestListener);
server.listen(port, () => {
  console.log(`[modvitals] server listening on port ${port}`);
});

export default app;
