import { PrismaClient } from "@prisma/client";

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __serverPrismaClient: PrismaClient | undefined;
}

export function getPrismaServerClient(): PrismaClient {
  if (!globalThis.__serverPrismaClient) {
    globalThis.__serverPrismaClient = new PrismaClient();
  }

  return globalThis.__serverPrismaClient;
}

function toLowerSafe(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function shouldFallbackToPrisma(error: unknown): boolean {
  const candidate = error as SupabaseLikeError | null | undefined;
  const code = toLowerSafe(candidate?.code);
  const message = toLowerSafe(candidate?.message);

  return (
    code === "42501" ||
    message.includes("permission denied") ||
    message.includes("insufficient_privilege") ||
    message.includes("row-level security") ||
    message.includes("rls") ||
    message.includes("missing supabase configuration")
  );
}
