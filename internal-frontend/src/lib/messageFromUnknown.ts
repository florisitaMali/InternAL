/**
 * Turns unknown rejection / catch values into a readable message.
 * Avoids `Error: [object Event]` when a DOM Event (or similar) is thrown or rejected.
 */
export function messageFromUnknown(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (typeof reason === 'number' || typeof reason === 'boolean') return String(reason);
  if (typeof Event !== 'undefined' && reason instanceof Event) {
    return reason.type ? `Unexpected event (${reason.type})` : 'Unexpected browser event';
  }
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const m = (reason as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  try {
    const s = JSON.stringify(reason);
    if (s && s !== '{}') return s;
  } catch {
    /* ignore */
  }
  return 'Something went wrong.';
}

export function toError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new Error(messageFromUnknown(reason));
}
