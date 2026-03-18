"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Ticket, TicketCategory, TicketPriority } from "@/types/ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RawTicket = Omit<Ticket, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type SubmitState = "idle" | "saving" | "success" | "error";

type TicketStatusFilter = "all" | "OPEN" | "RESOLVED";

const VALID_CATEGORIES = ["BILLING", "TECHNICAL", "ACCOUNT", "COMPLAINT", "FEATURE", "OTHER"] as const;
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const CATEGORY_SET = new Set<string>(VALID_CATEGORIES);
const PRIORITY_SET = new Set<string>(VALID_PRIORITIES);
const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto Detect" },
  { value: "en", label: "English" },
  { value: "it", label: "Italian" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "ja", label: "Japanese" },
] as const;

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseStatus(value: unknown): Ticket["status"] | null {
  return value === "OPEN" || value === "RESOLVED" ? value : null;
}

function parseCategory(value: unknown): TicketCategory | null {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && CATEGORY_SET.has(value) ? (value as TicketCategory) : null;
}

function parsePriority(value: unknown): TicketPriority | null {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && PRIORITY_SET.has(value) ? (value as TicketPriority) : null;
}

function toTicket(raw: RawTicket): Ticket {
  const createdAt = parseDate(raw.createdAt);
  const updatedAt = parseDate(raw.updatedAt);

  if (
    !isNonEmpty(raw.id) ||
    !isNonEmpty(raw.subject) ||
    !isNonEmpty(raw.description) ||
    !isNonEmpty(raw.customerName) ||
    !isNonEmpty(raw.customerEmail)
  ) {
    throw new Error("Invalid ticket payload.");
  }

  const status = parseStatus(raw.status);
  if (!status || createdAt === null || updatedAt === null) {
    throw new Error("Invalid ticket payload.");
  }

  return {
    id: raw.id,
    subject: raw.subject,
    description: raw.description,
    customerName: raw.customerName,
    customerEmail: raw.customerEmail,
    status,
    category: parseCategory(raw.category),
    priority: parsePriority(raw.priority),
    issueSummary: isNonEmpty(raw.issueSummary) ? raw.issueSummary : null,
    suggestedResponse: isNonEmpty(raw.suggestedResponse) ? raw.suggestedResponse : null,
    createdAt,
    updatedAt,
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function UserTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [language, setLanguage] = useState<string>("auto");
  const [lookupEmail, setLookupEmail] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("all");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const loadTickets = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error)
            : "Unable to load tickets.";
        throw new Error(message);
      }

      if (!Array.isArray(payload)) {
        throw new Error("Invalid tickets payload.");
      }

      const parsed = payload
        .map((raw) => {
          try {
            return toTicket(raw as RawTicket);
          } catch {
            return null;
          }
        })
        .filter((ticket): ticket is Ticket => ticket !== null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      setTickets(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to load tickets.";
      setError(message);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const matchedTickets = useMemo(() => {
    const normalizedEmail = lookupEmail.toLowerCase().trim();
    const normalizedQuery = query.toLowerCase().trim();

    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) {
        return false;
      }

      if (normalizedEmail && ticket.customerEmail.toLowerCase().trim() !== normalizedEmail) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        ticket.id.toLowerCase().includes(normalizedQuery) ||
        ticket.subject.toLowerCase().includes(normalizedQuery) ||
        ticket.customerName.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [tickets, lookupEmail, query, statusFilter]);

  const metrics = useMemo(() => {
    const total = matchedTickets.length;
    const open = matchedTickets.filter((ticket) => ticket.status === "OPEN").length;
    const resolved = matchedTickets.filter((ticket) => ticket.status === "RESOLVED").length;
    const categorized = matchedTickets.filter((ticket) => ticket.category !== null).length;
    const flaggedHigh = matchedTickets.filter((ticket) => ticket.priority === "HIGH").length;

    return { total, open, resolved, categorized, flaggedHigh };
  }, [matchedTickets]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !isNonEmpty(customerName) ||
      !isNonEmpty(customerEmail) ||
      !isNonEmpty(subject) ||
      !isNonEmpty(description)
    ) {
      setError("All fields are required to submit a ticket.");
      return;
    }

    setSubmitState("saving");
    setError("");
    let created = false;

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          description,
          customerName,
          customerEmail,
          language,
        }),
      });

      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error)
            : "Unable to create ticket.";
        throw new Error(message);
      }

      await loadTickets();
      created = true;
      setSubmitState("success");
      setLookupEmail(customerEmail);
      setSubject("");
      setDescription("");
      setLanguage("auto");
      setTimeout(() => setSubmitState("idle"), 2500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to create ticket.";
      setError(message);
      setSubmitState("error");
    } finally {
      if (!created) {
        setSubmitState("idle");
      }
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardContent className="py-6">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Self-Service Portal</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">My Support Tickets</h1>
            <p className="mt-1 text-sm text-slate-600">
              Submit a ticket and keep your issue history visible in one streamlined workspace.
            </p>
          </CardContent>
        </Card>
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.total}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.open}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Resolved</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.resolved}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI Classified</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.categorized}</p>
            <p className="mt-1 text-xs text-slate-500">High priority: {metrics.flaggedHigh}</p>
          </CardHeader>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="border-slate-200/80">
          <CardHeader>
            <h2 className="text-xl font-semibold text-slate-900">Create support ticket</h2>
            <p className="mt-1 text-sm text-slate-500">
              You can write in any language. Backend will normalize ticket content to English.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Your Name</label>
                <Input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  type="text"
                  required
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <Input
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  type="email"
                  required
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Language</label>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  type="text"
                  required
                  placeholder="Cannot login to my account"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  rows={4}
                  placeholder="Explain the issue clearly, include steps to reproduce."
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitState === "saving"}>
                  {submitState === "saving" ? "Submitting..." : "Create Ticket"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCustomerName("");
                    setCustomerEmail("");
                    setSubject("");
                    setDescription("");
                    setLanguage("auto");
                    setSubmitState("idle");
                  }}
                >
                  Reset Form
                </Button>
              </div>
            </form>

            {submitState === "success" ? (
              <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                Ticket created. You can track it in your list below.
              </p>
            ) : null}
            {submitState === "error" ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <p className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-500">
              Team view: use back-office dashboard for full operations.
            </p>
            <Link href="/backoffice" className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline">
              Go to Back Office Dashboard
            </Link>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Track by Email</h2>
                <p className="mt-1 text-sm text-slate-500">Filter your tickets and monitor progress.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadTickets}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Enter your email</label>
              <Input
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                type="email"
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by id, subject or customer"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "OPEN" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("OPEN")}
                >
                  Open
                </Button>
                <Button
                  variant={statusFilter === "RESOLVED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("RESOLVED")}
                >
                  Resolved
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading tickets...</p>
            ) : error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : matchedTickets.length === 0 ? (
              <p className="text-sm text-slate-500">No tickets found for this filter.</p>
            ) : (
              <div className="space-y-3">
                {matchedTickets.map((ticket) => {
                  const priorityVariant =
                    ticket.priority === "HIGH" ? "warning" : ticket.priority === "LOW" ? "success" : "outline";

                  return (
                    <article
                      key={ticket.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{ticket.id}</p>
                          <p className="mt-1 text-sm text-slate-700">{ticket.subject}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={ticket.status === "OPEN" ? "warning" : "success"}>{ticket.status}</Badge>
                          <span className="text-xs text-slate-500">Updated {formatDate(ticket.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={ticket.category ? "outline" : "default"}>{ticket.category ?? "No Category"}</Badge>
                        <Badge variant={priorityVariant}>{ticket.priority ?? "No Priority"}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">{ticket.customerEmail}</Badge>
                      </div>
                      {ticket.issueSummary ? <p className="mt-3 text-sm text-slate-600">Summary: {ticket.issueSummary}</p> : null}
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
