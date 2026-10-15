/*
 * ARC mock — tiny GraphQL executor.
 * Parses the operation the drop-ins send, resolves root fields against
 * in-browser resolvers, then projects the result onto the exact selection
 * set requested (aliases, fragments, inline fragments, field arguments).
 * Fields the data model does not know resolve to null.
 */

/* ---------------- Lexer ---------------- */
function lex(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') { while (i < n && src[i] !== '\n') i += 1; continue; }
    if (/[\s,﻿]/.test(c)) { i += 1; continue; }
    if (src.startsWith('...', i)) { tokens.push({ t: 'spread' }); i += 3; continue; }
    if ('{}()[]:!$@=|&'.includes(c)) { tokens.push({ t: 'p', v: c }); i += 1; continue; }
    if (c === '"') {
      if (src.startsWith('"""', i)) {
        const end = src.indexOf('"""', i + 3);
        tokens.push({ t: 's', v: src.slice(i + 3, end) });
        i = end + 3; continue;
      }
      let j = i + 1; let s = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') { s += JSON.parse(`"${src.slice(j, j + 2)}"`); j += 2; } else { s += src[j]; j += 1; }
      }
      tokens.push({ t: 's', v: s }); i = j + 1; continue;
    }
    if (/[-0-9]/.test(c)) {
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      tokens.push({ t: 'n', v: Number(m[0]) }); i += m[0].length; continue;
    }
    const m = /^[_A-Za-z][_0-9A-Za-z]*/.exec(src.slice(i));
    if (m) { tokens.push({ t: 'name', v: m[0] }); i += m[0].length; continue; }
    throw new Error(`GraphQL lex error at ${i}: ${src.slice(i, i + 20)}`);
  }
  return tokens;
}

/* ---------------- Parser ---------------- */
function parse(src) {
  const tk = lex(src);
  let p = 0;
  const peek = () => tk[p];
  const next = () => tk[p++];
  const isP = (v) => tk[p] && tk[p].t === 'p' && tk[p].v === v;
  const expectP = (v) => { if (!isP(v)) throw new Error(`Expected ${v}`); p += 1; };
  const name = () => { const t = next(); if (t.t !== 'name') throw new Error('Expected name'); return t.v; };

  function value() {
    const t = peek();
    if (t.t === 'p' && t.v === '$') { p += 1; return { var: name() }; }
    if (t.t === 'p' && t.v === '[') { p += 1; const list = []; while (!isP(']')) list.push(value()); p += 1; return { list }; }
    if (t.t === 'p' && t.v === '{') {
      p += 1; const obj = {};
      while (!isP('}')) { const k = name(); expectP(':'); obj[k] = value(); }
      p += 1; return { obj };
    }
    p += 1;
    if (t.t === 's' || t.t === 'n') return { lit: t.v };
    if (t.v === 'true') return { lit: true };
    if (t.v === 'false') return { lit: false };
    if (t.v === 'null') return { lit: null };
    return { lit: t.v }; // enum
  }
  function args() {
    const a = {};
    if (!isP('(')) return a;
    p += 1;
    while (!isP(')')) { const k = name(); expectP(':'); a[k] = value(); }
    p += 1;
    return a;
  }
  function directives() { while (isP('@')) { p += 1; name(); args(); } }
  function typeRef() {
    if (isP('[')) { p += 1; typeRef(); expectP(']'); } else name();
    if (isP('!')) p += 1;
  }
  function selectionSet() {
    expectP('{');
    const sels = [];
    while (!isP('}')) {
      if (peek().t === 'spread') {
        p += 1;
        if (peek().t === 'name' && peek().v === 'on') {
          p += 1; const on = name(); directives();
          sels.push({ kind: 'inline', on, sel: selectionSet() });
        } else if (isP('{') || isP('@')) {
          directives(); sels.push({ kind: 'inline', on: null, sel: selectionSet() });
        } else {
          sels.push({ kind: 'spread', name: name() }); directives();
        }
      } else {
        let alias = name(); let fname = alias;
        if (isP(':')) { p += 1; fname = name(); }
        const a = args(); directives();
        const sel = isP('{') ? selectionSet() : null;
        sels.push({ kind: 'field', alias, name: fname, args: a, sel });
      }
    }
    p += 1;
    return sels;
  }

  const ops = []; const frags = {};
  while (p < tk.length) {
    const t = peek();
    if (t.t === 'p' && t.v === '{') { ops.push({ type: 'query', name: null, sel: selectionSet() }); continue; }
    const kw = name();
    if (kw === 'fragment') {
      const fname = name(); name(); /* on */ const on = name(); directives();
      frags[fname] = { on, sel: selectionSet() };
    } else {
      const op = { type: kw, name: null, defaults: {} };
      if (peek().t === 'name') op.name = name();
      if (isP('(')) {
        p += 1;
        while (!isP(')')) {
          expectP('$'); const v = name(); expectP(':'); typeRef();
          if (isP('=')) { p += 1; op.defaults[v] = value(); }
          directives();
        }
        p += 1;
      }
      directives();
      op.sel = selectionSet();
      ops.push(op);
    }
  }
  return { ops, frags };
}

/* ---------------- Executor ---------------- */
function evalValue(v, vars) {
  if (v === undefined) return undefined;
  if ('var' in v) return vars[v.var];
  if ('list' in v) return v.list.map((x) => evalValue(x, vars));
  if ('obj' in v) {
    const o = {};
    Object.entries(v.obj).forEach(([k, x]) => { o[k] = evalValue(x, vars); });
    return o;
  }
  return v.lit;
}
function evalArgs(a, vars) {
  const o = {};
  Object.entries(a).forEach(([k, v]) => { o[k] = evalValue(v, vars); });
  return o;
}

// Concrete GraphQL types the mock knows about. An inline fragment / fragment
// is skipped only when the value's __typename is concrete and different.
export const CONCRETE_TYPES = new Set([
  'SimpleProductView', 'ComplexProductView',
  'SimpleCartItem', 'ConfigurableCartItem', 'VirtualCartItem', 'BundleCartItem', 'GiftCardCartItem', 'DownloadableCartItem',
  'SimpleProduct', 'ConfigurableProduct', 'VirtualProduct', 'BundleProduct', 'GiftCardProduct', 'DownloadableProduct', 'GroupedProduct',
  'ScalarBucket', 'RangeBucket', 'StatsBucket', 'CategoryView',
  'ProductViewOptionValueSwatch', 'ProductViewOptionValueConfiguration', 'ProductViewOptionValueProduct',
  'OrderItem', 'ConfigurableOrderItem', 'BundleOrderItem', 'GiftCardOrderItem', 'DownloadableOrderItem',
  'Customer', 'Cart', 'CustomerOrder',
]);

function typeMatches(value, on) {
  if (!on || !value || typeof value !== 'object') return true;
  const tn = value.__typename;
  if (!tn) return true;
  if (tn === on) return true;
  if (Array.isArray(value.__implements) && value.__implements.includes(on)) return true;
  return !CONCRETE_TYPES.has(on);
}

function project(value, sels, ctx, typeHint) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map((v) => project(v, sels, ctx, typeHint));
  if (!sels) return value;
  if (typeof value !== 'object') return value;
  const out = {};
  const walk = (list) => {
    list.forEach((s) => {
      if (s.kind === 'spread') {
        const f = ctx.frags[s.name];
        if (f && typeMatches(value, f.on)) walk(f.sel);
      } else if (s.kind === 'inline') {
        if (typeMatches(value, s.on)) walk(s.sel);
      } else {
        const key = s.alias;
        if (s.name === '__typename') { out[key] = value.__typename || typeHint || null; return; }
        let v = value[s.name];
        if (typeof v === 'function') v = v(evalArgs(s.args, ctx.vars), ctx);
        const sub = project(v, s.sel, ctx, null);
        if (s.sel && out[key] && sub && typeof sub === 'object' && !Array.isArray(sub)) {
          out[key] = { ...out[key], ...sub }; // merge duplicate selections
        } else {
          out[key] = sub;
        }
      }
    });
  };
  walk(sels);
  return out;
}

/**
 * Execute a GraphQL request against resolver maps.
 * @param {object} resolvers { query: {field: fn(args, ctx)}, mutation: {...} }
 */
export async function execute(resolvers, { query, variables = {}, operationName }, ctxExtra = {}) {
  let doc;
  try { doc = parse(query); } catch (e) { return { errors: [{ message: `ARC mock parse error: ${e.message}` }] }; }
  const op = (operationName && doc.ops.find((o) => o.name === operationName)) || doc.ops[0];
  const vars = { ...variables };
  Object.entries(op.defaults || {}).forEach(([k, v]) => { if (vars[k] === undefined) vars[k] = evalValue(v, {}); });
  const ctx = { frags: doc.frags, vars, op, ...ctxExtra };
  const root = resolvers[op.type] || {};
  const data = {};
  const errors = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const s of op.sel) {
    if (s.kind !== 'field') continue; // eslint-disable-line no-continue
    if (s.name === '__typename') { data[s.alias] = op.type === 'mutation' ? 'Mutation' : 'Query'; continue; } // eslint-disable-line no-continue
    const fn = root[s.name];
    if (!fn) {
      data[s.alias] = null;
      // eslint-disable-next-line no-console
      console.info(`[ARC mock] no resolver for ${op.type}.${s.name} (${op.name || 'anonymous'}) → null`);
      continue; // eslint-disable-line no-continue
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const v = await fn(evalArgs(s.args, vars), ctx);
      data[s.alias] = project(v, s.sel, ctx, null);
    } catch (e) {
      data[s.alias] = null;
      errors.push({ message: e.message, path: [s.alias] });
      // eslint-disable-next-line no-console
      console.warn(`[ARC mock] ${op.type}.${s.name} failed:`, e);
    }
  }
  return errors.length ? { data, errors } : { data };
}

export { parse };
