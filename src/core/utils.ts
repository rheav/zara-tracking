/* ==========================================================================
   Meta Tracking — Utility Functions
   Cookie + event-id + external-id helpers. SSR-safe (guards window/document).
   ========================================================================== */

const EXTERNAL_ID_KEY = "meta_external_id";
const EXTERNAL_ID_COOKIE_DAYS = 365;

export function generateEventId(eventName: string): string {
  const t = Date.now();
  const r = Math.random().toString(36).substring(2, 11);
  return `${eventName}_${t}_${r}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function setCookie(name: string, value: string, days: number): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )};expires=${expires};path=/;SameSite=Lax`;
}

export function getFbc(): string | null {
  return getCookie("_fbc");
}

export function getFbp(): string | null {
  return getCookie("_fbp");
}

/**
 * Resolve persistent visitor id.
 * Priority: window.__EXTERNAL_ID__ → localStorage → cookie → fresh UUID.
 * Persists back to localStorage + cookie.
 */
export function getOrCreateExternalId(): string {
  let id: string | null =
    (typeof window !== "undefined" &&
      (window as unknown as { __EXTERNAL_ID__?: string }).__EXTERNAL_ID__) ||
    null;

  if (!id) {
    try {
      id = localStorage.getItem(EXTERNAL_ID_KEY);
    } catch {
      // localStorage blocked
    }
  }
  if (!id) id = getCookie(EXTERNAL_ID_KEY);

  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  try {
    localStorage.setItem(EXTERNAL_ID_KEY, id);
  } catch {
    // localStorage blocked
  }
  setCookie(EXTERNAL_ID_KEY, id, EXTERNAL_ID_COOKIE_DAYS);

  return id;
}
