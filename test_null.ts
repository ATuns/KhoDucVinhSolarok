import { db } from "./src/db/index.ts";
import { sql } from "drizzle-orm";
async function run() {
  try {
    const res = await db.execute(sql`SELECT unaccent(NULL) AS val`);
    console.log("unaccent(NULL) success:", res.rows);
  } catch (e) {
    console.error("unaccent(NULL) error:", e);
  }
  process.exit(0);
}
run();
