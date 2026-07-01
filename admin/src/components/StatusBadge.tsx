interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const map: Record<string, string> = {
    PENDING: 'badge-yellow',
    VERIFIED: 'badge-green',
    REJECTED: 'badge-red',
    ACTIVE: 'badge-green',
    INACTIVE: 'badge-slate',
    BANNED: 'badge-red',
    PENDING_VERIFICATION: 'badge-yellow',
    DRAFT: 'badge-slate',
    PUBLISHED: 'badge-green',
    CLOSED: 'badge-slate',
    EXPIRED: 'badge-red',
    APPLIED: 'badge-blue',
    REVIEWED: 'badge-blue',
    SHORTLISTED: 'badge-blue',
    INTERVIEW: 'badge-blue',
    ACCEPTED: 'badge-green',
    CANCELLED: 'badge-slate',
  };
  return <span className={map[status] ?? 'badge-slate'}>{status}</span>;
}
