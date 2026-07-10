import { db } from './src/db/index.js';
import { stockTransactions } from './src/db/schema.js';
import { inArray, eq } from 'drizzle-orm';

async function run() {
  const allTxs = await db.select().from(stockTransactions).where(inArray(stockTransactions.type, ['BO_GHI_SO']));
  console.log('BO_GHI_SO count:', allTxs.length);
  process.exit(0);
}
run();
