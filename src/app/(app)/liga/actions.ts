"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function makeInviteCode(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function createPool(formData: FormData): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Ligaen må ha et navn." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ikke innlogget." };

  // Retry a few times on the (unlikely) invite-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = makeInviteCode();
    const { data: pool, error } = await supabase
      .from("pools")
      .insert({ name, owner_id: user.id, invite_code })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") continue; // unique violation on invite_code
      return { error: error.message };
    }
    await supabase.from("pool_members").insert({ pool_id: pool.id, user_id: user.id, role: "owner" });
    revalidatePath("/liga");
    return {};
  }
  return { error: "Klarte ikke å lage en unik invitasjonskode. Prøv igjen." };
}

export async function joinPoolByCode(
  code: string,
): Promise<{ error?: string; poolId?: string }> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { error: "Mangler invitasjonskode." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ikke innlogget." };

  const { data: pool } = await supabase
    .from("pools")
    .select("id")
    .eq("invite_code", clean)
    .maybeSingle();
  if (!pool) return { error: "Fant ingen liga med den koden." };

  const { error } = await supabase
    .from("pool_members")
    .insert({ pool_id: pool.id, user_id: user.id, role: "member" });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath("/liga");
  return { poolId: pool.id };
}

export async function joinPool(formData: FormData): Promise<{ error?: string }> {
  const code = String(formData.get("code") ?? "");
  if (!code.trim()) return { error: "Skriv inn en invitasjonskode." };
  const { error } = await joinPoolByCode(code);
  return error ? { error } : {};
}
