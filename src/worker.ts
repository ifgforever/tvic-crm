export interface Env {
  DB: D1Database;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const uid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const ymd = (d = new Date()) => d.toISOString().slice(0, 10);

async function readBody(req: Request) {
  const text = await req.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function invoiceTotals(db: D1Database, invoiceId: string) {
  const items = await db.prepare(
    `SELECT qty, unit_price_cents FROM invoice_items WHERE invoice_id = ?`
  ).bind(invoiceId).all();

  const subtotalCents = (items.results || []).reduce((sum: number, r: any) => {
    const qty = Number(r.qty ?? 0);
    const up = Number(r.unit_price_cents ?? 0);
    return sum + Math.round(qty * up);
  }, 0);

  const inv = await db.prepare(`SELECT tax_cents FROM invoices WHERE id = ?`)
    .bind(invoiceId).first();

  const taxCents = Number(inv?.tax_cents ?? 0);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    // ---------- Customers ----------
    if (pathname === "/api/customers" && req.method === "GET") {
      const q = url.searchParams.get("q")?.trim() || "";
      const rows = q
        ? await env.DB.prepare(
            `SELECT * FROM customers
             WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR service_address LIKE ?
             ORDER BY created_at DESC LIMIT 200`
          ).bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`).all()
        : await env.DB.prepare(`SELECT * FROM customers ORDER BY created_at DESC LIMIT 200`).all();

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

    // ---------- Invoices ----------
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
      const invoiceNumber = b.invoice_number || `INV-${new Date().getFullYear()}-${Math.floor(Math.random()*9000+1000)}`;
      const invoiceDate = b.invoice_date || ymd();
      const dueDate = b.due_date || ymd(new Date(Date.now() + 14 * 86400000));

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
      const invoiceId = pathname.split("/").pop()!;
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
