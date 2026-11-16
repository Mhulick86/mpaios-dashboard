// In-process event bus. The HTTP layer relays these to browsers over Server-Sent Events,
// so boards, job status and model output update live instead of on a polling interval.
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function publish(type, data = {}) {
  for (const fn of listeners) { try { fn(type, data); } catch { /* a broken subscriber must not stop a write */ } }
}
export const subscriberCount = () => listeners.size;
