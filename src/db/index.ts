import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { tickets } from "./schema";

type AppSchema = {
  tickets: typeof tickets;
};

let db: NodePgDatabase<AppSchema> | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }

  return databaseUrl;
}

export function getDb(): NodePgDatabase<AppSchema> {
  if (db) {
    return db;
  }

  const databaseUrl = getDatabaseUrl();
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  db = drizzle(pool, {
    schema: {
      tickets,
    },
  });

  return db;
}

export async function ensureTicketsTable(): Promise<void> {
  const database = getDb();

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id text PRIMARY KEY,
      subject text NOT NULL,
      description text NOT NULL,
      "customerName" text NOT NULL,
      "customerEmail" text NOT NULL,
      status text NOT NULL,
      category text,
      priority text,
      "issueSummary" text,
      "suggestedResponse" text,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL
    )
  `);
}
