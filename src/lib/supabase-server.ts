import { PostgrestError, SupabaseClient, createClient } from "@supabase/supabase-js";

import { Database } from "@/lib/supabase-types";

type SupabasePageResponse<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

let cachedClient: SupabaseClient<Database> | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;
let hasWarnedPublishableKey = false;

function resolveSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE, SUPABASE_SERVICE_KEY, SUPABASE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const isPublishableKey = key.startsWith("sb_publishable_");
  if (isPublishableKey && !hasWarnedPublishableKey) {
    hasWarnedPublishableKey = true;
    console.warn(
      "Using a Supabase publishable key for server routes. Ensure your Supabase RLS/policies allow the needed reads/writes.",
    );
  }

  return { url, key };
}

export function getSupabaseServerClient() {
  const { url, key } = resolveSupabaseConfig();

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

export function throwIfSupabaseError(context: string, error: PostgrestError | null): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
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
