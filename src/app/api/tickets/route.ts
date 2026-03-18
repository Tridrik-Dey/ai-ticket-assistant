import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getDb, ensureTicketsTable } from "@/db";
import { tickets } from "@/db/schema";
import type { Ticket, TicketCategory, TicketPriority } from "@/types/ticket";
import {
  createFallbackTicket,
  isDatabaseConnectionError,
  listFallbackTickets,
} from "@/lib/ticketFallbackStore";
import { translateToEnglish } from "@/lib/openai";

type DbTicket = typeof tickets.$inferSelect;

type CreateTicketPayload = {
  subject: string;
  description: string;
  customerName: string;
  customerEmail: string;
  language?: string;
};

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTicketStatus(value: unknown): value is "OPEN" | "RESOLVED" {
  return value === "OPEN" || value === "RESOLVED";
}

function isTicketCategory(value: unknown): value is TicketCategory | null {
  if (value === null) return true;
  return (
    value === "BILLING" ||
    value === "TECHNICAL" ||
    value === "ACCOUNT" ||
    value === "COMPLAINT" ||
    value === "FEATURE" ||
    value === "OTHER"
  );
}

function isTicketPriority(value: unknown): value is TicketPriority | null {
  if (value === null) return true;
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function parseTicket(row: DbTicket): Ticket {
  const {
    id,
    subject,
    description,
    customerName,
    customerEmail,
    status,
    category,
    priority,
    issueSummary,
    suggestedResponse,
    createdAt,
    updatedAt,
  } = row;

  if (!isTicketStatus(status) || !isTicketCategory(category) || !isTicketPriority(priority)) {
    throw new Error("Stored ticket contains invalid fields.");
  }

  return {
    id,
    subject,
    description,
    customerName,
    customerEmail,
    status,
    category,
    priority,
    issueSummary,
    suggestedResponse,
    createdAt: toDate(createdAt),
    updatedAt: toDate(updatedAt),
  };
}

function isCreatePayload(payload: unknown): payload is CreateTicketPayload {
  if (!payload || typeof payload !== "object") return false;
  const { subject, description, customerName, customerEmail, language } = payload as {
    subject?: unknown;
    description?: unknown;
    customerName?: unknown;
    customerEmail?: unknown;
    language?: unknown;
  };

  const hasValidLanguage = language === undefined || isString(language);

  return (
    isString(subject) &&
    isString(description) &&
    isString(customerName) &&
    isString(customerEmail) &&
    hasValidLanguage
  );
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeLanguage(value: string | undefined): string {
  if (!value) return "auto";
  return value.trim().toLowerCase();
}

async function toEnglishContent(
  subject: string,
  description: string,
  language: string,
): Promise<{ subject: string; description: string }> {
  try {
    const [translatedSubject, translatedDescription] = await Promise.all([
      translateToEnglish(subject, language),
      translateToEnglish(description, language),
    ]);

    return {
      subject: normalizeText(translatedSubject),
      description: normalizeText(translatedDescription),
    };
  } catch {
    return {
      subject: normalizeText(subject),
      description: normalizeText(description),
    };
  }
}

function extractDbError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";

  const details = [];
  let current: unknown = error;

  while (current instanceof Error) {
    details.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }

  if (typeof current === "string" && current.length > 0) {
    details.push(current);
  }

  return details.join(" | ");
}

function formatDbErrorPayload(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Missing DATABASE_URL environment variable.") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const isDev = process.env.NODE_ENV !== "production";

  if (isDev && error instanceof Error) {
    return NextResponse.json(
      {
        error: "Unable to fetch tickets.",
        details: extractDbError(error),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: "Unable to fetch tickets." }, { status: 500 });
}

export async function GET() {
  try {
    const db = getDb();
    await ensureTicketsTable();

    const rows = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
    const payload = rows.map(parseTicket);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(listFallbackTickets());
    }

    return formatDbErrorPayload(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isCreatePayload(body)) {
    return NextResponse.json(
      {
        error:
          "Invalid request payload. subject, description, customerName and customerEmail are required.",
      },
      { status: 400 },
    );
  }

  const now = new Date();
  const id = `TICKET_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const language = normalizeLanguage(body.language);
  const translated = await toEnglishContent(body.subject, body.description, language);

  try {
    const db = getDb();
    await ensureTicketsTable();

    const [created] = await db
      .insert(tickets)
      .values({
        id,
        subject: translated.subject,
        description: translated.description,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        status: "OPEN",
        category: null,
        priority: null,
        issueSummary: null,
        suggestedResponse: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      return NextResponse.json({ error: "Unable to create ticket." }, { status: 500 });
    }

    return NextResponse.json(parseTicket(created), { status: 201 });
  } catch (error: unknown) {
    if (isDatabaseConnectionError(error)) {
      const fallback = createFallbackTicket(
        {
          id,
          subject: translated.subject,
          description: translated.description,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
        },
        now,
      );
      return NextResponse.json(fallback, { status: 201 });
    }

    if (error instanceof Error && error.message === "Missing DATABASE_URL environment variable.") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return NextResponse.json(
        { error: "Unable to create ticket.", details: extractDbError(error) },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: "Unable to create ticket." }, { status: 500 });
  }
}
