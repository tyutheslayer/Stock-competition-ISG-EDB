export function logError(context, error) {
  console.error(`[${new Date().toISOString()}] [${context}]`, {
    message: error.message,
    stack: error.stack,
    ...(error.code ? { code: error.code } : {}),
    ...(error.detail ? { detail: error.detail } : {}),
  });
}
