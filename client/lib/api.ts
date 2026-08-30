const DEFAULT_API = "http://localhost:4000";

function normalizeBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

const API = normalizeBase(process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API);
const SOCKET = normalizeBase(process.env.NEXT_PUBLIC_SOCKET_URL ?? API);

function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API}${normalizedPath}`;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  _retried?: boolean;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type SessionPayload = { accessToken: string; user?: unknown };
type TokenListener = (session: SessionPayload) => void;

let tokenListener: TokenListener | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function onSessionRefresh(listener: TokenListener | null) {
  tokenListener = listener;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const payload = (await res.json()) as { success?: boolean; data?: SessionPayload } & SessionPayload;
      const session = payload.data ?? payload;
      if (!session.accessToken) return null;
      tokenListener?.(session);
      return session.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function isAuthPath(path: string) {
  return /\/auth\/(login|register|refresh|logout)$/.test(path);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const urlPath = path.startsWith("/api") || path.startsWith("/health") ? path : `/api${path}`;
  const requestUrl = apiUrl(urlPath);
  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: options.method ?? "GET",
      headers,
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach API at ${API}. Check NEXT_PUBLIC_API_URL and that the backend is running.`,
    );
  }

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
  } & T;
  if (res.status === 401 && !options._retried && !isAuthPath(urlPath)) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return api<T>(path, { ...options, token: nextToken, _retried: true });
    }
  }
  if (!res.ok || payload.success === false) {
    throw new ApiError(res.status, payload.error ?? `Request failed (${res.status})`);
  }
  if (payload.success === true && payload.data !== undefined) {
    return payload.data;
  }
  return payload;
}

export const endpoints = {
  api: API,
  socket: SOCKET,
};
