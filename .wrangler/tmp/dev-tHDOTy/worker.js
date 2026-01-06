var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.ts
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } }), "json");
var uid = /* @__PURE__ */ __name(() => crypto.randomUUID(), "uid");
var nowISO = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "nowISO");
var ymd = /* @__PURE__ */ __name((d = /* @__PURE__ */ new Date()) => d.toISOString().slice(0, 10), "ymd");
async function readBody(req) {
  const text = await req.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
__name(readBody, "readBody");
async function invoiceTotals(db, invoiceId) {
  const items = await db.prepare(
    `SELECT qty, unit_price_cents FROM invoice_items WHERE invoice_id = ?`
  ).bind(invoiceId).all();
  const subtotalCents = (items.results || []).reduce((sum, r) => {
    const qty = Number(r.qty ?? 0);
    const up = Number(r.unit_price_cents ?? 0);
    return sum + Math.round(qty * up);
  }, 0);
  const inv = await db.prepare(`SELECT tax_cents FROM invoices WHERE id = ?`).bind(invoiceId).first();
  const taxCents = Number(inv?.tax_cents ?? 0);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
__name(invoiceTotals, "invoiceTotals");
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const { pathname } = url;
    if (pathname === "/api/customers" && req.method === "GET") {
      const q = url.searchParams.get("q")?.trim() || "";
      const rows = q ? await env.DB.prepare(
        `SELECT * FROM customers
             WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR service_address LIKE ?
             ORDER BY created_at DESC LIMIT 200`
      ).bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`).all() : await env.DB.prepare(`SELECT * FROM customers ORDER BY created_at DESC LIMIT 200`).all();
      return json(rows.results || []);
    }
    if (pathname === "/api/customers" && req.method === "POST") {
      const b = await readBody(req);
      if (!b.name) return json({ error: "Name required" }, 400);
      const id = uid();
      await env.DB.prepare(
        `INSERT INTO customers (id, name, phone, email, service_address, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, b.name, b.phone ?? "", b.email ?? "", b.service_address ?? "", b.notes ?? "", nowISO()).run();
      return json({ id });
    }
    if (pathname === "/api/invoices" && req.method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT i.*, c.name AS customer_name
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         ORDER BY i.created_at DESC LIMIT 200`
      ).all();
      return json(rows.results || []);
    }
    if (pathname === "/api/invoices" && req.method === "POST") {
      const b = await readBody(req);
      if (!b.customer_id) return json({ error: "customer_id required" }, 400);
      const id = uid();
      const invoiceNumber = b.invoice_number || `INV-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(Math.random() * 9e3 + 1e3)}`;
      const invoiceDate = b.invoice_date || ymd();
      const dueDate = b.due_date || ymd(new Date(Date.now() + 14 * 864e5));
      await env.DB.prepare(
        `INSERT INTO invoices (id, customer_id, invoice_number, invoice_date, due_date, status, tax_cents, created_at)
         VALUES (?, ?, ?, ?, ?, 'Draft', 0, ?)`
      ).bind(id, b.customer_id, invoiceNumber, invoiceDate, dueDate, nowISO()).run();
      return json({ id });
    }
    if (pathname.startsWith("/api/invoices/") && pathname.endsWith("/items") && req.method === "POST") {
      const invoiceId = pathname.split("/")[3];
      const b = await readBody(req);
      if (!b.description) return json({ error: "description required" }, 400);
      const id = uid();
      const qty = Number(b.qty ?? 1);
      const unitPriceCents = Math.round(Number(b.unit_price ?? 0) * 100);
      await env.DB.prepare(
        `INSERT INTO invoice_items (id, invoice_id, description, qty, unit_price_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, invoiceId, b.description, qty, unitPriceCents, nowISO()).run();
      return json({ id });
    }
    if (pathname.startsWith("/api/invoices/") && req.method === "GET") {
      const invoiceId = pathname.split("/").pop();
      const inv = await env.DB.prepare(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email
         FROM invoices i JOIN customers c ON c.id=i.customer_id
         WHERE i.id=?`
      ).bind(invoiceId).first();
      if (!inv) return json({ error: "Not found" }, 404);
      const items = await env.DB.prepare(
        `SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY created_at ASC`
      ).bind(invoiceId).all();
      const totals = await invoiceTotals(env.DB, invoiceId);
      return json({ invoice: inv, items: items.results || [], totals });
    }
    return json({ error: "Not found" }, 404);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-dX0KKc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-dX0KKc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
