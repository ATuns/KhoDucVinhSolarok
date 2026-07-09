import { db } from "./src/db/index.ts";
import { invoices } from "./src/db/schema.ts";

async function run() {
  const result = await db.select({ status: invoices.status }).from(invoices);
  const statuses = new Set(result.map(r => r.status));
  console.log("Unique statuses:", Array.from(statuses));
  process.exit(0);
}
run();
