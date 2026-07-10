import { db } from './src/db';
import { invoices } from './src/db/schema';
async function run() {
  const all = await db.select().from(invoices);
  console.log(all);
}
run();
