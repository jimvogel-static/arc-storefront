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
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
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
    const raw = typeof input === 'string' ? input : input?.url;
    if (raw && raw.startsWith(MOCK_ORIGIN)) return handle(input, init);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ARC mock] interceptor error', e);
  }
  return realFetch(input, init);
};

// Helpers for presenters: window.arcMock.reset() clears carts, orders, profile.
window.arcMock = {
  reset() {
    Object.keys(window.localStorage).filter((k) => k.startsWith('arc-mock:')).forEach((k) => window.localStorage.removeItem(k));
    window.sessionStorage.removeItem('config');
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /dropin|cart/i.test(n))
      .forEach((n) => { document.cookie = `${n}=; Max-Age=0; path=/`; });
    window.localStorage.removeItem('DROPIN__CART__CART__DATA');
    window.location.reload();
  },
};
