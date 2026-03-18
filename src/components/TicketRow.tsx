import type { MouseEvent } from "react";
import type { Ticket } from "@/types/ticket";
import { ClassifyButton } from "@/components/ClassifyButton";
import { Badge } from "@/components/ui/badge";

type TicketRowProps = {
  ticket: Ticket;
  onClassify: (event: MouseEvent<HTMLButtonElement>) => void;
  isClassifying: boolean;
  onSelect: () => void;
  isSelected: boolean;
};

export function TicketRow({
  ticket,
  onClassify,
  isClassifying,
  onSelect,
  isSelected,
}: TicketRowProps) {
  const handleClassifyClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClassify(event);
  };

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b border-slate-100 transition-all hover:bg-slate-50/80 ${
        isSelected ? "bg-blue-50/80" : ""
      }`}
    >
      <td className="px-4 py-3 text-slate-700">
        <div>
          <p className="text-xs text-slate-500">Ticket</p>
          <p className="font-medium text-slate-900">{ticket.id}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-900">
        <p className="font-medium">{ticket.subject}</p>
        <p className="mt-1 max-w-[320px] truncate text-xs text-slate-500">{ticket.customerName}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={ticket.category ? "outline" : "default"}>{ticket.category ?? "Unclassified"}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={ticket.priority === "HIGH" ? "warning" : ticket.priority === "LOW" ? "success" : "outline"}
        >
          {ticket.priority ?? "Unrated"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={ticket.status === "OPEN" ? "warning" : "success"}>{ticket.status}</Badge>
      </td>
      <td className="px-4 py-3">
        <ClassifyButton onClick={handleClassifyClick} loading={isClassifying} />
      </td>
    </tr>
  );
}
