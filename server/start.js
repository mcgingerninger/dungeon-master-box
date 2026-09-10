// Real entry point — starts the server against an actual database file, not the in-memory db
// the tests use. Run with: node server/start.js
// Configurable via env vars so a future Phase 3+ deployment (or Phase 6's packaging) doesn't
// need code changes to point at a different port or database location.
import { openDatabase } from '../db/database.js';
import { createServer } from './server.js';
import { createWebSocketServer } from './websocket.js';

const PORT = Number(process.env.PORT) || 4000;
const DB_PATH = process.env.DB_PATH || './dungeon-master-box.db';

const db = openDatabase(DB_PATH);
const server = createServer(db);
// Shares the same TCP port as the REST API (the 'ws' package upgrades HTTP connections to
// WebSocket on the same http.Server instance) rather than needing a second port.
createWebSocketServer(db, server);
server.listen(PORT, () => {
  console.log(`Dungeon Master Box server listening on http://localhost:${PORT} (db: ${DB_PATH}, WebSocket on the same port)`);
});
