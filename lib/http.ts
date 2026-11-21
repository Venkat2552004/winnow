/** Error carrying an HTTP status so callers can decide whether to retry. */
export class HttpError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  /** Network failures, rate limits, and server errors are worth retrying. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export function describeHttpError(
  service: string,
  status: number,
  detail?: string,
): string {
  const suffix = detail ? `: ${detail.slice(0, 200)}` : '';
  if (status === 0) return `${service} is unreachable${suffix}`;
  if (status === 401) return `${service} rejected the credentials — check your key${suffix}`;
  if (status === 403) return `${service} denied the request — check permissions or quota${suffix}`;
  if (status === 429) return `${service} rate limit reached — try again shortly${suffix}`;
  if (status >= 500) return `${service} is having trouble (${status}) — try again shortly${suffix}`;
  return `${service} error ${status}${suffix}`;
}
