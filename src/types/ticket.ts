export type TicketCategory = "BILLING" | "TECHNICAL" | "ACCOUNT" | "COMPLAINT" | "FEATURE" | "OTHER";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";

export type Ticket = {
  id: string;
  subject: string;
  description: string;
  customerName: string;
  customerEmail: string;
  status: "OPEN" | "RESOLVED";
  category: TicketCategory | null;
  priority: TicketPriority | null;
  issueSummary: string | null;
  suggestedResponse: string | null;
  createdAt: Date;
  updatedAt: Date;
};