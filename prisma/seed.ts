import { createClient } from "@supabase/supabase-js";

import { Database } from "../src/lib/supabase-types";

const initialSalesReps = [
  {
    name: "Sarah Miller",
    email: "sarah.miller@example.com",
    phone: "+15550000001",
    max_open_leads: 80,
  },
  {
    name: "David Khan",
    email: "david.khan@example.com",
    phone: "+15550000002",
    max_open_leads: 80,
  },
];

function resolveSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase configuration. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and one of SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, key };
}

async function main(): Promise<void> {
  const { url, key } = resolveSupabaseConfig();
  const supabase = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  for (const rep of initialSalesReps) {
    const { error } = await supabase.from("sales_reps").upsert(
      {
        ...rep,
        is_active: true,
      },
      {
        onConflict: "email",
      },
    );

    if (error) {
      throw new Error(`Failed to upsert rep ${rep.email}: ${error.message}`);
    }
  }
}

main()
  .then(() => {
    console.log("Seed completed");
  })
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  });
