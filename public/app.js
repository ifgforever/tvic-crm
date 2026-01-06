async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
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

function el(id) {
  return document.getElementById(id);
}

// ============================================================
// CUSTOMERS
// ============================================================

async function loadCustomers() {
  const q = el("qCustomers").value.trim();
  let rows;
  try {
    rows = await api(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  } catch (err) {
    console.error("Failed to load customers:", err);
    el("customersList").textContent = "Error loading customers.";
    return;
  }

  const listEl = el("customersList");
  listEl.innerHTML = "";

  if (!rows || rows.length === 0) {
    listEl.innerHTML = '<div class="muted">No matches.</div>';
  } else {
    for (const c of rows) {
      const card = document.createElement("div");
      card.style.cssText = "padding:10px;border:1px solid #1b2a4a;border-radius:12px;margin:8px 0";

      const nameDiv = document.createElement("div");
      nameDiv.style.fontWeight = "700";
      nameDiv.textContent = c.name;
      card.appendChild(nameDiv);

      const contactDiv = document.createElement("div");
      contactDiv.className = "muted";
      const parts = [c.phone, c.email].filter(Boolean);
      contactDiv.textContent = parts.join(" \u2022 ");
      card.appendChild(contactDiv);

      if (c.service_address) {
        const addrDiv = document.createElement("div");
        addrDiv.className = "muted";
        addrDiv.textContent = c.service_address;
        card.appendChild(addrDiv);
      }

      listEl.appendChild(card);
    }
  }

  // Update customer select for invoices
  const sel = el("invCustomer");
  sel.innerHTML = "";
  for (const c of rows) {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.name;
    sel.appendChild(option);
  }
}

async function addCustomer() {
  const body = {
    name: el("cName").value.trim(),
    phone: el("cPhone").value.trim(),
    email: el("cEmail").value.trim(),
    service_address: el("cAddr").value.trim(),
    notes: el("cNotes").value.trim(),
  };

  if (!body.name) {
    alert("Name required");
    return;
  }

  try {
    await api("/api/customers", { method: "POST", body: JSON.stringify(body) });
    el("cName").value = "";
    el("cPhone").value = "";
    el("cEmail").value = "";
    el("cAddr").value = "";
    el("cNotes").value = "";
    await loadCustomers();
    await loadInvoices();
  } catch (err) {
    console.error("Failed to add customer:", err);
    alert(`Failed to add customer: ${err.message}`);
  }
}

// ============================================================
// INVOICES
// ============================================================

async function loadInvoices() {
  let rows;
  try {
    rows = await api("/api/invoices");
  } catch (err) {
    console.error("Failed to load invoices:", err);
    el("invoicesList").textContent = "Error loading invoices.";
    return;
  }

  const listEl = el("invoicesList");
  listEl.innerHTML = "";

  if (!rows || rows.length === 0) {
    listEl.innerHTML = '<div class="muted">No invoices yet.</div>';
  } else {
    for (const i of rows) {
      const card = document.createElement("div");
      card.style.cssText = "padding:10px;border:1px solid #1b2a4a;border-radius:12px;margin:8px 0";

      const headerRow = document.createElement("div");
      headerRow.style.cssText = "display:flex;justify-content:space-between;gap:10px";

      const nameSpan = document.createElement("div");
      const bold = document.createElement("b");
      bold.textContent = i.customer_name;
      nameSpan.appendChild(bold);

      const invNumSpan = document.createElement("span");
      invNumSpan.className = "muted";
      invNumSpan.textContent = ` \u2022 ${i.invoice_number}`;
      nameSpan.appendChild(invNumSpan);
      headerRow.appendChild(nameSpan);

      const statusBadge = document.createElement("div");
      statusBadge.className = "badge";
      statusBadge.textContent = i.status;
      headerRow.appendChild(statusBadge);

      card.appendChild(headerRow);

      const datesRow = document.createElement("div");
      datesRow.className = "muted";
      datesRow.textContent = `Invoice: ${i.invoice_date} \u2022 Due: ${i.due_date}`;
      card.appendChild(datesRow);

      const linkRow = document.createElement("div");
      linkRow.style.marginTop = "8px";
      const link = document.createElement("a");
      link.href = `invoice.html?id=${encodeURIComponent(i.id)}`;
      link.textContent = "Open";
      linkRow.appendChild(link);
      card.appendChild(linkRow);

      listEl.appendChild(card);
    }
  }
}

async function createInvoice() {
  const customer_id = el("invCustomer").value;
  if (!customer_id) {
    alert("Pick a customer first");
    return;
  }

  try {
    const { id } = await api("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ customer_id }),
    });
    location.href = `invoice.html?id=${encodeURIComponent(id)}`;
  } catch (err) {
    console.error("Failed to create invoice:", err);
    alert(`Failed to create invoice: ${err.message}`);
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

window.addEventListener("DOMContentLoaded", async () => {
  el("btnLoadCustomers").onclick = loadCustomers;
  el("btnAddCustomer").onclick = addCustomer;
  el("btnCreateInvoice").onclick = createInvoice;

  el("qCustomers").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadCustomers();
    }
  });

  await loadCustomers();
  await loadInvoices();
});
