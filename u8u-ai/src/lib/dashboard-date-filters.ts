/** Shared date presets for dashboard leads / conversations filters (client-side). */

export type DatePreset =
  | 'all'
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'custom';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Monday-start week (common for India). */
export function getDateRangeFromPreset(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (preset === 'all') return { from: null, to: null };

  if (preset === 'today') {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (preset === 'tomorrow') {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return { from: startOfDay(t), to: endOfDay(t) };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === 'this_week') {
    const start = new Date(now);
    const dow = start.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = (dow + 6) % 7;
    start.setDate(start.getDate() - diffToMon);
    return { from: startOfDay(start), to: endOfDay(now) };
  }
  if (preset === 'last_week') {
    const end = new Date(now);
    const dow = end.getDay();
    const daysFromMon = (dow + 6) % 7;
    end.setDate(end.getDate() - daysFromMon - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { from: startOfDay(start), to: endOfDay(end) };
  }
  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(start), to: endOfDay(now) };
  }
  if (preset === 'custom' && customFrom && customTo) {
    return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
  }
  return { from: null, to: null };
}
