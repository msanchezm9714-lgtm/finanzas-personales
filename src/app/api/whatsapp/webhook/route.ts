import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { parseMovement } from "@/lib/whatsapp/parse";

export const runtime = "nodejs";

type WhatsAppMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

type WhatsAppPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
};

function sameSecret(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function GET(request: Request) {
  if (process.env.WHATSAPP_ENABLED !== "true") return new Response("Webhook disabled", { status: 503 });
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return new Response("Webhook not configured", { status: 503 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const suppliedToken = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !sameSecret(suppliedToken, token) || !challenge) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  if (process.env.WHATSAPP_ENABLED !== "true") return new Response("Webhook disabled", { status: 503 });
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const allowedSender = process.env.WHATSAPP_ALLOWED_SENDER?.replace(/\D/g, "");
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const userId = process.env.WHATSAPP_USER_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!appSecret || !allowedSender || !phoneNumberId || !userId || !supabaseUrl || !supabaseSecret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.length > 1024 * 1024) return new Response("Payload too large", { status: 413 });
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (!sameSecret(signature, expectedSignature)) return new Response("Forbidden", { status: 403 });

  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as WhatsAppPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (payload.object !== "whatsapp_business_account") return new Response("OK");

  const db = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || change.value?.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of change.value.messages ?? []) {
        if (!message.id || message.from?.replace(/\D/g, "") !== allowedSender || message.type !== "text") continue;
        const parsed = parseMovement(message.text?.body ?? "");
        if (!parsed) continue;

        const sentAt = Number(message.timestamp);
        const date = Number.isFinite(sentAt) && sentAt > 0
          ? new Date(sentAt * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        const { error } = await db.from("transactions").upsert({
          user_id: userId,
          date,
          type: parsed.type,
          amount: parsed.amount,
          category: parsed.category,
          description: parsed.description,
          payment_method: null,
          necessity: "necessary",
          scope: "personal",
          whatsapp_message_id: message.id,
        }, { onConflict: "whatsapp_message_id", ignoreDuplicates: true });
        if (error) {
          console.error("Could not save WhatsApp movement", error.code);
          return new Response("Save failed", { status: 500 });
        }
      }
    }
  }

  return new Response("OK");
}
