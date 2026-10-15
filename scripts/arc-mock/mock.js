/*
 * ARC mock — fetch interceptor.
 * Loaded first in head.html. Any request to the mock commerce endpoints
 * configured in /config.json is answered in-browser; nothing leaves the page.
 */
import { execute } from './gql.js';
import { csResolvers, coreResolvers } from './resolvers.js';

export const MOCK_ORIGIN = 'https://arc-mock.bounteous.invalid';

const CS_MAP = {
  query: { ...coreResolvers.query, ...csResolvers.query },
  mutation: { ...coreResolvers.mutation },
};
const CORE_MAP = {
  query: { ...csResolvers.query, ...coreResolvers.query },
  mutation: { ...coreResolvers.mutation },
};

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function readHeaders(init, input) {
  const h = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
  return h;
}

async function readRequest(url, init, input) {
  if (url.searchParams.has('query')) {
    let variables = {};
    try { variables = JSON.parse(url.searchParams.get('variables') || '{}'); } catch { /* ignore */ }
    return { query: url.searchParams.get('query'), variables, operationName: url.searchParams.get('operationName') || undefined };
  }
  let body = init?.body;
  if (!body && input instanceof Request) body = await input.clone().text();
  if (typeof body !== 'string') body = body ? await new Response(body).text() : '{}';
  return JSON.parse(body || '{}');
}

const realFetch = window.fetch.bind(window);

async function handle(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  const req = await readRequest(url, init, input);
  const headers = readHeaders(init, input);
  const auth = headers.get('Authorization') || headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim() || null;
  const map = url.pathname.includes('cs-graphql') ? CS_MAP : CORE_MAP;
  await sleep(90 + Math.random() * 220);
  const result = await execute(map, req, { token: token && token !== 'null' && token !== 'undefined' ? token : null });
  if (window.ARC_MOCK_DEBUG) {
    // eslint-disable-next-line no-console
    console.debug('[ARC mock]', req.operationName || req.query.slice(0, 60), req.variables, result);
  }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-ARC-Mock': '1' },
  });
}

window.fetch = function arcMockFetch(input, init) {
  try {
    const raw = input instanceof Request ? input.url : String(input);
    if (raw && raw.startsWith(MOCK_ORIGIN)) return handle(input, init);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ARC mock] interceptor error', e);
  }
  return realFetch(input, init);
};

// Helpers for presenters.
// - window.arcMock.reset() clears carts, orders, profile and sign-in.
// - Visiting any page with ?arc-reset (e.g. /?arc-reset) does the same, then
//   lands on the home page. The footer carries a low-key "Reset demo" link.
function clearDemoState() {
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith('arc-mock:') || /^DROPIN__/.test(k) || /productViewHistory|purchaseHistory/.test(k))
    .forEach((k) => window.localStorage.removeItem(k));
  Object.keys(window.sessionStorage).forEach((k) => window.sessionStorage.removeItem(k));
  document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /dropin|cart|auth/i.test(n))
    .forEach((n) => { document.cookie = `${n}=; Max-Age=0; path=/`; });
}

window.arcMock = {
  reset() {
    clearDemoState();
    window.location.replace(`${window.location.origin}/`);
  },
};

// Presenter X-ray overlay: ?xray turns it on (sticky for the session), ?xray=off turns it off.
const xrayParam = new URLSearchParams(window.location.search).get('xray');
if (xrayParam !== null) {
  if (xrayParam === 'off' || xrayParam === '0') window.sessionStorage.removeItem('arc-xray');
  else window.sessionStorage.setItem('arc-xray', '1');
}
if (window.sessionStorage.getItem('arc-xray') === '1' && !document.prerendering) {
  window.addEventListener('load', () => {
    import('../arc-xray.js').then((m) => m.default()).catch((e) => console.warn('[ARC x-ray]', e)); // eslint-disable-line no-console
  });
}

// The quiet footer "X-ray" link toggles the overlay on the current page.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href*="xray"]');
  if (!a || !a.closest('footer')) return;
  e.preventDefault();
  const on = window.sessionStorage.getItem('arc-xray') === '1';
  if (on) window.sessionStorage.removeItem('arc-xray');
  else window.sessionStorage.setItem('arc-xray', '1');
  const url = new URL(window.location.href);
  url.searchParams.delete('xray');
  window.location.replace(url.toString());
});

if (new URLSearchParams(window.location.search).has('arc-reset')) {
  // The boilerplate prerenders links on hover; only reset on a real visit.
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', () => window.arcMock.reset(), { once: true });
  } else {
    window.arcMock.reset();
  }
}
