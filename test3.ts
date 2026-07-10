import { db } from './src/db';
import { invoices } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
async function run() {
  const isDeleted = 'true';
  let conditions = [];
  if (isDeleted !== undefined) {
    conditions.push(eq(invoices.isDeleted, isDeleted === 'true'));
  } else {
    conditions.push(eq(invoices.isDeleted, false));
  }
  const filterClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const list = await db.select({ id: invoices.id }).from(invoices).where(filterClause);
  console.log(list);
}
run();
