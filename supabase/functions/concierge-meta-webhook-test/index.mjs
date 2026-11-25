import { timingSafeEqual } from "node:crypto";

const TEST_PROJECT_URL = "https://fccvnotgsmxirhztveai.supabase.co";
const encoder = new TextEncoder();
const MAX_BODY_BYTES = 512 * 1024;

function equalStrings(left, right) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function hasValidSignature(body, signature, secret) {
  const hex = /^sha256=([0-9a-f]{64})$/i.exec(signature ?? "")?.[1];
  if (!hex) return false;
  const bytes = Uint8Array.from(hex.match(/../g), (pair) => Number.parseInt(pair, 16));
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, bytes, body);
}

function collectReferrals(payload, accountId, phoneId) {
  const referrals = new Map();
  if (payload?.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return [];
  }
  for (const entry of payload.entry) {
    if (entry?.id !== accountId || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      if (change?.field !== "messages" || value?.metadata?.phone_number_id !== phoneId ||
          !Array.isArray(value.messages)) continue;
      for (const message of value.messages) {
        const source = message?.referral;
        if (source?.source_type !== "ad" || typeof source.source_id !== "string" ||
            !/^[0-9]{1,32}$/.test(source.source_id) || typeof message.id !== "string" ||
            !/^wamid\.[A-Za-z0-9_+/=-]{1,249}$/.test(message.id)) continue;
        referrals.set(message.id, {
          message_id: message.id,
          ad_id: source.source_id,
        });
      }
    }
  }
  return [...referrals.values()];
}

export function createHandler(env, requestFetch = fetch) {
  return async (request) => {
    if (env("SUPABASE_URL") !== TEST_PROJECT_URL) return new Response(null, { status: 503 });
    if (request.method === "GET") {
      const verifyToken = env("PAWAPP_TEST_META_VERIFY_TOKEN");
      if (!verifyToken) return new Response(null, { status: 503 });
      const query = new URL(request.url).searchParams;
      const token = query.get("hub.verify_token");
      const challenge = query.get("hub.challenge");
      if (query.get("hub.mode") !== "subscribe" || !token || !challenge ||
          !equalStrings(token, verifyToken)) return new Response(null, { status: 403 });
      return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
    }
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
    }
    const appSecret = env("PAWAPP_TEST_META_APP_SECRET");
    const accountId = env("PAWAPP_TEST_META_WHATSAPP_ACCOUNT_ID");
    const phoneId = env("PAWAPP_TEST_META_PHONE_NUMBER_ID");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!appSecret || !accountId || !phoneId || !serviceKey) {
      return new Response(null, { status: 503 });
    }
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) return new Response(null, { status: 403 });
    const body = await readBody(request);
    if (!body) return new Response(null, { status: 413 });
    if (!(await hasValidSignature(body, signature, appSecret))) {
      return new Response(null, { status: 403 });
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return new Response(null, { status: 400 });
    }
    const referrals = collectReferrals(payload, accountId, phoneId);
    if (referrals.length) {
      try {
        const result = await requestFetch(
          TEST_PROJECT_URL + "/rest/v1/test_meta_whatsapp_referrals?on_conflict=message_id",
          {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: "Bearer " + serviceKey,
              "Content-Type": "application/json",
              Prefer: "resolution=ignore-duplicates,return=minimal",
            },
            body: JSON.stringify(referrals),
            signal: AbortSignal.timeout(5000),
          },
        );
        if (!result.ok) return new Response(null, { status: 503 });
      } catch {
        return new Response(null, { status: 503 });
      }
    }
    return new Response(null, { status: 200 });
  };
}

if (globalThis.Deno) Deno.serve(createHandler((name) => Deno.env.get(name)));
