export class AppApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "AppApiError";
  }
}

async function decode<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const value = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (!response.ok) {
    throw new AppApiError(
      typeof value?.error === "string" ? value.error : "INTERNAL_ERROR",
      response.status,
    );
  }
  return value as T;
}

export async function apiGet<T>(path: string) {
  return decode<T>(
    await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } }),
  );
}

export async function apiQuery<T>(view: string, params: Record<string, string | undefined> = {}) {
  const search = new URLSearchParams({ view });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  return decode<T>(
    await fetch(`/api/v1/app?${search.toString()}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    }),
  );
}

export async function apiAction<T = void>(action: string, input: Record<string, unknown> = {}) {
  return decode<T>(
    await fetch("/api/v1/app", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ action, ...input }),
    }),
  );
}

export async function uploadFile(
  kind: "avatar" | "gift",
  file: File,
): Promise<{ path: string; url: string }> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
  return decode(
    await fetch("/api/v1/uploads", {
      method: "POST",
      credentials: "same-origin",
      body: form,
    }),
  );
}
