import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(postgres(url), { schema });
}

/** Lazy singleton so importing core types never requires a DB connection. */
export function db() {
  _db ??= createDb();
  return _db;
}

export { schema };
