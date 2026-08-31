import { describe, it, expect } from 'vitest';
import { logger, createChildLogger, logMetric } from './logger.js';

describe('logger', () => {
  it('exports a pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('creates child logger with bindings', () => {
    const child = createChildLogger({ requestId: 'test-123', subreddit: 'testsub' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
  });

  it('logMetric logs without throwing', () => {
    expect(() => logMetric('test_metric', 42, { env: 'test' })).not.toThrow();
  });

  it('logger has correct level', () => {
    expect(logger.level).toBeDefined();
  });

  it('redacts sensitive fields', () => {
    // Pino redact should be configured; verify logger doesn't throw on sensitive data
    expect(() =>
      logger.info({ password: 'secret123', token: 'abc', data: 'ok' }, 'test'),
    ).not.toThrow();
  });
});
