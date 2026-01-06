async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
function el(id) {
  return document.getElementById(id);
}

const invoiceId = new URLSearchParams(location.search).get("id");

async function load() {
  const data = await api(`/api/invoices/${invoiceId}`);
  const inv = data.invoice;
  const items = data.items;
  const totals = data.totals;

  el("hdr").textContent = `${inv.invoice_number} • ${inv.customer_name}`;
  el("status").textContent = inv.status;
  el("meta").innerHTML = `
    <div><b>${inv.customer_name}</b> <span class="muted">(${inv.customer_email || "no email"})</span></div>
    <div class="muted">Invoice date: ${inv.invoice_date} • Due: ${inv.due_date}</div>
  `;

  el("items").innerHTML = items
    .map((r) => {
      const line = Math.round(Number(r.qty) * Number(r.unit_price_cents));
      return `<tr>
        <td>${r.description}</td>
        <td align="right">${r.qty}</td>
        <td align="right">${money(r.unit_price_cents)}</td>
        <td align="right">${money(line)}</td>
      </tr>`;
    })
    .join("");

  el("subtotal").textContent = money(totals.subtotalCents);
  el("tax").textContent = money(totals.taxCents);
  el("total").textContent = money(totals.totalCents);
}

async function addItem() {
  const description = el("desc").value.trim();
  const qty = Number(el("qty").value || 1);
  const unit_price = Number(el("unit").value || 0);

  if (!description) return alert("Description required");
  if (!(qty > 0)) return alert("Qty must be > 0");

  await api(`/api/invoices/${invoiceId}/items`, {
    method: "POST",
    body: JSON.stringify({ description, qty, unit_price }),
  });

  el("desc").value = "";
  el("qty").value = "1";
  el("unit").value = "";
  await load();
}

window.addEventListener("DOMContentLoaded", async () => {
  if (!invoiceId) return alert("Missing invoice id");
  el("btnAdd").onclick = addItem;
  await load();
});
