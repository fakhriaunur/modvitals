import { Hono } from 'hono';
import { validateCron } from './cron-matcher.js';
import { logger } from './logger.js';
import registerTriggers from './routes/triggers.js';
import registerScheduler from './routes/scheduler.js';
import registerSnapshot from './routes/snapshot.js';

/**
 * Hono application factory for ModVitals
 *
 * Extracted from server.ts to allow integration tests to import the
 * app without side-effecting a server.listen() call. server.ts
 * remains the production entry point that creates the Devvit-wrapped
 * server and starts listening; tests import from this module and use
 * app.request() for HTTP-level integration testing.
 */
const app = new Hono();

// Health check — structured logging with request context
app.get('/api/health', (c) => {
  logger.debug({ path: '/api/health' }, 'health check');
  return c.json({ status: 'ok', app: 'mod-vitals', version: '0.1.0' });
});

/**
 * Settings validation: report-hour
 */
app.post('/internal/settings/validate-hour', async (c) => {
  const body = await c.req.json<{ value: number }>();
  const hour = body.value;

  logger.info({ hour, endpoint: 'validate-hour' }, 'validating report hour');

  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return c.json(
      { success: false, error: 'Report hour must be an integer between 0 and 23.' },
      200,
    );
  }

  return c.json({ success: true });
});

/**
 * Settings validation: inactive-threshold
 */
app.post('/internal/settings/validate-threshold', async (c) => {
  const body = await c.req.json<{ value: number }>();
  const threshold = body.value;

  logger.info({ threshold, endpoint: 'validate-threshold' }, 'validating threshold');

  if (
    typeof threshold !== 'number' ||
    !Number.isInteger(threshold) ||
    threshold < 1 ||
    threshold > 365
  ) {
    return c.json(
      { success: false, error: 'Threshold must be an integer between 1 and 365.' },
      200,
    );
  }

  return c.json({ success: true });
});

/**
 * Settings validation: report-minute
 */
app.post('/internal/settings/validate-minute', async (c) => {
  const body = await c.req.json<{ value: number }>();
  const minute = body.value;

  logger.info({ minute, endpoint: 'validate-minute' }, 'validating report minute');

  if (typeof minute !== 'number' || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return c.json(
      { success: false, error: 'Report minute must be an integer between 0 and 59.' },
      200,
    );
  }

  return c.json({ success: true });
});

/**
 * Settings validation: custom-cron
 */
app.post('/internal/settings/validate-cron', async (c) => {
  const body = await c.req.json<{ value: string }>();
  const cron = body.value;

  logger.info({ cron, endpoint: 'validate-cron' }, 'validating custom cron');

  const error = validateCron(cron ?? '');
  if (error) {
    return c.json({ success: false, error }, 200);
  }

  return c.json({ success: true });
});

// Register route modules
registerTriggers(app);
registerScheduler(app);
registerSnapshot(app);

export default app;
