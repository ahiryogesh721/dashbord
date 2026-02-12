import { z } from "zod";

const extractedVariablesSchema = z
  .object({
    customer_name: z.string().optional().nullable(),
    property_use: z.string().optional().nullable(),
    layout_preference: z.string().optional().nullable(),
    visit_time: z.string().optional().nullable(),
  })
  .partial();

const callReportSchema = z
  .object({
    transcript: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    recording_url: z.string().optional().nullable(),
    extracted_variables: extractedVariablesSchema.optional().nullable(),
  })
  .partial();

export const callEndedPayloadSchema = z
  .object({
    call_date: z.union([z.string(), z.date()]).optional().nullable(),
    to_number: z.string().optional().nullable(),
    call_duration: z.coerce.number().int().nonnegative().optional().nullable(),
    call_report: callReportSchema.optional().nullable(),
  })
  .passthrough();

export type CallEndedPayload = z.infer<typeof callEndedPayloadSchema>;

const wrappedPayloadSchema = z
  .object({
    body: z.unknown().optional(),
  })
  .passthrough();

export function normalizeCallEndedPayload(input: unknown): CallEndedPayload {
  const wrapped = wrappedPayloadSchema.safeParse(input);
  const candidate = wrapped.success && wrapped.data.body ? wrapped.data.body : input;
  return callEndedPayloadSchema.parse(candidate);
}
