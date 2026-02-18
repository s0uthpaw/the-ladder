import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function syncProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  // Fast path: profile already exists (most requests)
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("clerk_id", userId)
    .single();

  if (existing) return existing;

  // Profile doesn't exist — fetch Clerk user details for name/avatar
  const user = await currentUser();
  if (!user) return null;

  const displayName =
    user.fullName ||
    user.firstName ||
    user.emailAddresses[0]?.emailAddress ||
    "Player";

  const { data: created, error } = await supabaseAdmin
    .from("profiles")
    .insert({
      clerk_id: userId,
      display_name: displayName,
      avatar_url: user.imageUrl,
    })
    .select()
    .single();

  // Race condition: another request already inserted this profile
  if (error?.code === "23505") {
    const { data: raced } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("clerk_id", userId)
      .single();
    return raced;
  }

  return created;
}
