"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Ticket, TicketCategory, TicketPriority } from "@/types/ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RawTicket = Omit<Ticket, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type TicketStatusFilter = "all" | "OPEN" | "RESOLVED";

type MetricState = {
  total: number;
  openCount: number;
  resolvedCount: number;
  aiClassified: number;
  highPriority: number;
  technicalTickets: number;
};

const VALID_CATEGORIES = ["BILLING", "TECHNICAL", "ACCOUNT", "COMPLAINT", "FEATURE", "OTHER"] as const;
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const VALID_STATUSES = ["OPEN", "RESOLVED"] as const;

const CATEGORY_SET = new Set<string>(VALID_CATEGORIES);
const PRIORITY_SET = new Set<string>(VALID_PRIORITIES);
const STATUS_SET = new Set<string>(VALID_STATUSES);

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
  return typeof value === "string" && STATUS_SET.has(value) ? (value as Ticket["status"]) : null;
}

function parseCategory(value: unknown): Ticket["category"] {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && CATEGORY_SET.has(value)
    ? (value as TicketCategory)
    : null;
}

function parsePriority(value: unknown): Ticket["priority"] {
  if (value === null) {
    return null;
  }

  return typeof value === "string" && PRIORITY_SET.has(value)
    ? (value as TicketPriority)
    : null;
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

export default function BackofficeDashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

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
        .map((item) => {
          try {
            return toTicket(item as RawTicket);
          } catch {
            return null;
          }
        })
        .filter((ticket): ticket is Ticket => ticket !== null)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      setTickets(parsed);
      if (selectedTicketId === null && parsed.length > 0) {
        setSelectedTicketId(parsed[0].id);
      }
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

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        ticket.id.toLowerCase().includes(normalizedQuery) ||
        ticket.customerName.toLowerCase().includes(normalizedQuery) ||
        ticket.subject.toLowerCase().includes(normalizedQuery) ||
        ticket.customerEmail.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [tickets, query, statusFilter]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? filteredTickets[0] ?? null,
    [filteredTickets, selectedTicketId],
  );

  const metrics = useMemo<MetricState>(() => {
    const openCount = filteredTickets.filter((ticket) => ticket.status === "OPEN").length;
    const resolvedCount = filteredTickets.filter((ticket) => ticket.status === "RESOLVED").length;
    const aiClassified = filteredTickets.filter(
      (ticket) => ticket.category !== null && ticket.priority !== null,
    ).length;
    const highPriority = filteredTickets.filter((ticket) => ticket.priority === "HIGH").length;
    const technicalTickets = filteredTickets.filter((ticket) => ticket.category === "TECHNICAL").length;

    return {
      total: filteredTickets.length,
      openCount,
      resolvedCount,
      aiClassified,
      highPriority,
      technicalTickets,
    };
  }, [filteredTickets]);

  const aiCoverage = metrics.total === 0 ? 0 : Math.round((metrics.aiClassified / metrics.total) * 100);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Card className="overflow-hidden border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="space-y-2 py-6">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Back Office</p>
            <h1 className="text-3xl font-semibold text-slate-900">Support Dashboard</h1>
            <p className="text-sm text-slate-600">Operational view for triage, workflows, and AI-assisted routing visibility.</p>
          </CardContent>
        </Card>
      </header>

      <section className="mb-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Workspace Controls</h2>
                <p className="text-sm text-slate-500">Search and filter to focus on critical tickets.</p>
              </div>
              <Button variant="outline" onClick={loadTickets}>
                Refresh data
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search id, subject, customer, email"
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
          </CardHeader>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Tickets</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-500">Open</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-500">Resolved</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.resolvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-slate-500">AI Classified</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{metrics.aiClassified}</p>
            <p className="mt-1 text-xs text-slate-500">{aiCoverage}% coverage</p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Critical Queue</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-slate-900">{metrics.highPriority}</p>
            <p className="text-sm text-slate-600">Tickets marked HIGH priority</p>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-rose-500"
                style={{ width: `${Math.min((metrics.highPriority / Math.max(metrics.total, 1)) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Technical Queue</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-slate-900">{metrics.technicalTickets}</p>
            <p className="text-sm text-slate-600">Tickets classified as technical</p>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min((metrics.technicalTickets / Math.max(metrics.total, 1)) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Recent Tickets</h2>
                <p className="text-sm text-slate-500">Select a row to inspect ticket context.</p>
              </div>
              <Link href="/tickets" className="text-sm font-medium text-blue-700 hover:underline">
                Open classification workspace
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading ticket data...</p>
            ) : error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : filteredTickets.length === 0 ? (
              <p className="text-sm text-slate-500">No tickets found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">ID</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Customer</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Subject</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Priority</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-500">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map((ticket) => {
                      const priorityVariant =
                        ticket.priority === "HIGH"
                          ? "warning"
                          : ticket.priority === "LOW"
                            ? "success"
                            : "outline";

                      return (
                        <tr
                          key={ticket.id}
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                            selectedTicketId === ticket.id ? "bg-blue-50/60" : ""
                          }`}
                        >
                          <td className="px-3 py-3 text-slate-700">{ticket.id}</td>
                          <td className="px-3 py-3 text-slate-700">
                            <div className="space-y-0.5">
                              <p>{ticket.customerName}</p>
                              <p className="text-xs text-slate-500">{ticket.customerEmail}</p>
                            </div>
                          </td>
                          <td className="max-w-md px-3 py-3 text-slate-700">{ticket.subject}</td>
                          <td className="px-3 py-3 text-slate-700">
                            <Badge variant={ticket.category ? "outline" : "default"}>{ticket.category ?? "-"}</Badge>
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            <Badge variant={priorityVariant}>{ticket.priority ?? "-"}</Badge>
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            <Badge variant={ticket.status === "OPEN" ? "warning" : "success"}>{ticket.status}</Badge>
                          </td>
                          <td className="px-3 py-3 text-slate-500">{formatDate(ticket.updatedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900">Ticket Inspector</h2>
            <p className="text-sm text-slate-500">Single-click a row for full context.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selectedTicket ? (
              <p className="text-slate-500">Select a ticket from the table.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Ticket</p>
                  <p className="text-base font-semibold text-slate-900">{selectedTicket.id}</p>
                  <p className="text-slate-600">{selectedTicket.subject}</p>
                </div>

                <p className="text-slate-600">{selectedTicket.description}</p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant={selectedTicket.status === "OPEN" ? "warning" : "success"}>{selectedTicket.status}</Badge>
                  <Badge variant={selectedTicket.category ? "outline" : "default"}>
                    {selectedTicket.category ?? "No category"}
                  </Badge>
                  <Badge
                    variant={
                      selectedTicket.priority === "HIGH"
                        ? "warning"
                        : selectedTicket.priority === "LOW"
                          ? "success"
                          : "outline"
                    }
                  >
                    {selectedTicket.priority ?? "No priority"}
                  </Badge>
                </div>

                <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">Customer</p>
                  <p>{selectedTicket.customerName}</p>
                  <p className="text-slate-500">{selectedTicket.customerEmail}</p>
                </div>

                {selectedTicket.issueSummary ? (
                  <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/50 p-3 text-slate-700">
                    <p className="font-medium">AI summary</p>
                    <p>{selectedTicket.issueSummary}</p>
                  </div>
                ) : null}

                {selectedTicket.suggestedResponse ? (
                  <div className="space-y-2 rounded-md border border-emerald-100 bg-emerald-50/50 p-3 text-slate-700">
                    <p className="font-medium">Suggested response</p>
                    <p>{selectedTicket.suggestedResponse}</p>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
