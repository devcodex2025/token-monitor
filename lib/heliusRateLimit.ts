export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
  resetMs?: number;
  retryAfter?: number;
}

const normalizeHeaderValue = (value: unknown) => {
  if (Array.isArray(value)) return value.join(', ');
  if (value === undefined || value === null) return '';
  return String(value);
};

const getHeader = (headers: Record<string, unknown>, name: string) => {
  const direct = headers[name];
  if (direct !== undefined) return normalizeHeaderValue(direct);
  const lower = headers[name.toLowerCase()];
  if (lower !== undefined) return normalizeHeaderValue(lower);
  return '';
};

const toNumber = (value: string) => {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export const extractRateLimit = (headers: Record<string, unknown>): RateLimitInfo | null => {
  if (!headers) return null;

  const limit = toNumber(getHeader(headers, 'x-ratelimit-limit'));
  const remaining = toNumber(getHeader(headers, 'x-ratelimit-remaining'));
  const reset = toNumber(getHeader(headers, 'x-ratelimit-reset'));
  const resetMs = toNumber(getHeader(headers, 'x-ratelimit-reset-ms'));
  const retryAfter = toNumber(getHeader(headers, 'retry-after'));

  const hasAny =
    limit !== undefined ||
    remaining !== undefined ||
    reset !== undefined ||
    resetMs !== undefined ||
    retryAfter !== undefined;

  if (!hasAny) return null;

  return { limit, remaining, reset, resetMs, retryAfter };
};
