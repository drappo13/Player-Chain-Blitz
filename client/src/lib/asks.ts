// One ask per visit: the name ask, the install ask and the notifications ask never stack up.
// Each ask also has its own limits (stored per device).

const SESSION_KEY = "pcb-asked-this-visit";

export function askedThisVisit(): boolean {
  try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return false; }
}

export function markAsked(kind: string) {
  try { sessionStorage.setItem(SESSION_KEY, kind); } catch { /* ignore */ }
}

type Record_ = { count: number; lastDay: string; never?: boolean };
const recKey = (kind: string) => `pcb-ask-${kind}`;

export function askRecord(kind: string): Record_ {
  try { return { count: 0, lastDay: "", ...JSON.parse(localStorage.getItem(recKey(kind)) || "{}") }; } catch { return { count: 0, lastDay: "" }; }
}

export function noteAsk(kind: string, today: string, extra: Partial<Record_> = {}) {
  const r = askRecord(kind);
  try { localStorage.setItem(recKey(kind), JSON.stringify({ ...r, count: r.count + 1, lastDay: today, ...extra })); } catch { /* ignore */ }
  markAsked(kind);
}

export function neverAsk(kind: string) {
  const r = askRecord(kind);
  try { localStorage.setItem(recKey(kind), JSON.stringify({ ...r, never: true })); } catch { /* ignore */ }
}
