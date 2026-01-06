/**
 * Invoice page JavaScript - Patched version
 * Fixes: XSS protection, proper error handling, encoding safety
 */

// ============================================================
// FETCH HELPER - Improved for Cloudflare Workers
// ============================================================
async function api(path, opts = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    // credentials: 'same-origin' is default and correct for same-origin API calls
    // Don't use 'include' unless you need cross-origin cookies
    ...opts,
  };

  // Merge headers properly if opts.headers exists
  if (opts.headers) {
    config.headers = { ...config.headers, ...opts.headers };
  }

  let res;
  try {
    res = await fetch(path, config);
  } catch (networkError) {
    // Network error (offline, DNS failure, etc.)
    throw new Error(`Network error: ${networkError.message}`);
  }

  // Handle non-JSON responses gracefully
  const contentType = res.headers.get("Content-Type") || "";
  let data = {};

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (parseError) {
      throw new Error(`Invalid JSON response from server`);
    }
  } else {
    // Non-JSON response (could be HTML error page, etc.)
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
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format cents as currency string
 */
function money(cents) {
  const num = Number(cents) || 0;
  return `$${(num / 100).toFixed(2)}`;
}

/**
 * Get element by ID with null check
 */
function el(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id "${id}" not found`);
  }
  return element;
}

/**
 * Escape HTML to prevent XSS attacks
 * This is critical when displaying user-provided data
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Create a text node (alternative to escapeHtml for DOM building)
 */
function text(str) {
  return document.createTextNode(str === null || str === undefined ? "" : String(str));
}

// ============================================================
// MAIN LOGIC
// ============================================================

const invoiceId = new URLSearchParams(location.search).get("id");

/**
 * Load invoice data and render the page
 */
async function load() {
  if (!invoiceId) {
    alert("Missing invoice id");
    return;
  }

  let data;
  try {
    data = await api(`/api/invoices/${encodeURIComponent(invoiceId)}`);
  } catch (err) {
    console.error("Failed to load invoice:", err);
    alert(`Failed to load invoice: ${err.message}`);
    return;
  }

  const inv = data.invoice;
  const items = data.items || [];
  const totals = data.totals || { subtotalCents: 0, taxCents: 0, totalCents: 0 };

  // Render header - using safe text content
  // Using \u2022 (bullet) which is a safe Unicode character
  const hdrEl = el("hdr");
  if (hdrEl) {
    hdrEl.textContent = `${inv.invoice_number} \u2022 ${inv.customer_name}`;
  }

  const statusEl = el("status");
  if (statusEl) {
    statusEl.textContent = inv.status;
  }

  // Render meta section - safe DOM building
  const metaEl = el("meta");
  if (metaEl) {
    metaEl.innerHTML = ""; // Clear existing content

    // First line: customer name and email
    const line1 = document.createElement("div");
    const bold = document.createElement("b");
    bold.textContent = inv.customer_name;
    line1.appendChild(bold);

    const emailSpan = document.createElement("span");
    emailSpan.className = "muted";
    emailSpan.textContent = ` (${inv.customer_email || "no email"})`;
    line1.appendChild(emailSpan);

    metaEl.appendChild(line1);

    // Second line: dates
    const line2 = document.createElement("div");
    line2.className = "muted";
    line2.textContent = `Invoice date: ${inv.invoice_date} \u2022 Due: ${inv.due_date}`;
    metaEl.appendChild(line2);
  }

  // Render line items - safe DOM building to prevent XSS
  const itemsEl = el("items");
  if (itemsEl) {
    itemsEl.innerHTML = ""; // Clear existing rows

    for (const item of items) {
      const row = document.createElement("tr");

      // Description cell
      const descCell = document.createElement("td");
      descCell.textContent = item.description; // Safe: textContent escapes HTML
      row.appendChild(descCell);

      // Qty cell
      const qtyCell = document.createElement("td");
      qtyCell.setAttribute("align", "right");
      qtyCell.textContent = String(item.qty);
      row.appendChild(qtyCell);

      // Unit price cell
      const unitCell = document.createElement("td");
      unitCell.setAttribute("align", "right");
      unitCell.textContent = money(item.unit_price_cents);
      row.appendChild(unitCell);

      // Line total cell
      const lineTotal = Math.round(Number(item.qty) * Number(item.unit_price_cents));
      const lineCell = document.createElement("td");
      lineCell.setAttribute("align", "right");
      lineCell.textContent = money(lineTotal);
      row.appendChild(lineCell);

      itemsEl.appendChild(row);
    }
  }

  // Render totals - safe text content
  const subtotalEl = el("subtotal");
  if (subtotalEl) subtotalEl.textContent = money(totals.subtotalCents);

  const taxEl = el("tax");
  if (taxEl) taxEl.textContent = money(totals.taxCents);

  const totalEl = el("total");
  if (totalEl) totalEl.textContent = money(totals.totalCents);
}

/**
 * Add a new line item to the invoice
 */
async function addItem() {
  const descEl = el("desc");
  const qtyEl = el("qty");
  const unitEl = el("unit");

  if (!descEl || !qtyEl || !unitEl) {
    alert("Form elements not found");
    return;
  }

  const description = descEl.value.trim();
  const qty = Number(qtyEl.value) || 1;
  const unit_price = Number(unitEl.value) || 0;

  // Validation
  if (!description) {
    alert("Description required");
    descEl.focus();
    return;
  }

  if (qty <= 0) {
    alert("Quantity must be greater than 0");
    qtyEl.focus();
    return;
  }

  if (unit_price < 0) {
    alert("Unit price cannot be negative");
    unitEl.focus();
    return;
  }

  try {
    await api(`/api/invoices/${encodeURIComponent(invoiceId)}/items`, {
      method: "POST",
      body: JSON.stringify({ description, qty, unit_price }),
    });

    // Clear form
    descEl.value = "";
    qtyEl.value = "1";
    unitEl.value = "";

    // Reload to show new item
    await load();
  } catch (err) {
    console.error("Failed to add item:", err);
    alert(`Failed to add item: ${err.message}`);
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

window.addEventListener("DOMContentLoaded", async () => {
  if (!invoiceId) {
    alert("Missing invoice id in URL");
    return;
  }

  const btnAdd = el("btnAdd");
  if (btnAdd) {
    btnAdd.onclick = addItem;
  }

  // Also allow Enter key in the unit price field to add item
  const unitEl = el("unit");
  if (unitEl) {
    unitEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addItem();
      }
    });
  }

  await load();
});
