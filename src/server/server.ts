import { createServer, getServerPort } from '@devvit/web/server';
import { getRequestListener } from '@hono/node-server';
import { logger } from './logger.js';
import app from './app.js';

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

const port = getServerPort();
const requestListener = getRequestListener(app.fetch);
const server = createServer(requestListener);
server.listen(port, () => {
  logger.info({ port }, 'modvitals server listening');
});

export default app;
