import { json } from "@remix-run/node";

const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;
// eslint-disable-next-line no-undef
const rateLimitBuckets = globalThis.__reviewsRateLimitBuckets || new Map();

// eslint-disable-next-line no-undef
globalThis.__reviewsRateLimitBuckets = rateLimitBuckets;

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rejectLargeJsonRequest(request, maxBytes = DEFAULT_MAX_JSON_BYTES) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > maxBytes) {
    return json(
      { success: false, message: "Request body is too large" },
      { status: 413 }
    );
  }

  return null;
}

export function rateLimitRequest(
  request,
  { namespace, limit = 60, windowMs = 60_000 } = {}
) {
  const now = Date.now();
  const ip = getClientIp(request);
  const key = `${namespace || "default"}:${ip}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return json(
      { success: false, message: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null;
}
