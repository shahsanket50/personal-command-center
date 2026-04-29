import 'dotenv/config';
import { runMigrations } from '../server/services/db.js';

runMigrations()
  .then(() => { console.log('Migrations complete.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
