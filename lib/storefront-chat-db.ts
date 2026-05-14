import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export async function bumpStorefrontChatThreadUpdatedAt(
  supabase: SupabaseClient<Database>,
  threadId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("storefront_chat_threads").update({ updated_at: now }).eq("id", threadId);
}
