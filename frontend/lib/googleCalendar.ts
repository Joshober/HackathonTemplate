/**
 * Google Calendar OAuth + free/busy helper.
 *
 * Each team member must individually connect their Google Calendar.
 * Tokens are stored in localStorage under a per-user key so that
 * different members on the same device don't collide.
 *
 * ─── Setup ───────────────────────────────────────────────────────────────────
 * 1. Go to https://console.cloud.google.com/
 * 2. Create an OAuth 2.0 Client ID (Web application)
 * 3. Add http://localhost:3000 to Authorized JavaScript origins
 * 4. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = (userId: string) => `gcal_token_${userId}`;
const TOKEN_EXPIRY_KEY = (userId: string) => `gcal_expiry_${userId}`;

function ls(key: string): string | null {
  try { return typeof window !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}
function lsSet(key: string, val: string) {
  try { if (typeof window !== 'undefined') localStorage.setItem(key, val); } catch { /* */ }
}
function lsDel(key: string) {
  try { if (typeof window !== 'undefined') localStorage.removeItem(key); } catch { /* */ }
}

/** Returns the stored access token if it's still valid (5-min buffer). */
export function getStoredCalendarToken(userId: string): string | null {
  const token = ls(TOKEN_KEY(userId));
  const expiry = ls(TOKEN_EXPIRY_KEY(userId));
  if (!token || !expiry) return null;
  const expiryMs = parseInt(expiry, 10);
  if (Date.now() > expiryMs - 5 * 60 * 1000) {
    lsDel(TOKEN_KEY(userId));
    lsDel(TOKEN_EXPIRY_KEY(userId));
    return null;
  }
  return token;
}

/** Saves a Google access token with its expiry time. */
export function storeCalendarToken(userId: string, token: string, expiresInSeconds: number) {
  lsSet(TOKEN_KEY(userId), token);
  lsSet(TOKEN_EXPIRY_KEY(userId), String(Date.now() + expiresInSeconds * 1000));
}

/** Clears the stored calendar token for a user. */
export function clearCalendarToken(userId: string) {
  lsDel(TOKEN_KEY(userId));
  lsDel(TOKEN_EXPIRY_KEY(userId));
}

/** Opens a Google OAuth popup and resolves with the access token. */
export function requestCalendarAccess(): Promise<{ token: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set in .env.local'));
      return;
    }
    if (typeof window === 'undefined') {
      reject(new Error('Calendar auth requires a browser environment'));
      return;
    }

    // Use Google Identity Services (GSI) if available
    if ((window as unknown as { google?: { accounts?: { oauth2?: unknown } } }).google?.accounts?.oauth2) {
      const gsi = (window as unknown as {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: (config: {
                client_id: string;
                scope: string;
                callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
              }) => { requestAccessToken: () => void };
            };
          };
        };
      }).google.accounts.oauth2;

      const client = gsi.initTokenClient({
        client_id: CLIENT_ID,
        scope: CALENDAR_SCOPE,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            reject(new Error(resp.error ?? 'No access token returned'));
          } else {
            resolve({ token: resp.access_token, expiresIn: resp.expires_in ?? 3600 });
          }
        },
      });
      client.requestAccessToken();
      return;
    }

    // Fallback: load GSI script dynamically
    const existing = document.getElementById('gsi-script');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => requestCalendarAccess().then(resolve).catch(reject);
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    } else {
      existing.addEventListener('load', () => requestCalendarAccess().then(resolve).catch(reject));
    }
  });
}

export interface FreeBusySlot {
  start: string;
  end: string;
}

export interface CalendarFreeBusyResult {
  userId: string;
  connected: boolean;
  busySlots: FreeBusySlot[];
  error?: string;
}

/**
 * Fetches free/busy info for a single user between two ISO date strings.
 * Requires a valid access token.
 */
export async function fetchFreeBusy(
  token: string,
  timeMin: string,
  timeMax: string,
): Promise<FreeBusySlot[]> {
  const body = {
    timeMin,
    timeMax,
    items: [{ id: 'primary' }],
  };
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Calendar API error ${res.status}`);
  }
  const data = await res.json() as { calendars?: { primary?: { busy?: FreeBusySlot[] } } };
  return data?.calendars?.primary?.busy ?? [];
}

/**
 * Checks free/busy for all team members who have connected their calendar.
 * Returns a summary string like:
 *   "✅ All 3 members are free from Jun 14–16"
 *   "⚠️ Sarah is busy Jun 15 (2 conflicts)"
 */
export async function checkTeamAvailability(
  memberUserIds: string[],
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
): Promise<{ summary: string; results: CalendarFreeBusyResult[] }> {
  const timeMin = `${startDate}T00:00:00Z`;
  const timeMax = `${endDate}T23:59:59Z`;

  const results: CalendarFreeBusyResult[] = await Promise.all(
    memberUserIds.map(async (userId) => {
      const token = getStoredCalendarToken(userId);
      if (!token) {
        return { userId, connected: false, busySlots: [] };
      }
      try {
        const busySlots = await fetchFreeBusy(token, timeMin, timeMax);
        return { userId, connected: true, busySlots };
      } catch (e) {
        return { userId, connected: true, busySlots: [], error: e instanceof Error ? e.message : 'Error' };
      }
    })
  );

  const connected = results.filter((r) => r.connected);
  const busy = results.filter((r) => r.busySlots.length > 0);

  let summary = '';
  if (connected.length === 0) {
    summary = `📅 No team members have connected their Google Calendar yet (${startDate} to ${endDate}).`;
  } else if (busy.length === 0) {
    summary = `✅ All ${connected.length} connected members appear free from ${startDate} to ${endDate}!`;
  } else {
    const busyNames = busy.map((r) => r.userId).join(', ');
    summary = `⚠️ ${busy.length} member(s) have conflicts between ${startDate}–${endDate}: ${busyNames}. Consider checking alternative dates.`;
  }

  return { summary, results };
}
