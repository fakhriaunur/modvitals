import pino from 'pino';

/**
 * Structured logger for ModVitals
 *
 * Provides JSON-structured logging with levels, timestamps, and context.
 * In development, uses pino-pretty for readable output; in production, outputs pure JSON
 * for aggregation into Datadog / CloudWatch / ELK.
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info({ mod: 'u/some_mod', action: 'removelink' }, 'mod action tracked');
 *   logger.error({ err, dateKey }, 'failed to get metrics');
 *   logger.warn({ username }, 'user not found');
 *
 * Features:
 * - Structured JSON with level, time, msg, and context fields
 * - ISO timestamps for trace correlation
 * - Redaction of sensitive fields (password, token, secret)
 * - Child loggers for request-scoped context
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'token', 'secret', 'DEVVIT_TOKEN', '*.password', '*.token', '*.secret'],
    remove: true,
  },
  // In non-production, pretty-print for local DX; in production, raw JSON for log aggregation
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

/**
 * Create a child logger with bound context (e.g., request ID, subreddit).
 * Allows tracing a request through the system.
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Structured metric logger — use for operational telemetry that will be
 * aggregated in metrics systems (Datadog, Prometheus, etc.).
 */
export function logMetric(name: string, value: number, tags: Record<string, string> = {}) {
  logger.info({ metric: name, value, ...tags }, `metric:${name}`);
}
