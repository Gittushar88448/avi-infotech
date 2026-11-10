const LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", ACCEPTED: "Accepted", REJECTED: "Rejected", CONVERTED: "Billed" };
export const QUOTE_STATUS_LABEL = LABEL;
export function QuoteStatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}><span className="dot" />{LABEL[status] ?? status}</span>;
}
