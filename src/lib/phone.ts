import { createHash } from "node:crypto";

export function normalizePhoneForStorage(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  return `+${digits}`;
}

export function deterministicLeadIdFromPhone(phone: string): string {
  const normalized = normalizePhoneForStorage(phone);
  if (!normalized) {
    throw new Error("Cannot derive deterministic lead id without a valid phone number");
  }

  const bytes = createHash("sha256").update(`lead:${normalized}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // UUIDv5 version bits.
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant bits.

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
