// Crayon Box's family sync server (ADR 0024). Runs with Node 24's own TypeScript support: `node src/main.ts`.
//
// Environment:
//   PORT          where to listen (default 8787)
//   DATA_DIR      the data folder (default ./data; /data in the container)
//   PAIRING_CODE  a fixed pairing code instead of the one the server makes on first start
//   OPENROUTER_API_KEY, AI_IMAGE_MODEL, AI_DRAW_MODEL, AI_DAILY_LIMIT   AI pages (ADR 0029); the models are the
//                 defaults, a parent can pick another in the app (ADR 0032)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { aiConfigFromEnv } from './ai.ts';
import { handler } from './http.ts';
import { ModelCatalog } from './models.ts';
import { Store } from './store.ts';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATA_DIR ?? './data';

const store = Store.open(dataDir);
const code = store.pairingCode(process.env.PAIRING_CODE);
const ai = aiConfigFromEnv(process.env);
const models = new ModelCatalog();
// Fetch OpenRouter's model list early, so the first page already knows what its model gives back (ADR 0032).
if (ai.key) void models.list();
const server = createServer(handler({ store, version: pkg.version, pairingCode: process.env.PAIRING_CODE, ai, models }));

server.listen(port, () => {
  console.log(`Crayon Box sync ${pkg.version} on port ${port}, data in ${dataDir}`);
  console.log(`Pairing code: ${code}`);
  console.log(ai.key ? `AI pages: on (${ai.imageModel}, ${ai.drawModel}; ${ai.dailyLimit} a day)` : 'AI pages: off (no OPENROUTER_API_KEY)');
});

const stop = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
