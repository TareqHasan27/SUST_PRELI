export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function toPublicError(error) {
  const statusCode = error?.statusCode || 500;
  const message = statusCode >= 500 ? "Internal server error" : error.message;
  return { statusCode, body: { error: message } };
}
