import { logout } from "@/lib/session";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}

let redirecting = false;

export async function apiClient<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login" && !redirecting) {
      redirecting = true;
      logout();
      void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", keepalive: true });
      window.location.assign("/login");
    }
    throw new ApiError(data?.message || `Request failed (${response.status}). Please try again.`, response.status);
  }
  return data as T;
}
