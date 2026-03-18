import type { Ticket } from "@/types/ticket";

export const sampleTicket: Ticket = {
  id: "TICKET_001",
  subject: "Cannot login to my account",
  description:
    "Hi, I have been trying to log in since yesterday but it keeps saying invalid credentials. I already reset my password twice. Please help urgently.",
  customerName: "John Doe",
  customerEmail: "john.doe@example.com",
  status: "OPEN",
  category: null,
  priority: null,
  issueSummary: null,
  suggestedResponse: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/*
Expected AI output:
- Category: "ACCOUNT"
- Priority: "HIGH"
- Extracted issue: "login failure"
- Suggested response: "Hi John, we’re sorry for the login trouble. Please try clearing your browser cache/cookies, then log in using the reset password link from your latest confirmation email. If the issue persists, please reply with your account email, and we’ll verify account lockout status and reset MFA settings."
*/
