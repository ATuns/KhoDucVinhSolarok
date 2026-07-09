import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";
import { invoices } from "./src/db/schema.ts";

async function run() {
  const [res] = await db.select({
    sumAmount: sql<any>`sum(${invoices.totalAmount})::bigint`
  }).from(invoices);
  console.log(res);
  console.log(typeof res.sumAmount);
  process.exit(0);
}
run();
