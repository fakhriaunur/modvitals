/**
 * ModVitals server entry point.
 *
 * Thin bootstrapper that imports and re-exports the assembled Hono app.
 * All route registration and server startup lives in server.ts.
 */
export { default as app } from './server.js';
