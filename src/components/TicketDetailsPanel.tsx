import type { Ticket } from "@/types/ticket";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { TicketCategory, TicketPriority } from "@/types/ticket";

type ClassificationResult = {
  category: TicketCategory;
  priority: TicketPriority;
  issueSummary: string;
  suggestedResponse: string;
};

type TicketDetailsPanelProps = {
  selectedTicket: Ticket | null;
  classification: ClassificationResult | null;
  loading: boolean;
  error: string;
};

export function TicketDetailsPanel({
  selectedTicket,
  classification,
  loading,
  error,
}: TicketDetailsPanelProps) {
  if (!selectedTicket) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Ticket Intelligence</h2>
          <p className="mt-1 text-sm text-slate-500">Pick a ticket to inspect and run classification.</p>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Select a row from the table to view full ticket context.
          </p>
        </CardContent>
      </Card>
    );
  }

  const priorityVariant =
    selectedTicket.priority === "HIGH"
      ? "warning"
      : selectedTicket.priority === "LOW"
        ? "success"
        : "outline";

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-slate-900">Ticket Intelligence</h2>
        <p className="mt-1 text-sm text-slate-500">Instant context and AI analysis.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ticket</p>
          <p className="text-base font-semibold text-slate-900">{selectedTicket.id}</p>
          <p className="text-sm text-slate-700">{selectedTicket.subject}</p>
        </div>

        <p className="text-slate-700">{selectedTicket.description}</p>

        <div className="flex flex-wrap gap-2">
          <Badge variant={selectedTicket.status === "OPEN" ? "warning" : "success"}>{selectedTicket.status}</Badge>
          <Badge variant={selectedTicket.category ? "outline" : "default"}>{selectedTicket.category ?? "Unclassified"}</Badge>
          <Badge variant={priorityVariant}>{selectedTicket.priority ?? "Unrated"}</Badge>
        </div>

        {loading ? <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">Running classification model...</p> : null}

        {error && !loading ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        {classification && !loading && !error ? (
          <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-slate-700">
            <p>
              <span className="font-medium text-slate-600">AI Category:</span> {classification.category}
            </p>
            <p>
              <span className="font-medium text-slate-600">AI Priority:</span> {classification.priority}
            </p>
            <p className="text-sm">
              <span className="font-medium text-slate-600">Issue Summary:</span>
              <br />
              {classification.issueSummary}
            </p>
            <p className="text-sm">
              <span className="font-medium text-slate-600">Suggested Response:</span>
              <br />
              {classification.suggestedResponse}
            </p>
          </div>
        ) : null}

        {!classification && !loading && !error ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Run AI classification to see suggested category, priority and support reply.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
