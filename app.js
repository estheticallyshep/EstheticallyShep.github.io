// EstheticallyShep — app.js v3
//
// ═══════════════════════════════════════════════════════════
//  GOOGLE SHEETS SETUP — read this if prices aren't loading
// ═══════════════════════════════════════════════════════════
//
//  The site pulls prices live from your Google Sheet. For this
//  to work, you MUST publish the sheet to the web as CSV:
//
//  1. Open your Google Sheet
//  2. File → Share → Publish to web
//  3. Under "Link", choose "Entire Document" or each tab
//  4. Change format dropdown to "Comma-separated values (.csv)"
//  5. Click Publish → Copy the URL
//  6. The URL will look like:
//       https://docs.google.com/spreadsheets/d/e/LONG_ID/pub?output=csv
//     Replace PUBLISHED_SHEETS_URL below with this base URL (up to /pub)
//     and add pubhtml at the end.
//
//  7. To find your tab GIDs:
//     - Open your sheet in the browser
//     - Click the "Price List" tab → look at the URL: ...#gid=XXXXXXX
//     - Set PRICE_LIST_GID to that number
//     - Click the "Specials" tab → look at URL for its gid
//     - Set SPECIALS_GID to that number
//
//  8. Open browser console (F12) after loading the page — it
//     logs exactly what URLs it tries and why they fail.
//
// ═══════════════════════════════════════════════════════════

// Wrap everything in an IIFE (Immediately Invoked Function Expression) to avoid
// polluting the global scope with variables and functions.
(() => {
  "use strict"; // Enforce stricter JS parsing to catch common errors early.

  // ─── CONFIG ────────────────────────────────────────────
  // Published CSV URL for the "Price List" tab of the Google Sheet.
  // To update: republish the sheet and replace this URL.
  const PRICE_LIST_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=0&single=true&output=csv";

  // Published CSV URL for the "Specials" tab of the Google Sheet.
  // To update: republish the sheet and replace this URL.
  const SPECIALS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=1455379722&single=true&output=csv";

  // Published CSV URL for the "Pictures" tab of the Google Sheet.
  // To update: republish the sheet and replace this URL.
  const PICTURES_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=57851392&single=true&output=csv";

  // Internal URL for the booking page. Update this if the booking page moves.
  const INTERNAL_BOOKING_URL = "booking.html";

  // ─── DEPOSIT AMOUNT ─────────────────────────────────────
  // Flat deposit amount charged at booking time (in dollars).
  // ✏️ TO MODIFY: Change this number to update the deposit across the entire site.
  //   Example: set to 15 to charge a $15 deposit, or to 20 for a $20 deposit.
  //   This single value controls the summary bar, the modal, and the note text.
  const DEPOSIT_AMOUNT = 10;

  // ─── PAYMENT METHODS ────────────────────────────────────
  // List of accepted payment platforms shown in the deposit modal.
  // ✏️ TO MODIFY: Add, remove, or edit entries in this array.
  // Each entry needs:
  //   label  — display name of the platform (shown in bold)
  //   handle — the username/email/phone shown to customers
  //   link   — (optional) a clickable URL; set to null to render as plain text
  const PAYMENT_METHODS = [
    {
      label:  "Venmo",             // Platform display name
      handle: "@estheticallyshep", // Venmo username shown to customers
      link:   null,                // No direct Venmo deep-link; renders as plain text
    },
    {
      label:  "Zelle",                                   // Platform display name
      handle: "shepherdfields2002@gmail.com",            // Email associated with this Zelle account
      // ✏️ TO MODIFY: Generate a new Zelle QR enrollment link and paste it here.
      link:   "https://enroll.zellepay.com/qr-codes?data=ewogICJ0b2tlbiIgOiAic2hlcGhlcmRmaWVsZHMyMDAyQGdtYWlsLmNvbSIsCiAgIm5hbWUiIDogIlNoZXBoZXJkIgp9",
    },
  ];

  // ─── CART STATE ────────────────────────────────────────
  // A Map stores the cart so each service name is a unique key.
  // The value is the parsed numeric price (0 if unknown/TBD).
  // Negative prices (discounts) are stored as negative numbers and
  // automatically subtracted when computing the cart total.
  const cart = new Map(); // Maps: service name (string) → price (number)

  // ─── UTILS ─────────────────────────────────────────────

  // Shorthand for document.querySelector — selects the first matching element.
  // `root` defaults to the whole document; pass a specific element to scope the search.
  const $ = (sel, root = document) => root.querySelector(sel);

  // Shorthand for document.querySelectorAll — returns a real Array (not a NodeList).
  // `root` defaults to the whole document; pass a specific element to scope the search.
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Safely escapes a string for insertion into innerHTML, preventing XSS injection.
  // Always use this before inserting sheet data or user input into the DOM.
  function escapeHtml(text) {
    const d = document.createElement("div"); // Temporary div used as an HTML encoder
    d.textContent = String(text ?? "");       // textContent auto-escapes < > & " '
    return d.innerHTML;                        // Return the safely escaped string
  }

  // Parses a price string (e.g. "$45", "-$10") into a float.
  // Supports negative values (discounts) — returns a negative number for those.
  // Returns null if no dollar amount is found in the string.
  // ✏️ TO MODIFY: Adjust the regex if your sheet uses a different price format.
  function parsePrice(str) {
    if (!str) return null;                       // Guard: empty or null input
    const s        = String(str).trim();         // Normalize whitespace
    const negative = s.startsWith("-");          // Check for leading minus (discount)
    const m        = s.match(/\$(\d+(?:\.\d+)?)/); // Extract digits after "$"
    if (!m) return null;                          // No dollar sign found — not a price
    const value = parseFloat(m[1]);              // Parse the numeric portion as a float
    return negative ? -value : value;            // Preserve negative sign for discounts
  }

  // Formats a number as a currency string (e.g. 1234 → "$1,234", -10 → "-$10").
  // Rounds to the nearest whole dollar — no cents shown.
  // ✏️ TO MODIFY: Change toFixed(0) to toFixed(2) if you want to display cents.
  function formatMoney(num) {
    const abs = Math.abs(num).toFixed(0)          // Format magnitude without sign
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");     // Add thousands commas (e.g. 1,234)
    return (num < 0 ? "-$" : "$") + abs;           // Re-apply negative sign if needed
  }

  // Returns true if `text` looks like an HTML page rather than raw CSV data.
  // Used to detect when Google Sheets returns a login wall or error page.
  function looksLikeHtml(text) {
    const t = String(text || "").trim().slice(0, 200).toLowerCase(); // Check just the start
    return t.includes("<!doctype") || t.includes("<html") || t.includes("<body");
  }

  // Parses a CSV string into an array of row objects keyed by the header row.
  // Handles quoted fields (including quoted commas and escaped double-quotes "").
  // Skips entirely blank rows. Returns { headers, rows }.
  function parseCSV(csvText) {
    const rows = [];                            // Accumulates all parsed rows
    let row = [], cur = "", inQ = false;        // Current row, field buffer, in-quotes flag

    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];      // Current character
      const nx = csvText[i + 1]; // Next character (lookahead for "" escape sequences)

      if (ch === '"') {
        if (inQ && nx === '"') { cur += '"'; i++; } // "" inside quotes → literal quote char
        else inQ = !inQ;                              // Otherwise toggle the in-quotes state
        continue;
      }

      if (ch === ',' && !inQ) {
        row.push(cur); cur = ""; continue; // Comma outside quotes → end of field
      }

      if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && nx === '\n') i++;             // Skip \r in \r\n Windows line endings
        row.push(cur); cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row); // Skip truly blank rows
        row = []; continue;
      }

      cur += ch; // Regular character — append to current field buffer
    }

    // Flush the last row (files often have no trailing newline)
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    // First row is the header; map each subsequent row array to an object
    const headers = (rows.shift() || []).map(h => h.trim());
    return {
      headers,
      rows: rows
        .map(r => {
          const o = {};
          headers.forEach((h, i) => o[h] = (r[i] ?? "").trim()); // key each cell by header
          return o;
        })
        .filter(o => Object.values(o).some(v => v.trim() !== "")) // drop all-blank rows
    };
  }

  // Fetches a published Google Sheet CSV URL with:
  //   - An 8-second timeout (via AbortController)
  //   - Cache-busting (no-store) so fresh data is always fetched
  //   - CORS mode required for cross-origin Google requests
  // Throws a descriptive error on HTTP failures, empty responses, or HTML responses.
  async function fetchCsv(url, label) {
    const controller = new AbortController();                   // Allows us to cancel the request
    const timer = setTimeout(() => controller.abort(), 8000);   // Cancel after 8 seconds

    try {
      const res = await fetch(url, {
        cache:  "no-store",           // Bypass browser cache — always fetch fresh
        signal: controller.signal,   // Connect abort controller
        mode:   "cors",              // Required for cross-origin Sheet requests
      });
      clearTimeout(timer); // Request completed in time — cancel the abort timer

      if (!res.ok) throw new Error(`HTTP ${res.status}`); // Non-2xx response (e.g. 404)

      const text = await res.text(); // Read response body as plain text (CSV)

      if (!text || text.trim().length === 0)
        throw new Error("Empty response"); // Sheet returned nothing at all

      if (looksLikeHtml(text))
        throw new Error("Got HTML — sheet may not be published as CSV"); // Login/error page

      console.log(`[EstheticallyShep] ✓ ${label} loaded (${text.length} bytes)`);
      return text;

    } catch (err) {
      clearTimeout(timer); // Always clear the timer, even on error
      console.warn(`[EstheticallyShep] ✗ ${label} failed:`, err.message);
      throw err; // Re-throw so the caller can show an error state
    }
  }

  // Loads all three sheet tabs in parallel using Promise.all for maximum speed.
  // Photos failing is non-fatal — it resolves to [] so the rest of the page loads.
  async function loadSheetsAuto() {
    const [price, specials, pictures] = await Promise.all([
      fetchCsv(PRICE_LIST_CSV_URL, "Price List").then(t => parseCSV(t).rows), // Required
      fetchCsv(SPECIALS_CSV_URL,   "Specials"  ).then(t => parseCSV(t).rows), // Required
      fetchCsv(PICTURES_CSV_URL,   "Pictures"  ).then(t => parseCSV(t).rows).catch(() => []), // Optional
    ]);

    console.log(
      `[EstheticallyShep] ✓ Live data — ` +
      `${price.length} prices, ${specials.length} specials, ${pictures.length} photos`
    );

    return { price, specials, pictures };
  }

  // ─── GROUP BY CATEGORY ──────────────────────────────────
  // Groups flat price rows by their "Category" column value.
  // Returns an ordered array of [categoryName, itemsArray] pairs.
  // ✏️ TO MODIFY: Edit the `preferred` array to change the category display order.
  function groupByCategory(rows) {
    const map = new Map(); // category name → array of { service, price }

    rows.forEach(r => {
      const cat   = (r.Category || r.category || "Other").trim(); // Fallback to "Other"
      const svc   = (r.Service  || r.service  || "").trim();
      const price = (r.Price    || r.price    || "").trim();
      if (!svc) return; // Skip rows with no service name
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ service: svc, price });
    });

    // ✏️ TO MODIFY: Reorder or rename entries here to control the section order.
    const preferred = ["Face", "Body", "Brazilian & Bikini", "Legs", "Add On", "Bundle"];

    const ordered = [];
    preferred.forEach(c => { if (map.has(c)) ordered.push([c, map.get(c)]); }); // Preferred first
    map.forEach((v, k) => { if (!preferred.includes(k)) ordered.push([k, v]); }); // Rest after

    return ordered;
  }

  // ─── SVG ILLUSTRATIONS per category ────────────────────
  // Returns an inline decorative SVG for each service category card.
  // No external images needed — these render instantly with no network requests.
  // ✏️ TO MODIFY: Replace the SVG markup inside any `if` block with your own art.
  function categoryIllustration(cat) {
    const c = cat.toLowerCase(); // Normalize for case-insensitive matching

    if (c.includes("face") || c.includes("brow")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e7c6af"/><stop offset="1" stop-color="#bb8b4d"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g1)"/>
        <ellipse cx="145" cy="85" rx="54" ry="62" fill="rgba(150,96,68,0.25)"/>
        <ellipse cx="120" cy="78" rx="12" ry="7" fill="rgba(83,106,48,0.6)"/>
        <ellipse cx="170" cy="78" rx="12" ry="7" fill="rgba(83,106,48,0.6)"/>
        <path d="M106 66 Q120 60 134 66" fill="none" stroke="rgba(83,106,48,0.85)" stroke-width="4" stroke-linecap="round"/>
        <path d="M156 66 Q170 60 184 66" fill="none" stroke="rgba(83,106,48,0.85)" stroke-width="4" stroke-linecap="round"/>
        <text x="220" y="40" font-size="22" opacity="0.6">✨</text>
        <text x="40" y="155" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.8)" font-style="italic">Face &amp; Brow Waxing</text>
      </svg>`;

    if (c.includes("body")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#9abe83"/><stop offset="1" stop-color="#536a30"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g2)"/>
        <circle cx="145" cy="60" r="28" fill="rgba(255,255,255,0.2)"/>
        <rect x="125" y="88" width="40" height="60" rx="8" fill="rgba(255,255,255,0.18)"/>
        <rect x="100" y="92" width="22" height="50" rx="8" fill="rgba(255,255,255,0.14)"/>
        <rect x="168" y="92" width="22" height="50" rx="8" fill="rgba(255,255,255,0.14)"/>
        <text x="40" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.85)" font-style="italic">Body Waxing</text>
      </svg>`;

    if (c.includes("brazilian") || c.includes("bikini")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#966044"/><stop offset="1" stop-color="#e7c6af"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g3)"/>
        <circle cx="60" cy="40" r="30" fill="rgba(255,255,255,0.08)"/>
        <circle cx="230" cy="140" r="42" fill="rgba(255,255,255,0.08)"/>
        <path d="M60 120 Q100 90 145 100 Q190 110 230 85" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round"/>
        <text x="22" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.9)" font-style="italic">Brazilian &amp; Bikini</text>
        <text x="220" y="35" font-size="20" opacity="0.7">💗</text>
      </svg>`;

    if (c.includes("leg")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#bb8b4d"/><stop offset="1" stop-color="#9abe83"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g4)"/>
        <rect x="105" y="20" width="28" height="150" rx="14" fill="rgba(255,255,255,0.22)"/>
        <rect x="157" y="20" width="28" height="150" rx="14" fill="rgba(255,255,255,0.22)"/>
        <text x="40" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.9)" font-style="italic">Leg Waxing</text>
      </svg>`;

    if (c.includes("add")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g5" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e7c6af"/><stop offset="1" stop-color="#966044"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g5)"/>
        <text x="100" y="100" font-size="56" opacity="0.5">✨</text>
        <text x="28" y="160" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.85)" font-style="italic">Add-On Services</text>
      </svg>`;

    // Default illustration for any category not matched above (e.g. "Bundle")
    return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g6" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#9abe83"/>
            <stop offset="0.5" stop-color="#bb8b4d"/>
            <stop offset="1" stop-color="#e7c6af"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g6)"/>
        <circle cx="90" cy="75" r="34" fill="rgba(255,255,255,0.15)"/>
        <circle cx="200" cy="95" r="28" fill="rgba(255,255,255,0.15)"/>
        <text x="28" y="162" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.85)" font-style="italic">${escapeHtml(cat)}</text>
        <text x="220" y="35" font-size="20" opacity="0.65">💚</text>
      </svg>`;
  }

  // ─── CART TOTAL CALCULATOR ──────────────────────────────
  // Computes the running cart total and collects service display names.
  // Negative prices (discounts) reduce the total automatically.
  // Returns { total, names } — `total` may be less than DEPOSIT_AMOUNT if heavily discounted.
  function computeCartTotals() {
    let total = 0;     // Running sum; negative prices subtract from this
    const names = [];  // Ordered list of all selected service names

    cart.forEach((price, name) => {
      total += price;   // Discounts (negative prices) naturally reduce the total
      names.push(name);
    });

    return { total, names };
  }

  // ─── CART UI UPDATE ─────────────────────────────────────
  // Reads cart state and refreshes the sticky summary bar at the bottom of the page.
  // Shows full total, flat deposit amount, and remaining day-of balance.
  // Called any time the cart changes.
  function updateCart() {
    const bar = $("#summaryBar");
    if (!bar) return; // Guard: bar may not exist yet

    if (cart.size === 0) {
      bar.classList.remove("visible"); // Hide bar when cart is empty
      return;
    }

    const { total, names } = computeCartTotals();

    // Day-of amount = total minus the flat deposit, floored at $0
    // (handles edge case where discounts bring total below deposit amount)
    const dayOfAmount = Math.max(0, total - DEPOSIT_AMOUNT);

    const svcEl   = bar.querySelector(".summaryServices");   // Service names display
    const totalEl = bar.querySelector(".summaryTotalAmt");   // Full total display
    const depEl   = bar.querySelector(".summaryDepositAmt"); // Deposit line display

    if (svcEl)   svcEl.textContent  = names.join(", ");
    if (totalEl) totalEl.textContent = formatMoney(total);
    // Show both the deposit due now AND the remaining balance at the appointment
    if (depEl)   depEl.textContent  =
      `${formatMoney(DEPOSIT_AMOUNT)} deposit · ${formatMoney(dayOfAmount)} due at appt`;

    bar.classList.add("visible"); // Show the bar
  }

  // Handles checkbox change events on the price list rows.
  // Adds or removes the service from the cart and syncs any duplicate checkboxes.
  function handleCheck(e) {
    const cb    = e.target;                      // The checkbox element that was toggled
    const name  = cb.dataset.service;           // Service name from data-service attribute
    const price = parseFloat(cb.dataset.price); // Numeric price from data-price attribute

    if (cb.checked) {
      cart.set(name, isNaN(price) ? 0 : price); // Add to cart (use 0 for TBD prices)
    } else {
      cart.delete(name); // Remove from cart
    }

    // Sync all checkboxes that share the same data-service value
    $$(`input.priceCheck[data-service="${CSS.escape(name)}"]`).forEach(el => {
      el.checked = cart.has(name); // Keep all instances consistent with cart state
    });

    updateCart(); // Refresh the summary bar
  }

  // Clears the entire cart and unchecks all price checkboxes on the page.
  function clearCart() {
    cart.clear();                                           // Wipe the Map completely
    $$("input.priceCheck").forEach(el => { el.checked = false; }); // Uncheck every box
    updateCart();                                          // Hide/reset the summary bar
  }

  // ─── DEPOSIT MODAL ──────────────────────────────────────
  // Opens the payment modal, populating it with cart line items and all three totals:
  //   1. Full service total (with any discounts already applied)
  //   2. Flat deposit due today (DEPOSIT_AMOUNT constant)
  //   3. Remaining balance due at the appointment
  function openDepositModal() {
    if (cart.size === 0) return; // Don't open with an empty cart

    const { total } = computeCartTotals();

    // Day-of balance = full total minus the flat deposit, minimum $0
    const dayOfAmount = Math.max(0, total - DEPOSIT_AMOUNT);

    const modal = $("#depositModal");
    if (!modal) return; // Guard: modal element must exist in the DOM

    // Build per-service line item rows for the modal
    const rowsHtml = Array.from(cart.entries()).map(([name, price]) => `
      <div class="modalRow">
        <span class="svc">${escapeHtml(name)}</span>
        <!-- Show formatted price if non-zero; em dash for TBD/free items -->
        <span class="price">${price !== 0 ? formatMoney(price) : "—"}</span>
      </div>
    `).join("");

    // Inject line items and totals into the pre-built modal DOM slots
    modal.querySelector(".modalServices").innerHTML = rowsHtml;
    modal.querySelector(".modalFullTotal").textContent    = formatMoney(total);       // Grand total
    modal.querySelector(".modalDepositTotal").textContent = formatMoney(DEPOSIT_AMOUNT); // Flat deposit
    modal.querySelector(".modalDayOfTotal").textContent   = formatMoney(dayOfAmount); // Day-of balance

    modal.classList.add("open");             // Show the modal overlay
    document.body.style.overflow = "hidden"; // Prevent background scroll while modal is open
  }

  // Closes the payment modal and restores background scrolling.
  function closeDepositModal() {
    const modal = $("#depositModal");
    if (modal) modal.classList.remove("open"); // Hide the overlay
    document.body.style.overflow = "";          // Restore page scrolling
  }

  // ─── GOOGLE DRIVE URL CONVERTER ────────────────────────
  // Google Drive "share" links redirect to a preview page and cannot be used
  // directly as <img src>. This converts any Drive URL format to a direct CDN
  // embed URL via lh3.googleusercontent.com, which never requires authentication.
  //
  // Supported input formats:
  //   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  //   https://drive.google.com/file/d/FILE_ID/view
  //   https://drive.google.com/open?id=FILE_ID
  //   https://drive.google.com/uc?id=FILE_ID
  //   https://drive.google.com/uc?export=view&id=FILE_ID
  //
  // ✏️ TO MODIFY: Change =w800 at the end to request a different image width.
  //   e.g. =w1200 for higher resolution, =w400 for thumbnails.
  function convertDriveUrl(url) {
    if (!url) return ""; // Guard against missing/null input

    if (url.includes("lh3.googleusercontent.com")) return url; // Already a CDN URL — skip

    let fileId = null; // Will hold the extracted Drive file ID string

    // Pattern 1: /file/d/FILE_ID/ — the most common share link format
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (fileMatch) fileId = fileMatch[1];

    // Pattern 2: ?id=FILE_ID or &id=FILE_ID — query-parameter style
    if (!fileId) {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
      if (idMatch) fileId = idMatch[1];
    }

    // Pattern 3: open?id=FILE_ID — older Drive open links
    if (!fileId) {
      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]{10,})/);
      if (openMatch) fileId = openMatch[1];
    }

    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}=w800`; // Direct CDN embed URL
    }

    return url; // Not a Drive URL — return unchanged (may already be a direct image URL)
  }

  // ─── RENDER PHOTO CAROUSEL ─────────────────────────────
  // Builds the photo gallery from the Pictures sheet tab.
  // Each row needs an Image column (Drive link or direct URL).
  // Heading and Description columns are optional (shown as a caption overlay).
  // First 3 images load eagerly; the rest are lazy-loaded for performance.
  function renderPhotoCarousel(pictures) {
    const root = $("#photoCarousel");
    if (!root) return; // Guard: container must exist in HTML

    if (!pictures || pictures.length === 0) {
      root.style.display = "none"; // No pictures — hide the carousel section entirely
      return;
    }

    // Build HTML for each photo slide
    const slides = pictures.map((row, i) => {
      const rawUrl  = (row.Image || row.image || row.URL || row.url || "").trim();
      const imgUrl  = convertDriveUrl(rawUrl); // Convert Drive links to embeddable CDN URLs
      const heading = (row.Heading || row.heading || row.Title || row.title || "").trim();
      const desc    = (row.Description || row.description || "").trim();

      if (!imgUrl) return ""; // Skip rows with no image URL

      return `
        <div class="photoSlide" data-animate="fade-up">
          <div class="photoSlideInner">
            <img
              src="${escapeHtml(imgUrl)}"
              alt="${escapeHtml(heading || "EstheticallyShep service photo")}"
              class="photoSlideImg"
              loading="${i < 3 ? "eager" : "lazy"}"
              onerror="this.closest('.photoSlide').style.display='none'"
            />
            ${(heading || desc) ? `
              <div class="photoSlideCaption">
                ${heading ? `<div class="photoCaptionTitle">${escapeHtml(heading)}</div>` : ""}
                ${desc    ? `<div class="photoCaptionDesc">${escapeHtml(desc)}</div>`    : ""}
              </div>` : ""}
          </div>
        </div>
      `;
    }).filter(Boolean).join(""); // Remove empty strings from skipped rows

    if (!slides) { root.style.display = "none"; return; } // All rows were invalid — hide carousel

    root.innerHTML = `
      <div class="photoCarouselTop">
        <div class="photoCarouselControls">
          <button class="carouselBtn" type="button" id="photoPrev" aria-label="Previous photo">‹</button>
          <button class="carouselBtn" type="button" id="photoNext" aria-label="Next photo">›</button>
        </div>
      </div>
      <div class="photoTrack" id="photoTrack" tabindex="0" aria-label="Photo gallery">
        ${slides}
      </div>
      <div class="photoDots" id="photoDots" aria-hidden="true"></div>
    `;

    const track  = root.querySelector("#photoTrack");
    const dotsEl = root.querySelector("#photoDots");
    const items  = track.querySelectorAll(".photoSlide"); // All slide elements
    const total  = items.length;

    // Render navigation dots if there's more than one photo
    if (total > 1 && dotsEl) {
      dotsEl.innerHTML = Array.from({ length: total }, (_, i) =>
        `<button class="photoDot${i === 0 ? " active" : ""}" data-idx="${i}" aria-label="Go to photo ${i + 1}"></button>`
      ).join("");

      dotsEl.addEventListener("click", e => {
        const btn = e.target.closest(".photoDot");
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx);
        const w   = items[0]?.getBoundingClientRect().width || 320; // Slide width
        track.scrollTo({ left: idx * (w + 16), behavior: "smooth" }); // Scroll to that slide
      });
    }

    // Update the active dot indicator as the carousel scrolls (debounced for performance)
    let scrollTimer;
    track.addEventListener("scroll", () => {
      clearTimeout(scrollTimer); // Reset debounce window on each scroll event
      scrollTimer = setTimeout(() => {
        const w   = items[0]?.getBoundingClientRect().width || 320;
        const idx = Math.round(track.scrollLeft / (w + 16)); // Which slide is most visible
        dotsEl?.querySelectorAll(".photoDot").forEach((d, i) => {
          d.classList.toggle("active", i === idx); // Highlight the current dot
        });
      }, 60); // 60ms debounce — responsive but not thrashing
    });

    root.querySelector("#photoPrev")?.addEventListener("click", () => {
      const w = items[0]?.getBoundingClientRect().width || 320;
      track.scrollBy({ left: -(w + 16), behavior: "smooth" }); // Scroll left one slide
    });
    root.querySelector("#photoNext")?.addEventListener("click", () => {
      const w = items[0]?.getBoundingClientRect().width || 320;
      track.scrollBy({ left: w + 16, behavior: "smooth" }); // Scroll right one slide
    });

    // Touch swipe support for mobile — only triggers on swipes longer than 50px
    let touchStartX = 0;
    track.addEventListener("touchstart", e => {
      touchStartX = e.touches[0].clientX; // Record the starting X position
    }, { passive: true }); // passive: we never call preventDefault here (better scroll perf)

    track.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].clientX; // Positive = swiped left
      if (Math.abs(diff) > 50) { // Ignore tiny taps; only respond to deliberate swipes
        const w = items[0]?.getBoundingClientRect().width || 320;
        track.scrollBy({ left: diff > 0 ? (w + 16) : -(w + 16), behavior: "smooth" });
      }
    }, { passive: true });
  }

  // ─── RENDER SERVICES CAROUSEL ───────────────────────────
  // Renders the overview card carousel at the top of the services section.
  // Each card shows the category's decorative SVG, name, a 3-service preview,
  // and a "View prices" link that anchors to the pricing tables below.
  function renderCarousel(groups) {
    const root = $("#servicesCarousel");
    if (!root) return; // Guard: container must exist in HTML

    const slides = groups.map(([cat, items]) => {
      const top3 = items.slice(0, 3).map(x => escapeHtml(x.service)).join(" · "); // Preview list

      return `
        <article class="slide glass" data-animate="fade-up">
          <div class="slideMedia">
            ${categoryIllustration(cat)} <!-- Inline SVG illustration for this category -->
          </div>
          <div class="slideBody">
            <h3>${escapeHtml(cat)}</h3>
            <p class="muted">${top3 || "See pricing below."}</p>
            <a class="btn secondary" href="#pricing" aria-label="View ${escapeHtml(cat)} prices">
              View prices
            </a>
          </div>
        </article>
      `;
    }).join("");

    root.innerHTML = `
      <div class="carouselTop">
        <h2 class="sectionTitle">Services</h2>
        <div class="carouselControls">
          <button class="carouselBtn" type="button" id="carPrev" aria-label="Previous">‹</button>
          <button class="carouselBtn" type="button" id="carNext" aria-label="Next">›</button>
        </div>
      </div>
      <div class="carouselTrack" id="carouselTrack" tabindex="0" aria-label="Services carousel">
        ${slides}
      </div>
    `;

    const track = $("#carouselTrack");
    $("#carPrev")?.addEventListener("click", () => {
      const w = track.querySelector(".slide")?.getBoundingClientRect().width || 300;
      track.scrollBy({ left: -(w + 18), behavior: "smooth" }); // Scroll left one card
    });
    $("#carNext")?.addEventListener("click", () => {
      const w = track.querySelector(".slide")?.getBoundingClientRect().width || 300;
      track.scrollBy({ left: w + 18, behavior: "smooth" }); // Scroll right one card
    });
  }

  // ─── RENDER PRICING TABLES ──────────────────────────────
  // Builds the interactive price list as collapsible <details> accordion sections.
  // Each row has a checkbox so customers can add services to their cart.
  // Negative prices (discounts) display normally and are deducted from the cart total.
  function renderPricing(groups) {
    const root = $("#pricingList");
    if (!root) return; // Guard: container must exist in HTML

    // ✏️ TO MODIFY: Update this instructional note shown above the price list.
    const note = `<p class="pricingNote">
      Select the services you want below, then send your ${formatMoney(DEPOSIT_AMOUNT)} deposit
      using one of the payment options.
    </p>`;

    const tableHtml = groups.map(([cat, items]) => {
      const rows = items.map(({ service, price }) => {
        const num          = parsePrice(price);  // Parsed number (null if unparseable)
        const hasParsedPrice = num !== null;      // True if we got a valid numeric price

        // Show the raw price string if available; show "Ask to inquire" for blank prices
        const displayPrice = price
          ? escapeHtml(price)
          : `<span class="rowInquire">Ask to inquire</span>`;

        // Checkbox with data attributes used by handleCheck() to update the cart.
        // data-price stores the numeric value (negative for discounts, 0 for TBD).
        const cb = `<input
          type="checkbox"
          class="priceCheck"
          aria-label="${escapeHtml(hasParsedPrice ? `Select ${service}` : `Select ${service} (price TBD)`)}"
          data-service="${escapeHtml(service)}"
          data-price="${hasParsedPrice ? num : 0}"
        />`;

        return `
          <tr>
            <td class="check">${cb}</td>
            <td>${escapeHtml(service)}</td>
            <td class="right">${displayPrice}</td> <!-- Negative prices show as e.g. "-$10" -->
          </tr>
        `;
      }).join("");

      // <details> gives free accordion behavior with no JS needed for open/close
      return `
        <details class="priceDropdown" aria-label="${escapeHtml(cat)} price list">
          <summary>
            <span class="priceDropdownTitle">${escapeHtml(cat)}</span>
            <span class="priceDropdownIcon" aria-hidden="true">+</span>
          </summary>
          <table class="priceTable">
            <tbody>${rows}</tbody>
          </table>
        </details>
      `;
    }).join("");

    root.innerHTML = `
      ${note}
      <div class="pricingWrap">
        <div class="priceDropdowns">${tableHtml}</div>
      </div>
    `;

    // Attach change listeners to all checkboxes so cart updates on every toggle
    $$("input.priceCheck", root).forEach(cb => {
      cb.addEventListener("change", handleCheck);
    });
  }

  // ─── RENDER SPECIALS ────────────────────────────────────
  // Renders combo/deal cards from the Specials sheet tab.
  // Expected columns: Emoji, Combo Name, Description.
  // Shows a "coming soon" placeholder if the sheet is empty.
  function renderSpecials(rows) {
    const root = $("#specialsList");
    if (!root) return; // Guard: container must exist in HTML

    if (!rows || rows.length === 0) {
      root.innerHTML = `<p class="muted">Specials coming soon ✨</p>`; // Friendly placeholder
      return;
    }

    const cards = rows.map(r => {
      const emoji = (r.Emoji || r.emoji || "✨").trim();         // Decorative emoji icon
      const name  = (r["Combo Name"] || r.combo || "").trim();   // Deal/combo name
      const desc  = (r.Description || r.description || "").trim(); // Short description

      return `
        <div class="specialCard">
          <div class="specialEmoji">${escapeHtml(emoji)}</div>
          <div class="specialName">${escapeHtml(name || "Special")}</div>
          <div class="specialDesc">${escapeHtml(desc)}</div>
        </div>
      `;
    }).join("");

    root.innerHTML = `<div class="specialsGrid">${cards}</div>`;
  }

  // ─── RENDER SUMMARY BAR ─────────────────────────────────
  // Creates the sticky bottom bar that appears once items are added to the cart.
  // Displays: selected service names, full total, deposit amount, and day-of balance.
  // Idempotent — safe to call multiple times; only creates the bar once.
  function renderSummaryBar() {
    if ($("#summaryBar")) return; // Already in the DOM — skip

    const wrap = document.createElement("div");
    wrap.className = "summaryStickyWrap";

    wrap.innerHTML = `
      <div class="summaryBar" id="summaryBar">
        <div class="summaryLeft">
          <span class="summaryLabel">Selected services</span>
          <span class="summaryServices">—</span> <!-- Filled by updateCart() -->
        </div>
        <div class="summaryRight">
          <div>
            <div class="summaryTotal"><span class="summaryTotalAmt">$0</span></div>
            <!-- Shows both deposit due now and remaining balance — filled by updateCart() -->
            <div class="summaryDeposit"><span class="summaryDepositAmt"></span></div>
          </div>
          <div class="summaryActions">
            <button class="clearBtn"   id="clearCartBtn"   type="button">Clear</button>
            <button class="proceedBtn" id="openDepositBtn" type="button">View payment options</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wrap); // Append to body so it floats above all content

    document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
    document.getElementById("openDepositBtn")?.addEventListener("click", openDepositModal);
  }

  // ─── RENDER DEPOSIT MODAL ───────────────────────────────
  // Creates the payment modal overlay that shows:
  //   - Line items for each selected service
  //   - Full total (with discounts applied)
  //   - Flat deposit due today (from DEPOSIT_AMOUNT constant)
  //   - Remaining balance due at the appointment
  //   - Payment method entries (Venmo, Zelle with clickable QR link)
  //   - Link to the booking page
  // Idempotent — safe to call multiple times; only creates the modal once.
  function renderDepositModal() {
    if ($("#depositModal")) return; // Already in the DOM — skip

    const modal = document.createElement("div");
    modal.className = "modalOverlay";
    modal.id        = "depositModal";
    modal.setAttribute("role",            "dialog"); // Accessibility: screen readers announce as dialog
    modal.setAttribute("aria-modal",      "true");   // Accessibility: traps focus within modal
    modal.setAttribute("aria-labelledby", "modalTitle");

    // Build payment method entries from the PAYMENT_METHODS config at the top.
    // Items with a `link` become clickable anchors; others render as plain text.
    // ✏️ TO MODIFY: Edit the PAYMENT_METHODS array to add/remove/change payment options.
    const paymentRowsHtml = PAYMENT_METHODS.map(({ label, handle, link }) => {
      const handleHtml = link
        ? `<a class="paymentHandle paymentLink"
              href="${escapeHtml(link)}"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Pay via ${escapeHtml(label)}"
           >${escapeHtml(handle)}</a>` // Clickable link (e.g. Zelle QR code URL)
        : `<span class="paymentHandle">${escapeHtml(handle)}</span>`; // Plain text (e.g. Venmo)

      return `
        <div class="paymentRow">
          <span class="paymentPlatform">${escapeHtml(label)}</span>
          ${handleHtml}
        </div>
      `;
    }).join("");

    modal.innerHTML = `
      <div class="modalCard">
        <div class="modalHead">
          <h3 id="modalTitle">Pay Your Deposit</h3>
          <button class="modalClose" id="closeModal" aria-label="Close">✕</button>
        </div>

        <!-- Per-service line items; injected by openDepositModal() each time modal opens -->
        <div class="modalServices"></div>

        <div class="modalTotals">
          <!-- Full service total, reflecting any discount (negative price) deductions -->
          <div class="modalTotalRow">
            <span class="label">Total services</span>
            <span class="val modalFullTotal">$0</span>
          </div>
          <!-- Flat deposit due today — amount set by the DEPOSIT_AMOUNT constant above -->
          <div class="modalTotalRow deposit">
            <span class="label">Deposit due today</span>
            <span class="val modalDepositTotal">$0</span>
          </div>
          <!-- Remaining balance the customer pays on the day of the appointment -->
          <div class="modalTotalRow day-of">
            <span class="label">Due at appointment</span>
            <span class="val modalDayOfTotal">$0</span>
          </div>
        </div>

        <!-- ✏️ TO MODIFY: Update the deposit instructions text below. -->
        <p class="modalNote">
          Send your ${formatMoney(DEPOSIT_AMOUNT)} deposit using one of the payment methods below.
          Include your name and selected services in the payment note.
          After payment, continue to the booking calendar to choose your time slot.
        </p>

        <!-- Payment platform entries (Venmo, Zelle, etc.) -->
        <div class="paymentMethods">
          ${paymentRowsHtml}
        </div>

        <!-- Booking link shown after the customer has sent their deposit -->
        <div style="margin-top:16px; text-align:center">
          <p class="muted" style="font-size:0.8rem; margin-bottom:12px;">After sending your deposit:</p>
          <a class="btn secondary" href="${escapeHtml(INTERNAL_BOOKING_URL)}">
            Go to booking page
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal); // Append to body so it overlays everything

    document.getElementById("closeModal")?.addEventListener("click", closeDepositModal);

    // Clicking the dark backdrop (outside the white card) closes the modal
    modal.addEventListener("click", e => {
      if (e.target === modal) closeDepositModal(); // Only fire if clicking the overlay itself
    });

    // Pressing Escape closes the modal — standard accessible dialog behavior
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeDepositModal();
    });
  }

  // ─── SCROLL ANIMATIONS ──────────────────────────────────
  // Uses IntersectionObserver to add an "inview" CSS class when elements scroll into view.
  // Elements that should animate need the [data-animate] attribute in their HTML.
  // Falls back to showing all elements immediately on browsers without IO support.
  function wireAnimations() {
    const els = document.querySelectorAll("[data-animate]"); // All elements marked for animation

    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("inview")); // Fallback: show everything immediately
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("inview"); // Trigger CSS animation
          io.unobserve(e.target);           // Unobserve once animated to free memory
        }
      });
    }, { threshold: 0.1 }); // Fire when at least 10% of the element is visible

    els.forEach(el => io.observe(el)); // Begin watching all animatable elements
  }

  // ─── BOOT ───────────────────────────────────────────────
  // Application entry point. Runs once the DOM is fully parsed.
  // Renders static UI chrome immediately, then fetches sheet data asynchronously.
  // Gracefully degrades to an error state with a fallback DM link on failure.
  async function init() {
    const status = $("#liveStatus"); // Optional status text element in the HTML (may be null)

    // Render the summary bar and modal immediately — they don't depend on sheet data
    renderSummaryBar();
    renderDepositModal();

    try {
      // Fetch all three sheet tabs simultaneously for fastest load
      const { price, specials, pictures } = await loadSheetsAuto();

      const groups = groupByCategory(price); // Organize price rows into category groups

      // Render all dynamic content sections with the fetched data
      renderPhotoCarousel(pictures); // Photo gallery
      renderCarousel(groups);        // Service category cards
      renderPricing(groups);         // Interactive price tables with checkboxes
      renderSpecials(specials);      // Combo/deal cards

      if (status) status.textContent = "✓ Live menu loaded."; // Signal success (if element exists)

    } catch (err) {
      console.error("[EstheticallyShep] Failed to load menu:", err);
      if (status) status.textContent = "⚠️ Could not load menu — please refresh.";

      // ✏️ TO MODIFY: Update the Instagram handle below to change the fallback DM link.
      const msg = `<p style="padding:20px; color:#966044; background:rgba(150,96,68,0.08); border-radius:12px; border:1px solid rgba(150,96,68,0.2);">
        Unable to load pricing right now. Please refresh the page or DM
        <a href="https://instagram.com/esthetically.shep" target="_blank" rel="noopener" style="color:#536a30; font-weight:600;">@esthetically.shep</a>
        on Instagram for current pricing.
      </p>`;

      // Apply the fallback message to content sections that failed to render
      const pricingList  = document.getElementById("pricingList");
      const carousel     = document.getElementById("servicesCarousel");
      const specialsList = document.getElementById("specialsList");

      if (pricingList)  pricingList.innerHTML  = msg; // Pricing gets the full fallback message
      if (carousel)     carousel.innerHTML      = ""; // Clear carousel silently (no distraction)
      if (specialsList) specialsList.innerHTML  = ""; // Clear specials silently
    }

    wireAnimations(); // Set up scroll-triggered entry animations after all content is rendered
  }

  // Wait for the full HTML document to finish parsing before running init().
  // Ensures all DOM elements (carousels, lists, modals) exist before we query them.
  document.addEventListener("DOMContentLoaded", init);

})(); // End of IIFE — executes immediately when the script is loaded
