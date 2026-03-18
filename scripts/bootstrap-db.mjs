#!/usr/bin/env node

import { Client } from "pg";
import readline from "readline/promises";
import { stdin, stdout } from "process";
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";
import path from "path";

const rl = readline.createInterface({ input: stdin, output: stdout });

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("Identifiers may only contain letters, numbers, and underscore.");
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
}

function escapeLiteral(value) {
  return value.replace(/'/g, "''");
}

async function ask(question, fallback = "") {
  const suffix = fallback ? ` [${fallback}]` : "";
  const value = await rl.question(`${question}${suffix}: `);
  return value.trim().length > 0 ? value.trim() : fallback;
}

function generatePassword() {
  return randomBytes(16).toString("hex");
}

async function main() {
  const adminHost = await ask("Postgres host", process.env.PGHOST ?? "127.0.0.1");
  const adminPortString = await ask("Postgres port", process.env.PGPORT ?? "5432");
  const adminPort = Number.parseInt(adminPortString, 10);
  const adminUser = await ask("Postgres admin user", process.env.PGUSER ?? "postgres");
  const adminPassword = process.env.PGPASSWORD ?? (await ask("Postgres admin password"));

  const appUser = await ask("New application DB user", process.env.DB_APP_USER ?? "ticket_app");
  const appPasswordInput = process.env.DB_APP_PASSWORD ?? (await ask("New application DB password"));
  const appPassword = appPasswordInput.length > 0 ? appPasswordInput : generatePassword();
  const dbName = await ask("Database name", process.env.DB_NAME ?? "ai_ticket");

  const adminClient = new Client({
    host: adminHost,
    port: adminPort,
    user: adminUser,
    password: adminPassword,
    database: "postgres",
  });

  await adminClient.connect();

  const userIdentifier = quoteIdentifier(appUser);
  const dbIdentifier = quoteIdentifier(dbName);

  const existingUser = await adminClient.query(
    `SELECT 1 FROM pg_roles WHERE rolname = $1`,
    [appUser],
  );

  if (existingUser.rowCount === 0) {
    await adminClient.query(
      `CREATE ROLE ${userIdentifier} LOGIN PASSWORD '${escapeLiteral(appPassword)}'`,
    );
  } else {
    await adminClient.query(
      `ALTER ROLE ${userIdentifier} WITH PASSWORD '${escapeLiteral(appPassword)}'`,
    );
  }

  const existingDb = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );

  if (existingDb.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE ${dbIdentifier} OWNER ${userIdentifier}`);
  }

  await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbIdentifier} TO ${userIdentifier}`);
  await adminClient.end();

  const databaseUrl = `postgresql://${encodeURIComponent(appUser)}:${encodeURIComponent(appPassword)}@${adminHost}:${adminPort}/${dbName}`;
  const envPath = path.join(process.cwd(), ".env.local");
  const envContents = [
    "GEMINI_API_KEY=AIzaSyA9Xi4a-4GDD3Ps3uD_P-HebjYbjVD-EE0",
    "GEMINI_MODEL=gemini-1.5-pro-latest",
    `DATABASE_URL=${databaseUrl}`,
  ];

  writeFileSync(envPath, `${envContents.join("\n")}\n`);

  console.log("Database and user are ready.");
  console.log(`DATABASE_URL written to ${envPath}`);
  console.log(`User: ${appUser}`);
  console.log(`Database: ${dbName}`);
}

main()
  .catch((error) => {
    const message =
      error instanceof Error ? error.message : "Unexpected bootstrap error.";
    console.error("Bootstrap failed:", message);
    process.exit(1);
  })
  .finally(async () => {
    rl.close();
  });
