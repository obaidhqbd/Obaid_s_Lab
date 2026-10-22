import { createHash } from "node:crypto";

const RATE_WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_BYTES = 15000;

function text(value, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

function records(value, limit) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item) => ({
    title: text(item?.title, 160),
    description: text(item?.description, 500),
    tags: Array.isArray(item?.tags) ? item.tags.slice(0, 10).map((tag) => text(tag, 80)).filter(Boolean) : [],
    url: text(item?.url, 500)
  }));
}

function publicContext(context) {
  return {
    owner: text(context?.owner, 120),
    role: text(context?.role, 120),
    email: text(context?.email, 200),
    github: text(context?.github, 300),
    projects: records(context?.projects, 20),
    blogs: records(context?.blogs, 20),
    media: Array.isArray(context?.media)
      ? context.media.slice(0, 30).map((item) => text(item, 500)).filter(Boolean)
      : []
  };
}

async function enforceRateLimit(req) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) throw new Error("Rate limiter is not configured");

  // Vercel overwrites these headers with the requester's IP when serving the function.
  const forwarded = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  if (!ip) throw new Error("Trusted client IP is unavailable");

  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const key = "lab:chat:" + bucket + ":" + ipHash;
  const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n";
  const response = await fetch(redisUrl.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + redisToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(["EVAL", script, "1", key, String(RATE_WINDOW_SECONDS)])
  });
  if (!response.ok) throw new Error("Rate limiter request failed");
  const result = await response.json();
  if (result?.error || !Number.isSafeInteger(Number(result?.result))) {
    throw new Error("Rate limiter returned an invalid response");
  }
  return Number(result.result);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(503).json({ error: "AI service not configured" });

  let requestCount;
  try {
    requestCount = await enforceRateLimit(req);
  } catch {
    return res.status(503).json({ error: "AI service temporarily unavailable" });
  }
  if (requestCount > MAX_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", String(RATE_WINDOW_SECONDS));
    return res.status(429).json({ error: "Too many requests" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_CONTEXT_BYTES + MAX_MESSAGE_LENGTH + 1000) {
    return res.status(413).json({ error: "Request is too large" });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "Message required" });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(413).json({ error: "Message is too long" });
  }

  const safeContext = JSON.stringify(publicContext(body.context));
  if (Buffer.byteLength(safeContext, "utf8") > MAX_CONTEXT_BYTES) {
    return res.status(413).json({ error: "Context is too large" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_ORIGIN || "https://example.com",
        "X-Title": "Obaid's Laboratory"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        temperature: 0.25,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: "You are the Laboratory Assistant for Obaid's Laboratory. Answer only from the supplied public context. Do not invent personal, sensitive, private, financial, medical, authentication, or unrelated information. Be concise, practical and friendly. For contact requests provide the public email and clickable links when present. When relevant, return direct public media URLs from context so the frontend can make them clickable. Context: " + safeContext
          },
          { role: "user", content: message }
        ]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: "Upstream AI error" });
    const reply = data?.choices?.[0]?.message?.content || "I could not find a useful answer.";
    return res.status(200).json({ reply });
  } catch {
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
