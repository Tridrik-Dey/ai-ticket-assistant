import { NextResponse } from "next/server";
import {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  TicketCategory,
  TicketPriority,
  buildTicketClassificationPrompt,
} from "@/lib/prompts/ticketClassification";
import { generateStructuredJson, geminiDefaultModel, GeminiProviderError } from "@/lib/openai";
import { getDb, ensureTicketsTable } from "@/db";
import { tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getFallbackTicketById,
  isDatabaseConnectionError,
  updateFallbackTicketClassification,
} from "@/lib/ticketFallbackStore";

const allowedCategorySet = new Set(ALLOWED_CATEGORIES);
const allowedPrioritySet = new Set(ALLOWED_PRIORITIES);
const classificationFallbackEnabled = process.env.CLASSIFICATION_FALLBACK !== "false";

type TicketClassification = {
  category: TicketCategory;
  priority: TicketPriority;
  issueSummary: string;
  suggestedResponse: string;
};

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && allowedCategorySet.has(value as TicketCategory);
}

function toPriority(value: unknown): value is TicketPriority {
  return typeof value === "string" && allowedPrioritySet.has(value as TicketPriority);
}

function safeParseClassification(content: string): TicketClassification {
  try {
    const cleaned = content.trim().replace(/^```json\n|```$/g, "");
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const category = parsed.category;
    const priority = parsed.priority;
    const issueSummary = parsed.issueSummary;
    const suggestedResponse = parsed.suggestedResponse;

    if (
      !toCategory(category) ||
      !toPriority(priority) ||
      !isString(issueSummary) ||
      !isString(suggestedResponse)
    ) {
      throw new Error("Invalid classified values.");
    }

    return {
      category,
      priority,
      issueSummary,
      suggestedResponse,
    };
  } catch {
    throw new Error("Unable to parse or validate model output.");
  }
}

function toLowerTrim(value: string): string {
  return value.toLowerCase().trim();
}

function normalizeText(value: string): string {
  return toLowerTrim(value).replace(/\s+/g, " ");
}

function buildFallbackClassification(subject: string, description: string): TicketClassification {
  const text = normalizeText(`${subject} ${description}`);

  if (
    text.includes("login") ||
    text.includes("signin") ||
    text.includes("sign in") ||
    text.includes("password") ||
    text.includes("account") ||
    text.includes("otp") ||
    text.includes("mfa") ||
    text.includes("invalid credentials") ||
    text.includes("two factor")
  ) {
    return {
      category: "ACCOUNT",
      priority: "HIGH",
      issueSummary: "Account authentication issue preventing access.",
      suggestedResponse:
        "I understand this is urgent. Please verify your email and reset request details, then try signing in again. If it still fails, we can reset your account access.",
    };
  }

  if (
    text.includes("invoice") ||
    text.includes("billing") ||
    text.includes("charge") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("subscription")
  ) {
    return {
      category: "BILLING",
      priority: "MEDIUM",
      issueSummary: "Customer reported a billing-related issue.",
      suggestedResponse:
        "Thanks for flagging this. Please share the invoice ID and date range so we can verify and correct the charge.",
    };
  }

  if (
    text.includes("bug") ||
    text.includes("error") ||
    text.includes("crash") ||
    text.includes("timeout") ||
    text.includes("slow") ||
    text.includes("doesnt") ||
    text.includes("does not")
  ) {
    return {
      category: "TECHNICAL",
      priority: "MEDIUM",
      issueSummary: "Technical issue reported in product behavior.",
      suggestedResponse:
        "Thanks for reporting this. We are checking logs and reproducing the issue so we can provide a fix path.",
    };
  }

  if (
    text.includes("feature") ||
    text.includes("enhancement") ||
    text.includes("new") ||
    text.includes("add") ||
    text.includes("request")
  ) {
    return {
      category: "FEATURE",
      priority: "LOW",
      issueSummary: "Feature enhancement request from customer.",
      suggestedResponse:
        "Great idea - thank you. We will review this feature request and update you with priority and roadmap fit.",
    };
  }

  if (
    text.includes("complaint") ||
    text.includes("angry") ||
    text.includes("poor") ||
    text.includes("unhappy") ||
    text.includes("disappointed") ||
    text.includes("frustrated") ||
    text.includes("cancel")
  ) {
    return {
      category: "COMPLAINT",
      priority: "HIGH",
      issueSummary: "Customer complaint requiring follow-up.",
      suggestedResponse:
        "I am sorry about this experience. We take this seriously and will review the case for a quick resolution.",
    };
  }

  return {
    category: "OTHER",
    priority: "LOW",
    issueSummary: "Customer support request classified as other.",
    suggestedResponse:
      "Thanks for your message. We have captured your request and will route it to the right support queue.",
  };
}

function toClassificationWithFallback(
  subject: string,
  description: string,
  error?: unknown,
): TicketClassification {
  if (!classificationFallbackEnabled) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Classification service unavailable.");
  }

  return buildFallbackClassification(subject, description);
}

async function classifyTicket(subject: string, description: string): Promise<TicketClassification> {
  try {
    const model = process.env.GEMINI_MODEL ?? geminiDefaultModel;
    const responseText = await generateStructuredJson(
      buildTicketClassificationPrompt(subject, description),
      model,
    );
    return safeParseClassification(responseText);
  } catch (error: unknown) {
    return toClassificationWithFallback(subject, description, error);
  }
}

function isValidPayload(payload: unknown): payload is {
  ticketId: string;
  subject: string;
  description: string;
} {
  if (!payload || typeof payload !== "object") return false;
  const { ticketId, subject, description } = payload as {
    ticketId?: unknown;
    subject?: unknown;
    description?: unknown;
  };
  return isString(ticketId) && isString(subject) && isString(description);
}

function formatErrorPayload(error: unknown) {
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev) {
    return { error: "Unable to classify ticket. Please retry." };
  }

  if (error instanceof GeminiProviderError) {
    return {
      error: "Unable to classify ticket. Please retry.",
      details: error.message,
      status: error.status,
      providerPayload: error.body,
    };
  }

  if (error instanceof Error) {
    return {
      error: "Unable to classify ticket. Please retry.",
      details: error.message,
    };
  }

  return { error: "Unable to classify ticket. Please retry." };
}

export async function POST(request: Request) {
  let body: unknown;
  let classification: TicketClassification | null = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json(
      {
        error:
          "Invalid request payload. ticketId, subject and description are required.",
      },
      { status: 400 },
    );
  }

  const { ticketId, subject, description } = body;

  try {
    classification = await classifyTicket(subject, description);

    const fallbackTicket = getFallbackTicketById(ticketId);
    if (fallbackTicket) {
      updateFallbackTicketClassification(ticketId, classification);
      return NextResponse.json(classification, { status: 200 });
    }

    const db = getDb();
    await ensureTicketsTable();
    const now = new Date();

    const [updated] = await db
      .update(tickets)
      .set({
        category: classification.category,
        priority: classification.priority,
        issueSummary: classification.issueSummary,
        suggestedResponse: classification.suggestedResponse,
        updatedAt: now,
      })
      .where(eq(tickets.id, ticketId))
      .returning({
        id: tickets.id,
      });

    if (!updated) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    return NextResponse.json(classification, { status: 200 });
  } catch (error: unknown) {
    if (isDatabaseConnectionError(error) && classification) {
      return NextResponse.json(classification, { status: 200 });
    }

    return NextResponse.json(formatErrorPayload(error), { status: 500 });
  }
}

