import type { Ticket } from "@/types/ticket";
import { TicketRow } from "@/components/TicketRow";

type TicketTableProps = {
  tickets: Ticket[];
  onClassify: (ticket: Ticket) => void;
  loadingTicketId: string | null;
  onSelectTicket: (ticket: Ticket) => void;
  selectedTicketId: string | null;
};

export function TicketTable({
  tickets,
  onClassify,
  loadingTicketId,
  onSelectTicket,
  selectedTicketId,
}: TicketTableProps) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No tickets found for current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50/80 text-left">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-600">Ticket</th>
            <th className="px-4 py-3 font-medium text-slate-600">Subject</th>
            <th className="px-4 py-3 font-medium text-slate-600">Category</th>
            <th className="px-4 py-3 font-medium text-slate-600">Priority</th>
            <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 font-medium text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onClassify={() => onClassify(ticket)}
              isClassifying={loadingTicketId === ticket.id}
              onSelect={() => onSelectTicket(ticket)}
              isSelected={selectedTicketId === ticket.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
