import { test, expect } from '@playwright/test';
import app from '../src/server/app.js';

/**
 * Integration tests for ModVitals Hono server
 *
 * These tests exercise the HTTP layer end-to-end via app.request(),
 * verifying that the Hono application correctly handles health checks
 * and settings validation without requiring a live Devvit Redis
 * or Reddit API. They serve as integration tests that validate
 * the wiring between routes, validation logic, and server assembly.
 */

test.describe('Health Check Integration', () => {
  test('GET /api/health returns ok status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: 'ok',
      app: 'mod-vitals',
      version: '0.1.0',
    });
  });

  test('GET /api/health returns JSON content type', async () => {
    const res = await app.request('/api/health');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  test('GET unknown route returns 404', async () => {
    const res = await app.request('/api/unknown');
    expect(res.status).toBe(404);
  });
});

test.describe('Settings Validation Integration', () => {
  test('POST /internal/settings/validate-hour accepts valid hour', async () => {
    const res = await app.request('/internal/settings/validate-hour', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 12 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /internal/settings/validate-hour rejects invalid hour', async () => {
    const res = await app.request('/internal/settings/validate-hour', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 25 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('0 and 23');
  });

  test('POST /internal/settings/validate-minute accepts valid minute', async () => {
    const res = await app.request('/internal/settings/validate-minute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 30 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /internal/settings/validate-minute rejects invalid minute', async () => {
    const res = await app.request('/internal/settings/validate-minute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 60 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /internal/settings/validate-cron accepts valid cron', async () => {
    const res = await app.request('/internal/settings/validate-cron', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: '0 12 * * *' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /internal/settings/validate-cron rejects invalid cron', async () => {
    const res = await app.request('/internal/settings/validate-cron', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'invalid' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /internal/settings/validate-threshold accepts valid threshold', async () => {
    const res = await app.request('/internal/settings/validate-threshold', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 5 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('POST /internal/settings/validate-threshold rejects invalid threshold', async () => {
    const res = await app.request('/internal/settings/validate-threshold', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 0 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

test.describe('Report Formatting Integration', () => {
  test('health endpoint and validation endpoints are all reachable', async () => {
    const cases: Array<{ endpoint: string; method: 'GET' | 'POST'; body?: string }> = [
      { endpoint: '/api/health', method: 'GET' },
      { endpoint: '/internal/settings/validate-hour', method: 'POST', body: JSON.stringify({ value: 12 }) },
      { endpoint: '/internal/settings/validate-minute', method: 'POST', body: JSON.stringify({ value: 12 }) },
      { endpoint: '/internal/settings/validate-cron', method: 'POST', body: JSON.stringify({ value: '0 12 * * *' }) },
      { endpoint: '/internal/settings/validate-threshold', method: 'POST', body: JSON.stringify({ value: 12 }) },
    ];
    for (const { endpoint, method, body } of cases) {
      const res = await app.request(endpoint, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body,
      });
      expect(res.status, `endpoint ${endpoint} should respond`).toBe(200);
    }
  });
});
