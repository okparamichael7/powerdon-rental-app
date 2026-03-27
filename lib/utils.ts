import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting helpers (using UTC to avoid hydration mismatches between server/client)
export function formatTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDate(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Number formatting helper (using fixed locale to avoid hydration mismatches)
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// Currency formatting helper
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${symbol}${formatNumber(amount)}`;
}
