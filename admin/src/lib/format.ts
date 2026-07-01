export const dateFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
export const dateOnlyFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

export const currencyIDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return '-';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (isNaN(d.getTime())) return '-';
  return dateFmt.format(d);
}

export function formatDateOnly(v: string | Date | null | undefined): string {
  if (!v) return '-';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (isNaN(d.getTime())) return '-';
  return dateOnlyFmt.format(d);
}
