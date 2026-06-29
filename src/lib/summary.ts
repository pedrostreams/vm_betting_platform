// Daily summary email: results from the last 24h + the league table, narrated by
// "Morten Ramm" (OpenAI), sent to every registered user via Maileroo's HTTP API.
//
// Wired into the cron at /api/cron/summary. The factual results + standings tables
// are rendered here in code (so the numbers are always correct); the LLM only writes
// the funny commentary on top.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMatches } from "@/lib/queries";
import { stageLabel } from "@/lib/format";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vm26.vercel.app";

// Morten Ramm — norsk komiker. Energisk, leken, selvironisk, varm; pirker godmodig på
// lederen og trøster den som ligger sist. Aldri slemt eller personangrep.
const SYSTEM_PROMPT = `Du er Morten Ramm - den norske komikeren, og det er slik du skal kommunisere.
Stemmen din er energisk, leken, litt på kanten og full av selvironi og glimt i øyet — korte punchlines,
litt absurd humor og høyt tempo. Du velger selv hvem av lagene/gutta du heier på, men du elsker å pirke godmodig på den
som leder tabellen, og å trøste (og lett ironisere over) den som ligger sist. Du skriver
på norsk bokmål, uformelt og varmt — som en kompis i en vennegjeng. Alle gutta har samtykket til at du kan være slem med dem, så du trenger ikke holde igjen på kommentarene dine.
Du foretrekker korte avsnitt/tekster. Ikke typisk AI generert piss. 

Oppgaven din: skriv en kort, morsom intro-kommentar til en daglig oppsummerings-epost for
et VM 2026-tippelag blant venner. Du får (1) resultater fra de siste 24 timene og (2)
hvordan det står i ligatabellen (vår egen konkurranse). Kommenter resultatene og tabellen
med vri og humor. IKKE lag tabeller eller lister selv — selve resultatlista og tabellen
limes inn under teksten din automatisk. Hold deg til 2–3 korte avsnitt. På resultater, bruk norske navn på landene.
IKKE nevn Morten Ramm. 
PS: DU er en løs kanon på dekk, og det er det som gjør deg så morsom å lese! Vær uforutsigbar, på kanten til støtende. 
Svar KUN med gyldig JSON på nøyaktig dette formatet:
{"subject": "<fengende, morsom emnelinje på maks 80 tegn>", "commentary_html": "<kommentaren din som enkel HTML med <p>-tagger, evt. <strong> og <em>>"}`;

interface ResultLine {
  stage: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  advance: string | null; // knockout: name of the team that advanced
}

interface StandingLine {
  name: string; // lagnavn (display_name)
  fullName: string | null; // spillerens faktiske navn
  total: number;
}

interface Recipient {
  address: string;
}

/** FINISHED matches whose kickoff was within the last `hours` hours, oldest first. */
async function loadRecentResults(sb: SupabaseClient, hours = 24): Promise<ResultLine[]> {
  const matches = await loadMatches(sb);
  const since = Date.now() - hours * 3600 * 1000;
  return matches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        m.home_score != null &&
        m.away_score != null &&
        new Date(m.utc_date).getTime() >= since,
    )
    .sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
    .map((m) => ({
      stage: m.stage,
      home: m.home?.name ?? "?",
      away: m.away?.name ?? "?",
      homeScore: m.home_score as number,
      awayScore: m.away_score as number,
      advance:
        m.stage !== "GROUP_STAGE"
          ? m.winner === "HOME_TEAM"
            ? (m.home?.name ?? null)
            : m.winner === "AWAY_TEAM"
              ? (m.away?.name ?? null)
              : null
          : null,
    }));
}

/** Global leaderboard across all participants (the friend group's single competition). */
async function loadGlobalStandings(sb: SupabaseClient): Promise<StandingLine[]> {
  const [{ data: profiles }, { data: scores }] = await Promise.all([
    sb.from("profiles").select("id, display_name, full_name"),
    sb.from("user_scores").select("user_id, total_points, exact_knockout_count, correct_special_count"),
  ]);

  const scoreById = new Map((scores ?? []).map((s) => [s.user_id, s]));

  return (profiles ?? [])
    .filter((p) => p.display_name)
    .map((p) => ({
      name: p.display_name as string,
      fullName: (p.full_name as string | null) ?? null,
      total: scoreById.get(p.id)?.total_points ?? 0,
      tb1: scoreById.get(p.id)?.exact_knockout_count ?? 0,
      tb2: scoreById.get(p.id)?.correct_special_count ?? 0,
    }))
    .sort(
      (a, b) =>
        b.total - a.total || b.tb1 - a.tb1 || b.tb2 - a.tb2 || a.name.localeCompare(b.name, "nb-NO"),
    )
    .map(({ name, fullName, total }) => ({ name, fullName, total }));
}

/** Every registered user's email (paginated through Supabase Auth). */
async function loadRecipients(sb: SupabaseClient): Promise<Recipient[]> {
  const out: Recipient[] = [];
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) if (u.email) out.push({ address: u.email });
    if (users.length < perPage) break;
  }
  return out;
}

function stageLabelNo(stage: string): string {
  return stage === "GROUP_STAGE" ? "Gruppespill" : stageLabel(stage);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDataPrompt(results: ResultLine[], standings: StandingLine[]): string {
  const resultsText = results.length
    ? results
        .map(
          (r) =>
            `- ${stageLabelNo(r.stage)}: ${r.home} ${r.homeScore}–${r.awayScore} ${r.away}` +
            (r.advance ? ` (${r.advance} videre)` : ""),
        )
        .join("\n")
    : "(ingen kamper de siste 24 timene)";
  const standingsText = standings
    .map((s, i) => `${i + 1}. ${s.name}${s.fullName ? ` (${s.fullName})` : ""} — ${s.total} p`)
    .join("\n");
  return (
    `RESULTATER SISTE 24 TIMER:\n${resultsText}\n\n` +
    `LIGATABELL (vår konkurranse) — format «plassering. lagnavn (spillerens navn) — poeng». ` +
    `Bruk gjerne spillernes navn når du pirker på dem og gi dem et kallenavn:\n${standingsText}`
  );
}

async function writeCommentary(
  results: ResultLine[],
  standings: StandingLine[],
): Promise<{ subject: string; commentaryHtml: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY mangler");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildDataPrompt(results, standings) },
      ],
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json)}`);
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI ga tomt svar");

  const parsed = JSON.parse(content) as { subject?: string; commentary_html?: string };
  return {
    subject: parsed.subject?.trim() || "VM-bongen: dagens oppdatering",
    commentaryHtml: parsed.commentary_html || "<p>Dagens dom uteble, men tabellen lyver ikke 👇</p>",
  };
}

function renderEmailHtml(
  commentaryHtml: string,
  results: ResultLine[],
  standings: StandingLine[],
): string {
  const resultsRows = results.length
    ? results
        .map(
          (r) => `<tr>
            <td style="padding:6px 10px;color:#6b7280;font-size:13px;white-space:nowrap">${escapeHtml(stageLabelNo(r.stage))}</td>
            <td style="padding:6px 10px;text-align:right">${escapeHtml(r.home)}</td>
            <td style="padding:6px 10px;text-align:center;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap">${r.homeScore}–${r.awayScore}</td>
            <td style="padding:6px 10px">${escapeHtml(r.away)}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td style="padding:10px;color:#6b7280" colspan="4">Ingen kamper de siste 24 timene.</td></tr>`;

  const standingsRows = standings
    .map(
      (s, i) => `<tr>
        <td style="padding:6px 10px;color:#6b7280;width:28px;text-align:right;font-variant-numeric:tabular-nums">${i + 1}.</td>
        <td style="padding:6px 10px">${escapeHtml(s.name)}</td>
        <td style="padding:6px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${s.total}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;padding:24px">
      <h1 style="margin:0 0 4px;font-size:20px">⚽️ VM 2026 — dagens bong</h1>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Daglig oppsummering</p>

      <div style="font-size:15px;line-height:1.55">${commentaryHtml}</div>

      <h2 style="margin:24px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280">Resultater siste 24 timer</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${resultsRows}</table>

      <h2 style="margin:24px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280">Tabellen — vår konkurranse</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${standingsRows}</table>

      <div style="margin-top:24px;text-align:center">
        <a href="${SITE_URL}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 22px;border-radius:9999px;font-size:14px;font-weight:600">Se hele bongen →</a>
      </div>
    </div>
    <p style="text-align:center;color:#a1a1aa;font-size:12px;margin:16px 0 0">VM 2026 «Tippebongen»</p>
  </div>
</body></html>`;
}

function renderEmailText(commentaryHtml: string, results: ResultLine[], standings: StandingLine[]): string {
  const commentary = commentaryHtml.replace(/<[^>]+>/g, "").trim();
  const resultsText = results.length
    ? results
        .map(
          (r) =>
            `${stageLabelNo(r.stage)}: ${r.home} ${r.homeScore}–${r.awayScore} ${r.away}` +
            (r.advance ? ` (${r.advance} videre)` : ""),
        )
        .join("\n")
    : "Ingen kamper de siste 24 timene.";
  const standingsText = standings.map((s, i) => `${i + 1}. ${s.name} — ${s.total} p`).join("\n");
  return `${commentary}\n\nRESULTATER SISTE 24 TIMER\n${resultsText}\n\nTABELLEN\n${standingsText}\n\nSe hele bongen: ${SITE_URL}`;
}

async function sendViaMaileroo(opts: {
  subject: string;
  html: string;
  plain: string;
  recipients: Recipient[];
}): Promise<string> {
  const apiKey = process.env.MAILEROO_API_KEY;
  const fromAddress = process.env.MAILEROO_FROM_ADDRESS;
  if (!apiKey) throw new Error("MAILEROO_API_KEY mangler");
  if (!fromAddress) throw new Error("MAILEROO_FROM_ADDRESS mangler");

  const from = { address: fromAddress, display_name: process.env.MAILEROO_FROM_NAME || "VM 2026 Tippebongen" };

  const res = await fetch("https://smtp.maileroo.com/api/v2/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      from,
      to: [from], // visible recipient = sender; everyone else is BCC'd so addresses stay private
      bcc: opts.recipients,
      subject: opts.subject,
      html: opts.html,
      plain: opts.plain,
      tracking: false,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) throw new Error(`Maileroo ${res.status}: ${JSON.stringify(json)}`);
  return json.data?.reference_id ?? "";
}

export interface SummaryResult {
  sent: boolean;
  test?: boolean;
  reason?: string;
  recipients?: number;
  matches?: number;
  subject?: string;
  reference_id?: string;
}

/**
 * Build and send the daily summary email. Skips sending when no matches finished in
 * the last 24h (nothing new to report) unless `force` is set.
 *
 * When `testEmail` is given, the mail goes ONLY to that address (no one else), the
 * subject is prefixed with [TEST], and the no-matches guard is bypassed — so you can
 * always fire off a self-test.
 */
export async function sendDailySummary(
  sb: SupabaseClient,
  opts: { force?: boolean; testEmail?: string } = {},
): Promise<SummaryResult> {
  const [results, standings] = await Promise.all([loadRecentResults(sb), loadGlobalStandings(sb)]);
  const testMode = Boolean(opts.testEmail);

  if (results.length === 0 && !opts.force && !testMode) {
    return { sent: false, reason: "ingen ferdige kamper siste 24 timer (bruk ?force=1 for å sende likevel)" };
  }

  const recipients: Recipient[] = testMode ? [{ address: opts.testEmail! }] : await loadRecipients(sb);
  if (recipients.length === 0) {
    return { sent: false, reason: "ingen mottakere med e-post" };
  }

  const { subject, commentaryHtml } = await writeCommentary(results, standings);
  const finalSubject = testMode ? `[TEST] ${subject}` : subject;
  const html = renderEmailHtml(commentaryHtml, results, standings);
  const plain = renderEmailText(commentaryHtml, results, standings);
  const reference_id = await sendViaMaileroo({ subject: finalSubject, html, plain, recipients });

  // Record the send so the admin UI can show "sent today?". A logging failure must
  // not make a successful send look failed, so swallow its error.
  const { error: logErr } = await sb.from("summary_sends").insert({
    recipients: recipients.length,
    matches: results.length,
    subject: finalSubject,
    reference_id,
    test: testMode,
  });
  if (logErr) console.error("summary_sends insert failed:", logErr.message);

  return {
    sent: true,
    test: testMode || undefined,
    recipients: recipients.length,
    matches: results.length,
    subject: finalSubject,
    reference_id,
  };
}

export interface SummarySendRow {
  sent_at: string;
  recipients: number;
  matches: number;
  subject: string | null;
  test: boolean;
}

export interface SummaryStatus {
  lastSend: SummarySendRow | null;
  /** A real (non-test) summary went out today, in Europe/Oslo time. */
  sentToday: boolean;
}

/** Read recent send history to power the admin "sent today?" indicator. */
export async function getSummaryStatus(sb: SupabaseClient): Promise<SummaryStatus> {
  const { data } = await sb
    .from("summary_sends")
    .select("sent_at, recipients, matches, subject, test")
    .order("sent_at", { ascending: false })
    .limit(20);

  const rows = (data ?? []) as SummarySendRow[];
  // en-CA renders YYYY-MM-DD, so date-only comparison in a fixed timezone is just ===.
  const osloDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Oslo" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Oslo" });

  return {
    lastSend: rows[0] ?? null,
    sentToday: rows.some((r) => !r.test && osloDay(r.sent_at) === today),
  };
}
