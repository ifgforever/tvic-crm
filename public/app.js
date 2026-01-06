/**
 * Main CRM app JavaScript - Patched version
 * Fixes: XSS protection, proper error handling
 */

// ============================================================
// FETCH HELPER
// ============================================================
async function api(path, opts = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...opts,
  };

  if (opts.headers) {
    config.headers = { ...config.headers, ...opts.headers };
  }

  let res;
  try {
    res = await fetch(path, config);
  } catch (networkError) {
    throw new Error(`Network error: ${networkError.message}`);
  }

  const contentType = res.headers.get("Content-Type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      throw new Error(`Invalid JSON response from server`);
    }
  } else {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Server error ${res.status}: ${text.slice(0, 100)}`);
    }
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`);
  }

  return data;
}

// ============================================================
// UTILITIES
// ============================================================

function el(id) {
  return document.getElementById(id);
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
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
    el("customersList").innerHTML = `<div class="muted">Error loading customers: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const listEl = el("customersList");
  listEl.innerHTML = ""; // Clear

  if (!rows || rows.length === 0) {
    listEl.innerHTML = `<div class="muted">No matches.</div>`;
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
      // Using \u2022 for bullet point (safe Unicode)
      const contactParts = [c.phone, c.email].filter(Boolean);
      contactDiv.textContent = contactParts.join(" \u2022 ");
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
    option.textContent = c.name; // Safe: textContent
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
    el("cName").focus();
    return;
  }

  try {
    await api("/api/customers", { method: "POST", body: JSON.stringify(body) });

    // Clear form
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
    el("invoicesList").innerHTML = `<div class="muted">Error loading invoices: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const listEl = el("invoicesList");
  listEl.innerHTML = "";

  if (!rows || rows.length === 0) {
    listEl.innerHTML = `<div class="muted">No invoices yet.</div>`;
  } else {
    for (const i of rows) {
      const card = document.createElement("div");
      card.style.cssText = "padding:10px;border:1px solid #1b2a4a;border-radius:12px;margin:8px 0";

      // Header row
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

      // Dates row
      const datesRow = document.createElement("div");
      datesRow.className = "muted";
      datesRow.textContent = `Invoice: ${i.invoice_date} \u2022 Due: ${i.due_date}`;
      card.appendChild(datesRow);

      // Link row
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

  // Allow Enter key in search to trigger search
  el("qCustomers").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadCustomers();
    }
  });

  await loadCustomers();
  await loadInvoices();
});async function api(path, opts={}) {
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
