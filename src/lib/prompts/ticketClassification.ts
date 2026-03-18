export const ALLOWED_CATEGORIES = ["BILLING", "TECHNICAL", "ACCOUNT", "COMPLAINT", "FEATURE", "OTHER"] as const;
export const ALLOWED_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type TicketCategory = (typeof ALLOWED_CATEGORIES)[number];
export type TicketPriority = (typeof ALLOWED_PRIORITIES)[number];

export type TicketClassificationOutput = {
  category: TicketCategory;
  priority: TicketPriority;
  issueSummary: string;
  suggestedResponse: string;
};

export function buildTicketClassificationPrompt(subject: string, description: string): string {
  return [
    "You are an AI ticket triage assistant for a support platform.",
    "Classify the ticket and respond in strict JSON only.",
    "Use only the exact values listed.",
    `Allowed categories: ${ALLOWED_CATEGORIES.join(", ")}.`,
    `Allowed priorities: ${ALLOWED_PRIORITIES.join(", ")}.`,
    "Rules:",
    "- category must be one of the allowed categories.",
    "- priority must be one of the allowed priorities.",
    "- issueSummary must be a short sentence summarizing the customer issue.",
    "- suggestedResponse must be a short professional message for the support team/customer.",
    "- Output must match exactly this JSON schema:",
    '{"category":"...","priority":"...","issueSummary":"...","suggestedResponse":"..."}',
    "No markdown, no extra keys, no explanation.",
    "Ticket input:",
    `Subject: ${subject}`,
    `Description: ${description}`,
  ].join("\n");
}
