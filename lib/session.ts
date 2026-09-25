export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  walletAddress?: string;
}

/**
 * The auth token is kept in an HttpOnly cookie by the server. We retain the
 * user profile in localStorage for fast client-side rendering only.
 */
export function getToken(): string | null {
  return null;
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem("user");
  if (!data) return null;
  try { return JSON.parse(data) as SessionUser; } catch { return null; }
}

export function saveSession(_token: string | undefined, user: SessionUser) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem("user");
}
