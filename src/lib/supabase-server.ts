import { PostgrestError, SupabaseClient, createClient } from "@supabase/supabase-js";

import { Database } from "@/lib/supabase-types";

type SupabasePageResponse<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

type SupabaseKeySource =
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_SECRET_KEY"
  | "SUPABASE_SERVICE_ROLE"
  | "SUPABASE_SERVICE_KEY"
  | "SUPABASE_KEY"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

type SupabaseAuthRole = "service_role" | "anon" | "unknown";

type SupabaseRuntimeInfo = {
  authRole: SupabaseAuthRole;
  keySource: SupabaseKeySource;
  isPrivileged: boolean;
};

type ResolvedSupabaseConfig = {
  url: string;
  key: string;
} & SupabaseRuntimeInfo;

type SupabaseServerClientOptions = {
  requirePrivileged?: boolean;
  context?: string;
};

type SupabaseAdminClientOptions = {
  context?: string;
};

let cachedClient: SupabaseClient<Database> | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;
let cachedAdminClient: SupabaseClient<Database> | null = null;
let cachedAdminUrl: string | null = null;
let cachedAdminKey: string | null = null;
let hasWarnedPublishableKey = false;

function decodeBase64Url(value: string): string | null {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const withPadding = padding === 0 ? normalized : `${normalized}${"=".repeat(4 - padding)}`;

  try {
    return Buffer.from(withPadding, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function inferSupabaseAuthRole(key: string): SupabaseAuthRole {
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";

  const parts = key.split(".");
  if (parts.length !== 3) return "unknown";

  const payloadJson = decodeBase64Url(parts[1] ?? "");
  if (!payloadJson) return "unknown";

  try {
    const parsed = JSON.parse(payloadJson) as { role?: unknown };
    if (parsed.role === "service_role") return "service_role";
    if (parsed.role === "anon") return "anon";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function formatSupabaseAuthInfo(config: { authRole: SupabaseAuthRole; keySource: SupabaseKeySource; isPrivileged: boolean }): string {
  return `supabase_auth_role=${config.authRole}; key_source=${config.keySource}; privileged=${config.isPrivileged}`;
}

function resolveSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing Supabase configuration. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
  }
  return url;
}

function resolveFirstNonEmptyKey(
  keyCandidates: Array<{ source: SupabaseKeySource; value: string | undefined }>,
): { source: SupabaseKeySource; value: string } | null {
  for (const candidate of keyCandidates) {
    const value = candidate.value?.trim();
    if (value) {
      return { source: candidate.source, value };
    }
  }
  return null;
}

function buildResolvedConfig(url: string, keySource: SupabaseKeySource, key: string): ResolvedSupabaseConfig {
  const authRole = inferSupabaseAuthRole(key);
  const isPrivileged = authRole === "service_role";

  return { url, key, keySource, authRole, isPrivileged };
}

function resolveSupabaseConfig(): ResolvedSupabaseConfig {
  const url = resolveSupabaseUrl();
  const keyCandidates: Array<{ source: SupabaseKeySource; value: string | undefined }> = [
    { source: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { source: "SUPABASE_SECRET_KEY", value: process.env.SUPABASE_SECRET_KEY },
    { source: "SUPABASE_SERVICE_ROLE", value: process.env.SUPABASE_SERVICE_ROLE },
    { source: "SUPABASE_SERVICE_KEY", value: process.env.SUPABASE_SERVICE_KEY },
    { source: "SUPABASE_KEY", value: process.env.SUPABASE_KEY },
    { source: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    { source: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY },
    { source: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  ];

  const keyConfig = resolveFirstNonEmptyKey(keyCandidates);
  if (!keyConfig) {
    throw new Error(
      "Missing Supabase configuration. Set one of SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE, SUPABASE_SERVICE_KEY, SUPABASE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const resolved = buildResolvedConfig(url, keyConfig.source, keyConfig.value);
  const { authRole, keySource, isPrivileged } = resolved;
  const isPublishableKey = authRole === "anon";

  if (isPublishableKey && !hasWarnedPublishableKey) {
    hasWarnedPublishableKey = true;
    console.warn(
      `Using a Supabase publishable key for server routes (${formatSupabaseAuthInfo({
        authRole,
        keySource,
        isPrivileged,
      })}). Ensure your Supabase RLS/policies allow the needed reads/writes.`,
    );
  }

  return resolved;
}

function resolveSupabaseAdminConfig(): ResolvedSupabaseConfig {
  const url = resolveSupabaseUrl();
  const keyCandidates: Array<{ source: SupabaseKeySource; value: string | undefined }> = [
    { source: "SUPABASE_SERVICE_ROLE_KEY", value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { source: "SUPABASE_SECRET_KEY", value: process.env.SUPABASE_SECRET_KEY },
    { source: "SUPABASE_SERVICE_ROLE", value: process.env.SUPABASE_SERVICE_ROLE },
    { source: "SUPABASE_SERVICE_KEY", value: process.env.SUPABASE_SERVICE_KEY },
  ];

  const keyConfig = resolveFirstNonEmptyKey(keyCandidates);
  if (!keyConfig) {
    throw new Error(
      "Missing Supabase admin configuration. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY on the server.",
    );
  }

  const resolved = buildResolvedConfig(url, keyConfig.source, keyConfig.value);
  if (!resolved.isPrivileged) {
    throw new Error(
      `Supabase admin key must be service_role. Current ${formatSupabaseAuthInfo({
        authRole: resolved.authRole,
        keySource: resolved.keySource,
        isPrivileged: resolved.isPrivileged,
      })}.`,
    );
  }

  return resolved;
}

export function getSupabaseServerRuntimeInfo(): SupabaseRuntimeInfo {
  const { authRole, keySource, isPrivileged } = resolveSupabaseConfig();
  return { authRole, keySource, isPrivileged };
}

export function getSupabaseAdminRuntimeInfo(): SupabaseRuntimeInfo {
  const { authRole, keySource, isPrivileged } = resolveSupabaseAdminConfig();
  return { authRole, keySource, isPrivileged };
}

export function getSupabaseServerClient(options?: SupabaseServerClientOptions) {
  const { url, key, authRole, keySource, isPrivileged } = resolveSupabaseConfig();

  if (options?.requirePrivileged && !isPrivileged) {
    const suffix = options.context ? ` for ${options.context}` : "";
    throw new Error(
      `Supabase privileged key required${suffix}. Current ${formatSupabaseAuthInfo({
        authRole,
        keySource,
        isPrivileged,
      })}. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY on the server.`,
    );
  }

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  cachedUrl = url;
  cachedKey = key;
  cachedClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

export function getSupabaseAdminClient(options?: SupabaseAdminClientOptions) {
  const { url, key, authRole, keySource, isPrivileged } = resolveSupabaseAdminConfig();
  if (!isPrivileged) {
    const suffix = options?.context ? ` for ${options.context}` : "";
    throw new Error(
      `Supabase admin client requires privileged credentials${suffix}. Current ${formatSupabaseAuthInfo({
        authRole,
        keySource,
        isPrivileged,
      })}.`,
    );
  }

  if (cachedAdminClient && cachedAdminUrl === url && cachedAdminKey === key) {
    return cachedAdminClient;
  }

  cachedAdminUrl = url;
  cachedAdminKey = key;
  cachedAdminClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}

export function throwIfSupabaseError(context: string, error: PostgrestError | null, runtimeInfo?: SupabaseRuntimeInfo): void {
  if (error) {
    const runtime = runtimeInfo ?? getSupabaseServerRuntimeInfo();
    throw new Error(
      `${context}: ${error.message} [${formatSupabaseAuthInfo({
        authRole: runtime.authRole,
        keySource: runtime.keySource,
        isPrivileged: runtime.isPrivileged,
      })}]`,
    );
  }
}

export async function fetchAllSupabaseRows<T>(
  context: string,
  fetchPage: (from: number, to: number) => Promise<SupabasePageResponse<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    throwIfSupabaseError(`${context} (range ${from}-${to})`, error);

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}
