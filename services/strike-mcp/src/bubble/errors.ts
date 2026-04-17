export class BubbleApiError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body: unknown) {
    super(message);
    this.name = "BubbleApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class BubbleAuthError extends BubbleApiError {
  constructor(message: string, body: unknown) {
    super(message, 401, body);
    this.name = "BubbleAuthError";
  }
}

export class BubbleNotFoundError extends BubbleApiError {
  constructor(message: string, body: unknown) {
    super(message, 404, body);
    this.name = "BubbleNotFoundError";
  }
}

export class BubbleRateLimitError extends BubbleApiError {
  constructor(message: string, body: unknown) {
    super(message, 429, body);
    this.name = "BubbleRateLimitError";
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

export function bubbleErrorFromResponse(
  statusCode: number,
  body: unknown,
): BubbleApiError {
  const fallback = `Bubble API error ${statusCode}`;
  const message = extractMessage(body, fallback);
  switch (statusCode) {
    case 401:
    case 403:
      return new BubbleAuthError(message, body);
    case 404:
      return new BubbleNotFoundError(message, body);
    case 429:
      return new BubbleRateLimitError(message, body);
    default:
      return new BubbleApiError(message, statusCode, body);
  }
}
