/* The whole client-server contract in one place.

   Every endpoint is JSON in, JSON out, and same-origin: in production Flask
   serves this build itself, and in development Vite proxies /api through to
   Flask on :5000. Either way the browser sees one origin, so the Flask
   session cookie rides along on its own and there is no CORS layer and no
   token to keep in sync. */

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined
      : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204s and error pages from the dev server may not carry a JSON body.
  let data = null;
  try { data = await res.json(); } catch { /* leave it null */ }

  if (!res.ok) {
    const err = new Error((data && data.error) || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.code = data && data.error;      // 'bad', 'exists', 'missing', …
    throw err;
  }
  return data;
}

export const get = path => request(path);
export const post = (path, body) => request(path, { method: 'POST', body });

/* The controlled vocabulary never changes while the tab is open, and four
   different pages need it. Cache the promise, not the result, so two pages
   mounting at once still make one request. */
let vocabPromise = null;
export const getVocab = () => (vocabPromise ??= get('/api/vocab'));

/* Build a query string, dropping the filters nobody set. */
export function qs(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}
