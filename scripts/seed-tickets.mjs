#!/usr/bin/env node

import { Client } from "pg";

const tickets = [
  {
    id: "TICKET_1001",
    subject: "Cannot login to my account",
    description:
      "I have been trying to log in since yesterday, but it keeps saying invalid credentials.",
    customerName: "John Doe",
    customerEmail: "john.doe@example.com",
    status: "OPEN",
    category: null,
    priority: null,
    issueSummary: null,
    suggestedResponse: null,
  },
  {
    id: "TICKET_1002",
    subject: "Invoice amount mismatch",
    description:
      "The billed amount this month is higher than last month even though I used the same plan.",
    customerName: "Sara Khan",
    customerEmail: "sara.khan@example.com",
    status: "OPEN",
    category: null,
    priority: null,
    issueSummary: null,
    suggestedResponse: null,
  },
  {
    id: "TICKET_1003",
    subject: "Feature request: export report",
    description:
      "Can you add a CSV export for tickets completed last quarter so I can share with my team?",
    customerName: "Maya Patel",
    customerEmail: "maya.patel@example.com",
    status: "OPEN",
    category: null,
    priority: null,
    issueSummary: null,
    suggestedResponse: null,
  },
  {
    id: "TICKET_1004",
    subject: "Slow search results",
    description: "Search on dashboard becomes very slow after we added new records.",
    customerName: "Liam O'Neil",
    customerEmail: "liam.oneil@example.com",
    status: "RESOLVED",
    category: "TECHNICAL",
    priority: "MEDIUM",
    issueSummary: "Search performance on dashboard.",
    suggestedResponse: "Thanks for reporting. We are optimizing index configuration and index coverage.",
  },
  {
    id: "TICKET_1005",
    subject: "Need to change billing email",
    description: "Please update the billing email for my company account.",
    customerName: "Nina Rao",
    customerEmail: "nina.rao@example.com",
    status: "RESOLVED",
    category: "BILLING",
    priority: "LOW",
    issueSummary: "Billing email update request.",
    suggestedResponse: "Please verify account ownership and we'll update billing email in next 24 hours.",
  },
];

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }
  return databaseUrl;
}

const insertSql = `
  INSERT INTO tickets (
    id, subject, description, "customerName", "customerEmail", status,
    category, priority, "issueSummary", "suggestedResponse", "createdAt", "updatedAt"
  )
  VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10, NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    subject = EXCLUDED.subject,
    description = EXCLUDED.description,
    "customerName" = EXCLUDED."customerName",
    "customerEmail" = EXCLUDED."customerEmail",
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    "issueSummary" = EXCLUDED."issueSummary",
    "suggestedResponse" = EXCLUDED."suggestedResponse",
    "updatedAt" = NOW()
`;

const seed = async () => {
  const databaseUrl = getDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await client.query(`
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

    for (const ticket of tickets) {
      const values = [
        ticket.id,
        ticket.subject,
        ticket.description,
        ticket.customerName,
        ticket.customerEmail,
        ticket.status,
        ticket.category,
        ticket.priority,
        ticket.issueSummary,
        ticket.suggestedResponse,
      ];
      await client.query(insertSql, values);
    }
  } finally {
    await client.end();
  }
};

seed()
  .then(() => {
    console.log("Seed completed.");
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Seed failed.";
    console.error(message);
    process.exit(1);
  });
