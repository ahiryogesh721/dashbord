import { SupabaseClient } from "@supabase/supabase-js";

import { throwIfSupabaseError } from "@/lib/supabase-server";
import { Database } from "@/lib/supabase-types";

type LeadLookupRow = {
  id: string;
  created_at: string;
};

type SupabaseDbClient = SupabaseClient<Database>;

async function loadLeadsByPhone(
  supabase: SupabaseDbClient,
  phone: string,
  context: string,
): Promise<LeadLookupRow[]> {
  const response = await supabase
    .from("leads")
    .select("id,created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  throwIfSupabaseError(`Unable to load leads by phone (${context})`, response.error);
  return (response.data ?? []) as LeadLookupRow[];
}

export async function consolidateDuplicateLeadsByPhone(
  supabase: SupabaseDbClient,
  phone: string,
  context: string,
): Promise<string | null> {
  const leads = await loadLeadsByPhone(supabase, phone, context);
  if (leads.length === 0) return null;

  const primaryLeadId = leads[0].id;
  const duplicateLeadIds = leads.slice(1).map((lead) => lead.id);
  if (duplicateLeadIds.length === 0) return primaryLeadId;

  const [followUpsUpdate, siteVisitsUpdate] = await Promise.all([
    supabase.from("follow_ups").update({ lead_id: primaryLeadId }).in("lead_id", duplicateLeadIds),
    supabase.from("site_visits").update({ lead_id: primaryLeadId }).in("lead_id", duplicateLeadIds),
  ]);

  throwIfSupabaseError(`Unable to re-point follow-ups during lead dedupe (${context})`, followUpsUpdate.error);
  throwIfSupabaseError(`Unable to re-point site visits during lead dedupe (${context})`, siteVisitsUpdate.error);

  const deleteResponse = await supabase.from("leads").delete().in("id", duplicateLeadIds);
  throwIfSupabaseError(`Unable to remove duplicate leads (${context})`, deleteResponse.error);

  return primaryLeadId;
}
