const LEAD_TTL_SECONDS = 60 * 60 * 24 * 180;
const SERVICES = new Set(["لاغری", "افزایش وزن اصولی", "کاهش شکم و پهلو", "تغذیه اصولی", "مشاوره مکمل ورزشی"]);
const ACTIVITIES = new Set(["کم / بدون ورزش", "۱ تا ۲ روز در هفته", "۳ تا ۴ روز در هفته", "۵ روز یا بیشتر در هفته"]);

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function sameToken(a, b) {
  const left = new TextEncoder().encode(String(a || ""));
  const right = new TextEncoder().encode(String(b || ""));
  let diff = left.length ^ right.length;
  const size = Math.max(left.length, right.length);
  for (let i = 0; i < size; i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }
  return diff === 0;
}

function isValidUuid(value) {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

function validateLead(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const rubika = String(data.rubika || "").trim().replace(/\s+/g, "");
  const service = String(data.service || "").trim();
  const age = Number(data.age);
  const height = Number(data.height);
  const weight = Number(data.weight);
  const goal = String(data.goal || "").trim().replace(/\s+/g, " ");
  const activity = String(data.activity || "").trim();

  if (!/^@?[A-Za-z0-9_.]{3,64}$/.test(rubika)) return null;
  if (!SERVICES.has(service)) return null;
  if (!Number.isInteger(age) || age < 12 || age > 100) return null;
  if (!Number.isInteger(height) || height < 100 || height > 230) return null;
  if (!Number.isFinite(weight) || weight < 25 || weight > 300) return null;
  if (!goal || goal.length > 100) return null;
  if (!ACTIVITIES.has(activity)) return null;
  if (data.consent !== true) return null;

  return {
    rubika: rubika,
    service: service,
    age: age,
    height: height,
    weight: Math.round(weight * 10) / 10,
    goal: goal,
    activity: activity
  };
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN || String(env.ADMIN_TOKEN).length < 32) {
    return json({ error: "admin_not_configured" }, 503);
  }
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !sameToken(match[1], env.ADMIN_TOKEN)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

async function handleSubmit(request, env) {
  if (!env.LEADS) return json({ error: "storage_unavailable" }, 503);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "forbidden" }, 403);
  let rawBody;
  try {
    rawBody = await request.text();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }
  if (new TextEncoder().encode(rawBody).length > 10000) {
    return json({ error: "payload_too_large" }, 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }
  if (String(body.website || "").trim()) {
    return json({ ok: true, received: true });
  }
  const lead = validateLead(body);
  if (!lead || !isValidUuid(body.requestId)) return json({ error: "invalid_input" }, 400);

  const requestKey = "request:" + body.requestId;
  const existingKey = await env.LEADS.get(requestKey);
  if (existingKey) {
    const existing = await env.LEADS.get(existingKey);
    if (existing) {
      const previous = JSON.parse(existing);
      return json({ ok: true, id: previous.id, duplicate: true }, 200);
    }
  }

  // Soft anti-spam limit: no more than five valid submissions per source IP per hour.
  const sourceIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sourceIp));
  const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const rateKey = "rate:" + ipHash;
  const currentCount = Number(await env.LEADS.get(rateKey) || 0);
  if (currentCount >= 5) return json({ error: "rate_limited" }, 429);
  await env.LEADS.put(rateKey, String(currentCount + 1), { expirationTtl: 60 * 60 });

  const now = Date.now();
  const uuid = crypto.randomUUID();
  // Reverse the timestamp so KV lexicographic listing returns newest requests first.
  const reverseTimestamp = 9999999999999 - now;
  const id = "lead:" + String(reverseTimestamp).padStart(13, "0") + ":" + uuid;
  const record = {
    id: id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + LEAD_TTL_SECONDS * 1000).toISOString(),
    status: "new",
    ...lead
  };
  await env.LEADS.put(id, JSON.stringify(record), { expirationTtl: LEAD_TTL_SECONDS });
  await env.LEADS.put(requestKey, id, { expirationTtl: LEAD_TTL_SECONDS });
  return json({ ok: true, id: id, createdAt: record.createdAt }, 201);
}

async function handleAdmin(request, env, url) {
  if (!env.LEADS) return json({ error: "storage_unavailable" }, 503);
  const authError = await requireAdmin(request, env);
  if (authError) return authError;

  if (url.pathname === "/api/admin/leads" && request.method === "GET") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const cursor = url.searchParams.get("cursor") || undefined;
    const page = await env.LEADS.list({ prefix: "lead:", limit: limit, cursor: cursor });
    const records = await Promise.all(page.keys.map(async item => {
      const value = await env.LEADS.get(item.name);
      if (!value) return null;
      try { return JSON.parse(value); } catch (_) { return null; }
    }));
    const leads = records.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ leads: leads, cursor: page.list_complete ? null : page.cursor, list_complete: page.list_complete });
  }

  const prefix = "/api/admin/leads/";
  if (url.pathname.startsWith(prefix)) {
    const id = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!/^lead:\d{13}:[a-f0-9-]{36}$/i.test(id)) return json({ error: "not_found" }, 404);
    const value = await env.LEADS.get(id);
    if (!value) return json({ error: "not_found" }, 404);
    if (request.method === "DELETE") {
      await env.LEADS.delete(id);
      return json({ ok: true });
    }
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: "invalid_json" }, 400); }
      if (body.status !== "new" && body.status !== "contacted") return json({ error: "invalid_status" }, 400);
      const record = JSON.parse(value);
      record.status = body.status;
      const remaining = Math.floor((Date.parse(record.expiresAt) - Date.now()) / 1000);
      if (remaining <= 0) {
        await env.LEADS.delete(id);
        return json({ error: "not_found" }, 404);
      }
      await env.LEADS.put(id, JSON.stringify(record), { expirationTtl: remaining });
      return json({ ok: true, lead: record });
    }
  }
  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      const ready = Boolean(env.LEADS);
      return json({ ok: ready, storage: ready ? "ready" : "not_configured" }, ready ? 200 : 503);
    }
    if (url.pathname === "/api/leads" && request.method === "POST") {
      return handleSubmit(request, env);
    }
    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not_found" }, 404);
    }
    return env.ASSETS.fetch(request);
  }
};