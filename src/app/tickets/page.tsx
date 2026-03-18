"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ticket, TicketCategory, TicketPriority } from "@/types/ticket";
import { TicketTable } from "@/components/TicketTable";
import { TicketDetailsPanel } from "@/components/TicketDetailsPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ClassificationResult = {
  category: TicketCategory;
  priority: TicketPriority;
  issueSummary: string;
  suggestedResponse: string;
};

type RawTicket = Omit<Ticket, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type TicketStatusFilter = "all" | "OPEN" | "RESOLVED";
type TicketPriorityFilter = "all" | TicketPriority;
type TicketSort = "newest" | "oldest" | "priority";

const VALID_CATEGORIES: TicketCategory[] = [
  "BILLING",
  "TECHNICAL",
  "ACCOUNT",
  "COMPLAINT",
  "FEATURE",
  "OTHER",
];

const VALID_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH"];

const CATEGORY_SET = new Set<string>(VALID_CATEGORIES);
const PRIORITY_SET = new Set<string>(VALID_PRIORITIES);

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTicketCategory(value: unknown): TicketCategory | null {
  if (value === null) return null;
  return typeof value === "string" && CATEGORY_SET.has(value) ? (value as TicketCategory) : null;
}

function parseTicketPriority(value: unknown): TicketPriority | null {
  if (value === null) return null;
  return typeof value === "string" && PRIORITY_SET.has(value) ? (value as TicketPriority) : null;
}

function parseStatus(value: unknown): "OPEN" | "RESOLVED" | null {
  return value === "OPEN" || value === "RESOLVED" ? value : null;
}

function toTicket(raw: RawTicket): Ticket {
  const createdAt = parseDate(raw.createdAt);
  const updatedAt = parseDate(raw.updatedAt);

  if (
    !isString(raw.id) ||
    !isString(raw.subject) ||
    !isString(raw.description) ||
    !isString(raw.customerName) ||
    !isString(raw.customerEmail)
  ) {
    throw new Error("Invalid ticket payload.");
  }

  const status = parseStatus(raw.status);
  const category = parseTicketCategory(raw.category);
  const priority = parseTicketPriority(raw.priority);

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
    category,
    priority,
    issueSummary: typeof raw.issueSummary === "string" ? raw.issueSummary : null,
    suggestedResponse: raw.suggestedResponse,
    createdAt,
    updatedAt,
  };
}

function priorityOrder(priority: TicketPriority | null): number {
  if (priority === "HIGH") return 0;
  if (priority === "MEDIUM") return 1;
  return 2;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoadingTickets, setIsLoadingTickets] = useState<boolean>(true);
  const [ticketsError, setTicketsError] = useState<string>("");

  const [query, setQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriorityFilter>("all");
  const [sortBy, setSortBy] = useState<TicketSort>("newest");

  useEffect(() => {
    const fetchTickets = async () => {
      setIsLoadingTickets(true);
      setTicketsError("");

      try {
        const response = await fetch("/api/tickets", { cache: "no-store" });
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const errorText =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : "Unable to load tickets.";
          throw new Error(errorText);
        }

        if (!Array.isArray(payload)) {
          throw new Error("Invalid tickets payload.");
        }

        const parsed = payload.reduce<Ticket[]>((accumulator, ticket) => {
          try {
            accumulator.push(toTicket(ticket as RawTicket));
          } catch {
            // Ignore malformed rows.
          }
          return accumulator;
        }, []);

        setTickets(parsed);
        if (parsed.length > 0 && selectedTicketId === null) {
          setSelectedTicketId(parsed[0].id);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unable to load tickets. Please retry.";
        setTickets([]);
        setTicketsError(message);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    void fetchTickets();
  }, [selectedTicketId]);

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    const filtered = tickets.filter((ticket) => {
      const matchesText =
        !normalizedQuery ||
        ticket.id.toLowerCase().includes(normalizedQuery) ||
        ticket.subject.toLowerCase().includes(normalizedQuery) ||
        ticket.customerName.toLowerCase().includes(normalizedQuery) ||
        ticket.customerEmail.toLowerCase().includes(normalizedQuery);

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || (ticket.priority ?? "") === priorityFilter;

      return matchesText && matchesStatus && matchesPriority;
    });

    filtered.sort((a, b) => {
      if (sortBy === "oldest") {
        return a.updatedAt.getTime() - b.updatedAt.getTime();
      }

      if (sortBy === "priority") {
        return priorityOrder(a.priority) - priorityOrder(b.priority);
      }

      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return filtered;
  }, [tickets, query, statusFilter, priorityFilter, sortBy]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedTicketId) ?? filteredTickets[0] ?? null,
    [filteredTickets, selectedTicketId],
  );

  const metrics = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === "OPEN").length;
    const resolved = tickets.filter((ticket) => ticket.status === "RESOLVED").length;
    const highPriority = tickets.filter((ticket) => ticket.priority === "HIGH").length;
    const technical = tickets.filter((ticket) => ticket.category === "TECHNICAL").length;

    return {
      total: tickets.length,
      open,
      resolved,
      highPriority,
      technical,
    };
  }, [tickets]);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicketId(ticket.id);
    setClassification(null);
    setErrorMessage("");
  };

  const handleClassify = async (ticket: Ticket) => {
    setLoadingTicketId(ticket.id);
    setSelectedTicketId(ticket.id);
    setErrorMessage("");
    setClassification(null);

    try {
      const response = await fetch("/api/classify-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
        }),
      });

      const payload = (await response.json()) as unknown;

      if (
        payload &&
        typeof payload === "object" &&
        "category" in payload &&
        "priority" in payload &&
        "issueSummary" in payload &&
        "suggestedResponse" in payload
      ) {
        const result = payload as ClassificationResult;

        if (
          !response.ok ||
          typeof result.category !== "string" ||
          typeof result.priority !== "string" ||
          typeof result.issueSummary !== "string" ||
          typeof result.suggestedResponse !== "string" ||
          !CATEGORY_SET.has(result.category) ||
          !PRIORITY_SET.has(result.priority)
        ) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : "Invalid classification response format.";

          throw new Error(message);
        }

        setTickets((prev) =>
          prev.map((item) =>
            item.id === ticket.id
              ? {
                  ...item,
                  category: result.category,
                  priority: result.priority,
                  issueSummary: result.issueSummary,
                  suggestedResponse: result.suggestedResponse,
                }
              : item,
          ),
        );
        setClassification(result);
      } else {
        throw new Error("Invalid classification response format.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to classify ticket. Please retry.";
      setErrorMessage(message);
    } finally {
      setLoadingTicketId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="bg-gradient-to-br from-blue-50 to-cyan-50">
          <p className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 shadow-sm">
            Operations Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tickets Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Support tickets overview with AI classification tools.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total" value={metrics.total} />
            <Stat label="Open" value={metrics.open} />
            <Stat label="Resolved" value={metrics.resolved} />
            <Stat label="High Priority" value={metrics.highPriority} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-3 space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search id, subject, customer, email"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
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
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Priority</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={priorityFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriorityFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={priorityFilter === "HIGH" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setPriorityFilter("HIGH")}
                >
                  High
                </Button>
                <Button
                  variant={priorityFilter === "MEDIUM" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setPriorityFilter("MEDIUM")}
                >
                  Medium
                </Button>
                <Button
                  variant={priorityFilter === "LOW" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setPriorityFilter("LOW")}
                >
                  Low
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sort</p>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === "newest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("newest")}
                >
                  Newest
                </Button>
                <Button
                  variant={sortBy === "oldest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("oldest")}
                >
                  Oldest
                </Button>
                <Button
                  variant={sortBy === "priority" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("priority")}
                >
                  Urgency
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Showing <span className="font-semibold text-slate-700">{filteredTickets.length}</span> of {tickets.length}
            </span>
            <span>•</span>
            <span>{isLoadingTickets ? "Syncing" : "Live"}</span>
            {ticketsError ? <span className="text-rose-600">• {ticketsError}</span> : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Ticket Queue</h2>
                <p className="text-sm text-slate-500">Tap a row to inspect + classify.</p>
              </div>
              <Badge variant="outline">{statusFilter !== "all" ? statusFilter : "All statuses"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTickets ? (
              <p className="text-sm text-slate-500">Loading tickets...</p>
            ) : ticketsError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{ticketsError}</p>
            ) : (
              <TicketTable
                tickets={filteredTickets}
                selectedTicketId={selectedTicket?.id ?? null}
                loadingTicketId={loadingTicketId}
                onClassify={handleClassify}
                onSelectTicket={handleSelectTicket}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <TicketDetailsPanel
            selectedTicket={selectedTicket}
            classification={classification}
            loading={loadingTicketId !== null}
            error={errorMessage}
          />

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900">Queue Snapshot</h3>
              <p className="text-xs text-slate-500">Workload distribution across teams.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Technical Tickets</span>
                <span className="font-semibold text-slate-900">{metrics.technical}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width: `${Math.min((metrics.technical / Math.max(metrics.total, 1)) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/80 p-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
