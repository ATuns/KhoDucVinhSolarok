import { db } from './src/db/index.js';
import { stockTransactions } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  const allTxs = await db.select().from(stockTransactions);
  const groups: Record<string, number> = {};
  for (const tx of allTxs) {
    if (!tx.docNumber) continue;
    const key = `${tx.docNumber}_${tx.productId}_${tx.type}`;
    groups[key] = (groups[key] || 0) + 1;
  }
  
  for (const key in groups) {
    if (groups[key] > 1) {
      console.log(`Duplicate found: ${key} (${groups[key]} times)`);
    }
  }
  console.log('Done checking duplicates.');
  process.exit(0);
}
run();
