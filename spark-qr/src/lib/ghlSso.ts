// GHL marketplace-app SSO (custom pages).
//
// When the panel is loaded as a Custom Page inside the GHL app, the parent
// window will hand us an ENCRYPTED user session on request. We ask for it with
// a postMessage and receive it back on the `message` event. We never decrypt it
// here — the ciphertext goes to the backend (POST /sso), which holds the app's
// Shared Secret and returns the signed activeLocation.
//
// Protocol (per GHL docs):
//   iframe → parent : { message: 'REQUEST_USER_DATA' }
//   parent → iframe : { message: 'REQUEST_USER_DATA_RESPONSE', payload: <cipher> }

const REQUEST = 'REQUEST_USER_DATA';
const RESPONSE = 'REQUEST_USER_DATA_RESPONSE';

export function requestGhlEncryptedSession(timeoutMs = 4000): Promise<string | null> {
  if (typeof window === 'undefined' || window.parent === window) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      resolve(v);
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data && data.message === RESPONSE) {
        finish(typeof data.payload === 'string' ? data.payload : null);
      }
    };
    window.addEventListener('message', onMessage);
    try {
      window.parent.postMessage({ message: REQUEST }, '*');
    } catch {
      finish(null);
    }
    // GHL didn't answer (opened outside the app, older shell, etc.) → give up.
    setTimeout(() => finish(null), timeoutMs);
  });
}
