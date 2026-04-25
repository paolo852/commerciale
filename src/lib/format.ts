// ============================================================
// Helper di formattazione italiana
// ============================================================

const eurFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurFormatterCents = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatEUR(value: number, withCents = false): string {
  return (withCents ? eurFormatterCents : eurFormatter).format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Le date arrivano come "YYYY-MM-DD" o ISO timestamp
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

/** Converte un Date o ISO in stringa "YYYY-MM-DD" per gli input type="date". */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length >= 10 && value[4] === '-' && value[7] === '-') {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
