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
  
  // Count total matching invoices
  const [countResult] = await db.select({ 
     count: 1
  }).from(invoices).where(filterClause);

  const list = await db.select().from(invoices).where(filterClause).limit(10).offset(0);
  console.log("Count:", countResult?.count, "List length:", list.length);
}
run();
