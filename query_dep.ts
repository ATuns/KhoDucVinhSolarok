import { db } from "./src/db/index.ts";
import { deposits } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function run() {
  const deps = await db.select().from(deposits).where(eq(deposits.invoiceId, 187));
  console.log(deps);
  process.exit(0);
}
run();
