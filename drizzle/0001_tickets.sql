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
);