import type { Ticket, TicketCategory, TicketPriority } from "@/types/ticket";

type ErrorLike = {
  message?: unknown;
  cause?: unknown;
};

export type TicketClassificationPayload = {
  category: TicketCategory;
  priority: TicketPriority;
  issueSummary: string;
  suggestedResponse: string;
};

type TicketInput = {
  id: string;
  subject: string;
  description: string;
  customerName: string;
  customerEmail: string;
};

const fallbackTickets: Ticket[] = [];

const dbConnectionErrorSignatures = [
  "missing database_url environment variable",
  "missing DATABASE_URL environment variable",
  "database_url environment variable",
  "password authentication failed",
  "connect econnrefused",
  "connect refused",
  "connect ecancelled",
  "database is being accessed by other processes",
  "database is not yet ready to accept connections",
  "connection refused",
  "authentication failed",
  "relation does not exist",
];

function collectErrorMessages(error: unknown, maxDepth = 8): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current !== null && current !== undefined && depth < maxDepth) {
    if (seen.has(current)) {
      break;
    }

    seen.add(current);

    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
      depth += 1;
      continue;
    }

    if (typeof current === "object") {
      const candidate = current as ErrorLike;
      if (typeof candidate.message === "string") {
        messages.push(candidate.message);
      }
      current = candidate.cause;
      depth += 1;
      continue;
    }

    if (typeof current === "string") {
      messages.push(current);
    }

    break;
  }

  const serialized = typeof error === "object" ? JSON.stringify(error) : null;
  if (serialized) {
    messages.push(serialized);
  }

  return messages;
}

function hasConnectionErrorSignature(messages: string[]): boolean {
  return messages.some((message) => {
    const normalized = message.toLowerCase();
    return dbConnectionErrorSignatures.some((signature) => normalized.includes(signature.toLowerCase()));
  });
}

export function isDatabaseConnectionError(error: unknown): boolean {
  const messages = collectErrorMessages(error);
  return hasConnectionErrorSignature(messages);
}

export function listFallbackTickets(): Ticket[] {
  return [...fallbackTickets];
}

export function getFallbackTicketById(ticketId: string): Ticket | null {
  return fallbackTickets.find((ticket) => ticket.id === ticketId) ?? null;
}

export function createFallbackTicket(input: TicketInput, now: Date): Ticket {
  const ticket: Ticket = {
    id: input.id,
    subject: input.subject,
    description: input.description,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    status: "OPEN",
    category: null,
    priority: null,
    issueSummary: null,
    suggestedResponse: null,
    createdAt: now,
    updatedAt: now,
  };

  fallbackTickets.unshift(ticket);
  return ticket;
}

export function updateFallbackTicketClassification(
  ticketId: string,
  payload: TicketClassificationPayload,
): Ticket | null {
  const existing = getFallbackTicketById(ticketId);

  if (!existing) {
    return null;
  }

  existing.category = payload.category;
  existing.priority = payload.priority;
  existing.issueSummary = payload.issueSummary;
  existing.suggestedResponse = payload.suggestedResponse;
  existing.updatedAt = new Date();

  return existing;
}
