import { db } from "./src/db/index.ts";
import { invoices, invoiceItems } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function run() {
  const inv = await db.select().from(invoices).where(eq(invoices.id, 185));
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, 185));
  console.log("Invoice:", inv);
  console.log("Items:", items);
  process.exit(0);
}
run();
