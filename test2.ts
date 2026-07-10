import { db } from './src/db';
import { invoices } from './src/db/schema';
import { eq } from 'drizzle-orm';
async function run() {
  const all = await db.select().from(invoices).where(eq(invoices.isDeleted, true));
  console.log("Deleted invoices:", all);
}
run();
