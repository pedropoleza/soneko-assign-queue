import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Adaptive datetime: today = HH:MM, this week = "Ter 14:32", older = "12/05 14:32"
export function formatAdaptive(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const ageDays = (now.getTime() - d.getTime()) / 86400000;
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  if (ageDays < 7) {
    const dow = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return `${dow.charAt(0).toUpperCase() + dow.slice(1)} ${time}`;
  }
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`;
}

// True if iso is within the last `seconds` seconds
export function isFresh(iso: string | null | undefined, seconds = 60): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < seconds * 1000;
}

// Deterministic color from a string (used for avatar fallbacks)
export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const palette = [
    'bg-brand-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
    'bg-violet-600', 'bg-cyan-600', 'bg-fuchsia-600', 'bg-indigo-600',
    'bg-orange-600', 'bg-teal-600', 'bg-pink-600',
  ];
  return palette[Math.abs(h) % palette.length];
}
