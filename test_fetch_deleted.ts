import { db } from './src/db';
import { invoices, invoiceItems } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.isDeleted, true)).limit(1);
  if (invoice) {
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
    console.log("Found deleted invoice:", invoice.id, "with items:", items.length);
  } else {
    console.log("No deleted invoices found.");
  }
}
run();
