async function api(path, opts={}) {
  const res = await fetch(path, { headers:{ "content-type":"application/json" }, ...opts });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

function el(id){ return document.getElementById(id); }

async function loadCustomers() {
  const q = el("qCustomers").value.trim();
  const rows = await api(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  el("customersList").innerHTML = rows.map(c => `
    <div style="padding:10px;border:1px solid #1b2a4a;border-radius:12px;margin:8px 0">
      <div style="font-weight:700">${c.name}</div>
      <div class="muted">${c.phone || ""}${c.email ? " • " + c.email : ""}</div>
      <div class="muted">${c.service_address || ""}</div>
    </div>
  `).join("") || `<div class="muted">No matches.</div>`;

  const sel = el("invCustomer");
  sel.innerHTML = rows.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

async function addCustomer() {
  const body = {
    name: el("cName").value.trim(),
    phone: el("cPhone").value.trim(),
    email: el("cEmail").value.trim(),
    service_address: el("cAddr").value.trim(),
    notes: el("cNotes").value.trim()
  };
  if (!body.name) return alert("Name required");

  await api("/api/customers", { method:"POST", body: JSON.stringify(body) });

  el("cName").value = "";
  el("cPhone").value = "";
  el("cEmail").value = "";
  el("cAddr").value = "";
  el("cNotes").value = "";

  await loadCustomers();
  await loadInvoices();
}

async function loadInvoices() {
  const rows = await api("/api/invoices");
  el("invoicesList").innerHTML = rows.map(i => `
    <div style="padding:10px;border:1px solid #1b2a4a;border-radius:12px;margin:8px 0">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div><b>${i.customer_name}</b> <span class="muted">• ${i.invoice_number}</span></div>
        <div class="badge">${i.status}</div>
      </div>
      <div class="muted">Invoice: ${i.invoice_date} • Due: ${i.due_date}</div>
      <div style="margin-top:8px"><a href="invoice.html?id=${i.id}">Open</a></div>
    </div>
  `).join("") || `<div class="muted">No invoices yet.</div>`;
}

async function createInvoice() {
  const customer_id = el("invCustomer").value;
  if (!customer_id) return alert("Pick a customer first");
  const { id } = await api("/api/invoices", {
    method:"POST",
    body: JSON.stringify({ customer_id })
  });
  location.href = `invoice.html?id=${id}`;
}

window.addEventListener("DOMContentLoaded", async () => {
  el("btnLoadCustomers").onclick = loadCustomers;
  el("btnAddCustomer").onclick = addCustomer;
  el("btnCreateInvoice").onclick = createInvoice;

  await loadCustomers();
  await loadInvoices();
});
