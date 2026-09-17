import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export function calculateLeadTier(score: number) {
  if (score > 80) return "HOT";
  if (score > 50) return "WARM";
  return "COLD";
}

export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    HOT: 'bg-red-100 text-red-700',
    WARM: 'bg-yellow-100 text-yellow-700',
    COLD: 'bg-blue-100 text-blue-700',
  };
  return colors[tier] || 'bg-gray-100 text-gray-700';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-700',
    ENGAGED: 'bg-indigo-100 text-indigo-700',
    QUALIFIED: 'bg-green-100 text-green-700',
    MEETING_SET: 'bg-emerald-100 text-emerald-700',
    WON: 'bg-green-200 text-green-800',
    LOST: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}