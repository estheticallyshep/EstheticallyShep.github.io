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

// Wraps everything in an immediately-invoked function so our variables
// don't accidentally conflict with other scripts on the page.
(() => {
  "use strict"; // Enables strict mode — catches common JS mistakes early.

  // ─── CONFIG ────────────────────────────────────────────
  // These are the direct "Publish to web" CSV URLs from your Google Sheet.
  // ✏️ MODIFY: If you ever recreate your Google Sheet, replace these URLs
  //            with the new ones from File → Share → Publish to web.

  // URL for the main price list tab (gid=0 means the first tab).
  const PRICE_LIST_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=0&single=true&output=csv";

  // URL for the specials tab (gid=1455379722 is that tab's ID).
  const SPECIALS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=1455379722&single=true&output=csv";

  // URL for the pictures/portfolio tab (gid=57851392 is that tab's ID).
  const PICTURES_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=57851392&single=true&output=csv";

  // The relative path to your booking page. Used in the modal's "Go to booking" button.
  // ✏️ MODIFY: Change this if your booking page is at a different URL.
  const INTERNAL_BOOKING_URL = "booking.html";

  // ✏️ MODIFY: The flat deposit amount customers must pay to hold their appointment.
  //            This single number controls all deposit-related text and calculations
  //            throughout the page — change it here and it updates everywhere.
  const DEPOSIT_AMOUNT = 10; // dollars

  // ✏️ MODIFY: The list of accepted payment methods shown in the deposit modal.
  //            Each entry needs a `label` (display name) and a `handle` (your ID on that platform).
  //            To add a method: add a new { label, handle } object to this array.
  //            To remove a method: delete its line.
  //            To make a method clickable, add a `url` property (see Zelle below).
  const PAYMENT_METHODS = [
    {
      label: "Venmo",          // The payment platform's name shown to the customer.
      handle: "@estheticallyshep", // Your username/handle on that platform.
      // No `url` here — Venmo will just show as plain text.
    },
    {
      label: "Zelle",          // The payment platform's name shown to the customer.
      handle: "estheticallyshep@gmail.com", // Your Zelle-registered email address.
      // ✏️ MODIFY: Replace this URL if your Zelle QR code link ever changes.
      url: "https://enroll.zellepay.com/qr-codes?data=ewogICJ0b2tlbiIgOiAic2hlcGhlcmRmaWVsZHMyMDAyQGdtYWlsLmNvbSIsCiAgIm5hbWUiIDogIlNoZXBoZXJkIgp9",
      // `url` makes this entry render as a clickable link instead of plain text.
    },
  ];

  // ─── CART STATE ────────────────────────────────────────
  // A Map that stores the currently selected services.
  // Key = service name (string), Value = service price (number).
  const cart = new Map();

  // ─── UTILS ─────────────────────────────────────────────

  // Shorthand for document.querySelector — finds the first matching element.
  const $ = (sel, root = document) => root.querySelector(sel);

  // Shorthand for document.querySelectorAll — finds ALL matching elements as a plain array.
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Converts plain text into safe HTML by escaping special characters like < > &.
  // This prevents injected content from being treated as real HTML (XSS protection).
  function escapeHtml(text) {
    const d = document.createElement("div"); // Creates a temporary element.
    d.textContent = String(text ?? "");      // Assigns raw text (auto-escapes it).
    return d.innerHTML;                      // Returns the safely escaped HTML string.
  }

  // Extracts a dollar amount from a price string like "$45" or "$45.00".
  // Returns a float (e.g., 45.0) or null if no price was found.
  function parsePrice(str) {
    if (!str) return null;                           // Nothing to parse.
    const m = String(str).match(/\$(\d+(?:\.\d+)?)/); // Look for "$" followed by digits.
    return m ? parseFloat(m[1]) : null;              // Return the number or null.
  }

  // Formats a number like 45 into a display string like "$45".
  // Uses toFixed(0) to round to whole dollars, and adds commas for thousands.
  function formatMoney(num) {
    return "$" + num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // Checks if a text response looks like an HTML page instead of CSV data.
  // Google Sheets sometimes returns an HTML error page instead of the CSV.
  function looksLikeHtml(text) {
    const t = String(text || "").trim().slice(0, 200).toLowerCase(); // Check just the first 200 chars.
    return t.includes("<!doctype") || t.includes("<html") || t.includes("<body"); // HTML markers.
  }

  // Parses a raw CSV string into an array of objects.
  // Each object has keys from the header row and values from that data row.
  function parseCSV(csvText) {
    const rows = [];              // Will hold all parsed rows.
    let row = [], cur = "", inQ = false; // Current row, current cell value, inside-quotes flag.

    // Loop through every character in the CSV text.
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i], nx = csvText[i + 1]; // Current char and next char.

      // Handle quote characters — toggle "inside quotes" mode.
      if (ch === '"') {
        if (inQ && nx === '"') { cur += '"'; i++; } // Two quotes inside quotes = literal quote.
        else inQ = !inQ;                             // Otherwise toggle quote mode.
        continue;
      }

      // A comma outside of quotes = end of current cell value.
      if (ch === ',' && !inQ) { row.push(cur); cur = ""; continue; }

      // A newline outside of quotes = end of current row.
      if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && nx === '\n') i++; // Handle Windows-style \r\n line endings.
        row.push(cur); cur = "";             // Save the last cell of this row.
        if (row.length > 1 || row[0] !== "") rows.push(row); // Skip completely blank rows.
        row = [];                            // Start a fresh row.
        continue;
      }

      cur += ch; // Any other character just gets added to the current cell.
    }

    // Handle the last row if the file doesn't end with a newline.
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);

    // The first row is treated as the header row (column names).
    const headers = (rows.shift() || []).map(h => h.trim());

    // Convert every remaining row into an object using the headers as keys.
    return {
      headers,
      rows: rows
        .map(r => {
          const o = {};
          headers.forEach((h, i) => o[h] = (r[i] ?? "").trim()); // Map each cell to its header.
          return o;
        })
        .filter(o => Object.values(o).some(v => v.trim() !== "")) // Drop fully empty rows.
    };
  }

  // Fetches a CSV file from a URL with a timeout and basic error handling.
  // `label` is just a human-friendly name used in console log messages.
  async function fetchCsv(url, label) {
    const controller = new AbortController();          // Used to cancel the request if it takes too long.
    const timer = setTimeout(() => controller.abort(), 8000); // Cancel after 8 seconds.
    try {
      // Make the network request. cache:"no-store" forces a fresh fetch (not a cached copy).
      const res = await fetch(url, { cache: "no-store", signal: controller.signal, mode: "cors" });
      clearTimeout(timer); // Request completed — cancel the timeout.

      if (!res.ok) throw new Error(`HTTP ${res.status}`); // e.g., 404 or 500 error.

      const text = await res.text(); // Read the response body as plain text.

      if (!text || text.trim().length === 0) throw new Error("Empty response"); // Sheet returned nothing.
      if (looksLikeHtml(text)) throw new Error("Got HTML — sheet may not be published as CSV"); // Wrong format.

      console.log(`[EstheticallyShep] ✓ ${label} loaded (${text.length} bytes)`); // Success!
      return text; // Return the raw CSV text.
    } catch (err) {
      clearTimeout(timer); // Clean up the timeout even on failure.
      console.warn(`[EstheticallyShep] ✗ ${label} failed:`, err.message); // Log what went wrong.
      throw err; // Re-throw so the caller knows it failed.
    }
  }

  // Fetches all three data tabs from Google Sheets in parallel (simultaneously).
  // Returns an object with `price`, `specials`, and `pictures` arrays.
  async function loadSheetsAuto() {
    const [price, specials, pictures] = await Promise.all([
      fetchCsv(PRICE_LIST_CSV_URL, "Price List").then(t => parseCSV(t).rows), // Load price list tab.
      fetchCsv(SPECIALS_CSV_URL,   "Specials").then(t => parseCSV(t).rows),   // Load specials tab.
      fetchCsv(PICTURES_CSV_URL,   "Pictures").then(t => parseCSV(t).rows).catch(() => []), // Load pictures tab; silently return [] if it fails.
    ]);
    console.log(`[EstheticallyShep] ✓ Live data loaded — ${price.length} price rows, ${specials.length} specials, ${pictures.length} pictures`);
    return { price, specials, pictures }; // Return all three datasets.
  }

  // ─── GROUP BY CATEGORY ──────────────────────────────────
  // Takes a flat list of service rows and groups them by their Category column.
  // Returns an ordered array of [categoryName, itemsArray] pairs.
  function groupByCategory(rows) {
    const map = new Map(); // Temporarily stores category → items.

    rows.forEach(r => {
      // Read Category, Service, and Price from each row (checking both capitalized and lowercase column names).
      const cat   = (r.Category || r.category || "Other").trim();
      const svc   = (r.Service  || r.service  || "").trim();
      const price = (r.Price    || r.price    || "").trim();

      if (!svc) return; // Skip rows with no service name.

      if (!map.has(cat)) map.set(cat, []); // Create a new bucket for this category if needed.
      map.get(cat).push({ service: svc, price }); // Add the service to its category bucket.
    });

    // ✏️ MODIFY: Change this list to reorder or rename the categories shown on the page.
    //            Categories in this list appear first and in this order.
    //            Categories NOT in this list appear after, in whatever order they show up.
    const preferred = ["Face", "Body", "Brazilian & Bikini", "Legs", "Add On", "Bundle"];

    const ordered = [];
    preferred.forEach(c => { if (map.has(c)) ordered.push([c, map.get(c)]); }); // Add preferred categories first.
    map.forEach((v, k) => { if (!preferred.includes(k)) ordered.push([k, v]); }); // Then add any remaining categories.
    return ordered;
  }

  // ─── SVG ILLUSTRATIONS per category ────────────────────
  // Returns an inline SVG graphic tailored to each service category.
  // These appear inside the service carousel cards.
  // ✏️ MODIFY: Replace the SVG markup inside each `if` block to change a category's illustration.
  function categoryIllustration(cat) {
    const c = cat.toLowerCase(); // Lowercase for easier matching.

    // Illustration for Face / Brow categories.
    if (c.includes("face") || c.includes("brow")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e7c6af"/>
            <stop offset="1" stop-color="#bb8b4d"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g1)"/>
        <ellipse cx="145" cy="85" rx="54" ry="62" fill="rgba(150,96,68,0.25)"/>
        <!-- Eyes -->
        <ellipse cx="120" cy="78" rx="12" ry="7" fill="rgba(83,106,48,0.6)"/>
        <ellipse cx="170" cy="78" rx="12" ry="7" fill="rgba(83,106,48,0.6)"/>
        <!-- Brows -->
        <path d="M106 66 Q120 60 134 66" fill="none" stroke="rgba(83,106,48,0.85)" stroke-width="4" stroke-linecap="round"/>
        <path d="M156 66 Q170 60 184 66" fill="none" stroke="rgba(83,106,48,0.85)" stroke-width="4" stroke-linecap="round"/>
        <!-- Sparkle emoji -->
        <text x="220" y="40" font-size="22" opacity="0.6">✨</text>
        <text x="40" y="155" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.8)" font-style="italic">Face &amp; Brow Waxing</text>
      </svg>`;

    // Illustration for Body category.
    if (c.includes("body")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#9abe83"/>
            <stop offset="1" stop-color="#536a30"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g2)"/>
        <circle cx="145" cy="60" r="28" fill="rgba(255,255,255,0.2)"/>   <!-- Head shape -->
        <rect x="125" y="88" width="40" height="60" rx="8" fill="rgba(255,255,255,0.18)"/> <!-- Torso -->
        <rect x="100" y="92" width="22" height="50" rx="8" fill="rgba(255,255,255,0.14)"/> <!-- Left arm -->
        <rect x="168" y="92" width="22" height="50" rx="8" fill="rgba(255,255,255,0.14)"/> <!-- Right arm -->
        <text x="40" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.85)" font-style="italic">Body Waxing</text>
      </svg>`;

    // Illustration for Brazilian & Bikini category.
    if (c.includes("brazilian") || c.includes("bikini")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#966044"/>
            <stop offset="1" stop-color="#e7c6af"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g3)"/>
        <circle cx="60"  cy="40"  r="30" fill="rgba(255,255,255,0.08)"/> <!-- Decorative circle -->
        <circle cx="230" cy="140" r="42" fill="rgba(255,255,255,0.08)"/> <!-- Decorative circle -->
        <path d="M60 120 Q100 90 145 100 Q190 110 230 85" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round"/> <!-- Flowing curve -->
        <text x="22" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.9)" font-style="italic">Brazilian &amp; Bikini</text>
        <text x="220" y="35" font-size="20" opacity="0.7">💗</text>
      </svg>`;

    // Illustration for Legs category.
    if (c.includes("leg")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#bb8b4d"/>
            <stop offset="1" stop-color="#9abe83"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g4)"/>
        <rect x="105" y="20" width="28" height="150" rx="14" fill="rgba(255,255,255,0.22)"/> <!-- Left leg -->
        <rect x="157" y="20" width="28" height="150" rx="14" fill="rgba(255,255,255,0.22)"/> <!-- Right leg -->
        <text x="40" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.9)" font-style="italic">Leg Waxing</text>
      </svg>`;

    // Illustration for Add-On category.
    if (c.includes("add")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g5" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#e7c6af"/>
            <stop offset="1" stop-color="#966044"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g5)"/>
        <text x="100" y="100" font-size="56" opacity="0.5">✨</text> <!-- Large sparkle graphic -->
        <text x="28" y="160" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.85)" font-style="italic">Add-On Services</text>
      </svg>`;

    // Default illustration for Bundle or any unrecognized category.
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
        <circle cx="90"  cy="75"  r="34" fill="rgba(255,255,255,0.15)"/> <!-- Decorative circle -->
        <circle cx="200" cy="95"  r="28" fill="rgba(255,255,255,0.15)"/> <!-- Decorative circle -->
        <text x="28" y="162" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.85)" font-style="italic">${escapeHtml(cat)}</text>
        <text x="220" y="35" font-size="20" opacity="0.65">💚</text>
      </svg>`;
  }

  // ─── CART LOGIC ─────────────────────────────────────────

  // Updates the sticky summary bar at the bottom of the page
  // to reflect whatever is currently in the cart.
  function updateCart() {
    const bar = $("#summaryBar"); // Get the summary bar element.
    if (!bar) return;             // If it doesn't exist yet, do nothing.

    // If the cart is empty, hide the bar and stop here.
    if (cart.size === 0) {
      bar.classList.remove("visible");
      return;
    }

    // Add up all service prices and collect service names.
    let total = 0;
    let names = [];
    cart.forEach((price, name) => {
      total += price; // Running total.
      names.push(name); // Collect names for display.
    });

    // Get the DOM elements inside the bar that show the text.
    const svcEl   = bar.querySelector(".summaryServices");   // Shows service names.
    const totalEl = bar.querySelector(".summaryTotalAmt");   // Shows total price.
    const depEl   = bar.querySelector(".summaryDepositAmt"); // Shows deposit amount.

    if (svcEl)   svcEl.textContent  = names.join(", ");         // List selected services.
    if (totalEl) totalEl.textContent = formatMoney(total);       // e.g., "$85"

    // ✏️ MODIFY: This line controls the deposit text in the summary bar.
    //            It uses DEPOSIT_AMOUNT (defined near the top) so you only need to change it once.
    if (depEl) depEl.textContent = formatMoney(DEPOSIT_AMOUNT) + " deposit"; // e.g., "$10 deposit"

    bar.classList.add("visible"); // Make the bar visible if it was hidden.
  }

  // Called when a service checkbox is checked or unchecked.
  function handleCheck(e) {
    const cb    = e.target;                          // The checkbox that changed.
    const name  = cb.dataset.service;               // The service name stored in the checkbox.
    const price = parseFloat(cb.dataset.price);     // The service price stored in the checkbox.

    if (cb.checked) {
      cart.set(name, isNaN(price) ? 0 : price); // Add service to cart (use 0 if no price).
    } else {
      cart.delete(name); // Remove service from cart.
    }

    // If the same service appears multiple times on the page (e.g., in carousel AND pricing),
    // sync all of its checkboxes to match the current state.
    $$(`input.priceCheck[data-service="${CSS.escape(name)}"]`).forEach(el => {
      el.checked = cart.has(name);
    });

    updateCart(); // Refresh the summary bar.
  }

  // Clears all selected services and resets the page to its default state.
  function clearCart() {
    cart.clear();                                           // Empty the cart Map.
    $$("input.priceCheck").forEach(el => { el.checked = false; }); // Uncheck all checkboxes.
    updateCart();                                           // Hide the summary bar.
  }

  // ─── DEPOSIT MODAL ──────────────────────────────────────

  // Opens the deposit/payment modal with the currently selected services.
  function openDepositModal() {
    if (cart.size === 0) return; // Don't open if nothing is selected.

    let total = 0;
    const items = [];

    // Build the list of selected items and calculate the total.
    cart.forEach((price, name) => {
      total += price;
      items.push({ name, price });
    });

    // ✏️ MODIFY: The deposit shown inside the modal is controlled by DEPOSIT_AMOUNT at the top.
    //            No changes needed here — just update DEPOSIT_AMOUNT.
    const deposit = DEPOSIT_AMOUNT; // Flat $10 deposit (not a percentage of total).

    const modal = $("#depositModal"); // Get the modal element.
    if (!modal) return;              // Safety check — shouldn't happen.

    // Build the HTML rows for each selected service.
    const rowsHtml = items.map(({ name, price }) => `
      <div class="modalRow">
        <span class="svc">${escapeHtml(name)}</span>
        <span class="price">${price > 0 ? formatMoney(price) : "—"}</span>
      </div>
    `).join("");

    // Inject service rows and totals into the modal.
    modal.querySelector(".modalServices").innerHTML       = rowsHtml;
    modal.querySelector(".modalFullTotal").textContent    = formatMoney(total);   // Full service total.
    modal.querySelector(".modalDepositTotal").textContent = formatMoney(deposit); // Flat $10 deposit.

    modal.classList.add("open");          // Show the modal.
    document.body.style.overflow = "hidden"; // Prevent background scrolling while modal is open.
  }

  // Closes the deposit/payment modal.
  function closeDepositModal() {
    const modal = $("#depositModal");
    if (modal) modal.classList.remove("open"); // Hide the modal.
    document.body.style.overflow = "";         // Restore background scrolling.
  }

  // ─── GOOGLE DRIVE URL CONVERTER ────────────────────────
  // Google Drive share links can't be used directly as <img src>.
  // This converts any Drive URL format into a direct-embed thumbnail URL.
  //
  // Supported input formats:
  //   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  //   https://drive.google.com/file/d/FILE_ID/view
  //   https://drive.google.com/open?id=FILE_ID
  //   https://drive.google.com/uc?id=FILE_ID
  //   https://drive.google.com/uc?export=view&id=FILE_ID
  //
  // Output: https://lh3.googleusercontent.com/d/FILE_ID  (always works, no auth wall)

  function convertDriveUrl(url) {
    if (!url) return ""; // Nothing to convert.

    // If it's already a direct lh3 URL, return it unchanged.
    if (url.includes("lh3.googleusercontent.com")) return url;

    let fileId = null; // Will hold the extracted Google Drive file ID.

    // Pattern 1: URLs like /file/d/FILE_ID/
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (fileMatch) fileId = fileMatch[1];

    // Pattern 2: URLs like ?id=FILE_ID or &id=FILE_ID
    if (!fileId) {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
      if (idMatch) fileId = idMatch[1];
    }

    // Pattern 3: URLs like open?id=FILE_ID
    if (!fileId) {
      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]{10,})/);
      if (openMatch) fileId = openMatch[1];
    }

    if (fileId) {
      // lh3.googleusercontent.com/d/ID is the most reliable embed URL.
      // =w800 requests an 800px-wide version (fast, CDN-cached by Google).
      return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
    }

    // Not a Drive URL — return unchanged (might already be a direct image URL).
    return url;
  }

  // ─── RENDER PHOTO CAROUSEL ─────────────────────────────
  // Builds the portfolio photo gallery from the Pictures sheet data.
  function renderPhotoCarousel(pictures) {
    const root = $("#photoCarousel"); // Container element for the gallery.
    if (!root) return;                // Stop if the element doesn't exist on this page.

    // If there are no pictures to show, hide the section.
    if (!pictures || pictures.length === 0) {
      root.style.display = "none";
      return;
    }

    // Build a slide for each row in the Pictures sheet.
    const slides = pictures.map((row, i) => {
      // Column names: Image (URL), Heading, Description
      const rawUrl  = (row.Image || row.image || row.URL || row.url || "").trim();
      const imgUrl  = convertDriveUrl(rawUrl); // Convert Drive share links to direct embed URLs.
      const heading = (row.Heading || row.heading || row.Title || row.title || "").trim();
      const desc    = (row.Description || row.description || "").trim();

      if (!imgUrl) return ""; // Skip rows with no image URL.

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
    }).filter(Boolean).join(""); // Remove any empty strings from skipped rows.

    // If no valid slides were generated, hide the section.
    if (!slides) {
      root.style.display = "none";
      return;
    }

    // Inject the carousel HTML structure into the root element.
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

    // Set up dot navigation if there's more than one photo.
    const track  = root.querySelector("#photoTrack");
    const dotsEl = root.querySelector("#photoDots");
    const items  = track.querySelectorAll(".photoSlide"); // All slide elements.
    const total  = items.length;

    if (total > 1 && dotsEl) {
      // Create one dot button per slide.
      dotsEl.innerHTML = Array.from({ length: total }, (_, i) =>
        `<button class="photoDot${i === 0 ? " active" : ""}" data-idx="${i}" aria-label="Go to photo ${i + 1}"></button>`
      ).join("");

      // Clicking a dot scrolls to that slide.
      dotsEl.addEventListener("click", e => {
        const btn = e.target.closest(".photoDot");
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx);
        const w = items[0]?.getBoundingClientRect().width || 320; // Width of one slide.
        track.scrollTo({ left: idx * (w + 16), behavior: "smooth" }); // +16 for gap.
      });
    }

    // When the user scrolls the track, update which dot is marked active.
    let scrollTimer;
    track.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const w = items[0]?.getBoundingClientRect().width || 320;
        const idx = Math.round(track.scrollLeft / (w + 16)); // Figure out which slide is in view.
        dotsEl?.querySelectorAll(".photoDot").forEach((d, i) => {
          d.classList.toggle("active", i === idx); // Highlight the matching dot.
        });
      }, 60); // Slight debounce to avoid flickering during scroll.
    });

    // Previous / next button click handlers.
    root.querySelector("#photoPrev")?.addEventListener("click", () => {
      const w = items[0]?.getBoundingClientRect().width || 320;
      track.scrollBy({ left: -(w + 16), behavior: "smooth" }); // Scroll left one slide.
    });
    root.querySelector("#photoNext")?.addEventListener("click", () => {
      const w = items[0]?.getBoundingClientRect().width || 320;
      track.scrollBy({ left: w + 16, behavior: "smooth" }); // Scroll right one slide.
    });

    // Swipe support for touchscreen devices.
    let touchStartX = 0; // Stores where the finger started.
    track.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].clientX; // How far the finger moved.
      if (Math.abs(diff) > 50) { // Only react if the swipe was at least 50px.
        const w = items[0]?.getBoundingClientRect().width || 320;
        track.scrollBy({ left: diff > 0 ? (w + 16) : -(w + 16), behavior: "smooth" }); // Swipe direction.
      }
    }, { passive: true });
  }

  // ─── RENDER CAROUSEL ────────────────────────────────────
  // Builds the horizontally scrollable service category cards near the top of the page.
  function renderCarousel(groups) {
    const root = $("#servicesCarousel"); // Container element.
    if (!root) return;

    // Build one slide card per service category.
    const slides = groups.map(([cat, items]) => {
      const top3 = items.slice(0, 3).map(x => escapeHtml(x.service)).join(" · "); // Preview of first 3 services.

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

    // Inject the carousel HTML with prev/next controls and all slide cards.
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

    // Wire up the prev/next carousel buttons.
    const track = $("#carouselTrack");
    $("#carPrev")?.addEventListener("click", () => {
      const w = track.querySelector(".slide")?.getBoundingClientRect().width || 300;
      track.scrollBy({ left: -(w + 18), behavior: "smooth" }); // Scroll left one slide.
    });
    $("#carNext")?.addEventListener("click", () => {
      const w = track.querySelector(".slide")?.getBoundingClientRect().width || 300;
      track.scrollBy({ left: w + 18, behavior: "smooth" }); // Scroll right one slide.
    });
  }

  // ─── RENDER PRICING TABLES ──────────────────────────────
  // Builds the collapsible pricing accordion sections under the #pricing anchor.
  function renderPricing(groups) {
    const root = $("#pricingList"); // Container element.
    if (!root) return;

    // ✏️ MODIFY: Update this note text if your deposit policy or instructions change.
    const note = `<p class="pricingNote">
      Select the services you want below, then send your $${DEPOSIT_AMOUNT} deposit using one of the payment options.
    </p>`;

    // Build one collapsible <details> block per service category.
    const tableHtml = groups.map(([cat, items]) => {
      const rows = items.map(({ service, price }) => {
        const num = parsePrice(price);         // Parse "$45" → 45 (or null if no price).
        const hasParsedPrice = num !== null;   // Whether we got a numeric price.

        // Display price as formatted text, or a soft "Ask to inquire" fallback.
        const displayPrice = price
          ? escapeHtml(price)
          : `<span class="rowInquire">Ask to inquire</span>`;

        // Render a checkbox. If the price is known, store it; otherwise store 0.
        const cb = hasParsedPrice
          ? `<input
              type="checkbox"
              class="priceCheck"
              aria-label="Select ${escapeHtml(service)}"
              data-service="${escapeHtml(service)}"
              data-price="${num}"
             />`
          : `<input
              type="checkbox"
              class="priceCheck"
              aria-label="Select ${escapeHtml(service)} (price TBD)"
              data-service="${escapeHtml(service)}"
              data-price="0"
             />`;

        // One table row: checkbox | service name | price.
        return `
          <tr>
            <td class="check">${cb}</td>
            <td>${escapeHtml(service)}</td>
            <td class="right">${displayPrice}</td>
          </tr>
        `;
      }).join("");

      // Wrap the table in a collapsible <details> element.
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

    // Inject the note and all accordion sections into the page.
    root.innerHTML = `
      ${note}
      <div class="pricingWrap">
        <div class="priceDropdowns">${tableHtml}</div>
      </div>
    `;

    // Attach change event listeners to every service checkbox.
    $$("input.priceCheck", root).forEach(cb => {
      cb.addEventListener("change", handleCheck);
    });
  }

  // ─── RENDER SPECIALS ────────────────────────────────────
  // Builds the specials/combo deal cards from the Specials sheet tab.
  function renderSpecials(rows) {
    const root = $("#specialsList"); // Container element.
    if (!root) return;

    // If there are no specials, show a placeholder message.
    if (!rows || rows.length === 0) {
      root.innerHTML = `<p class="muted">Specials coming soon ✨</p>`;
      return;
    }

    // Build one card per special deal.
    const cards = rows.map(r => {
      const emoji = (r.Emoji        || r.emoji        || "✨").trim(); // Optional emoji column.
      const name  = (r["Combo Name"] || r.combo        || "").trim();  // Combo name column.
      const desc  = (r.Description  || r.description  || "").trim();  // Description column.
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

  // ─── RENDER SUMMARY BAR & MODAL ─────────────────────────

  // Creates and appends the sticky summary bar to the bottom of the page.
  // This bar shows selected services, the service total, and the deposit amount.
  function renderSummaryBar() {
    const existing = $("#summaryBar");
    if (existing) return; // Already rendered — don't add a duplicate.

    const wrap = document.createElement("div");
    wrap.className = "summaryStickyWrap";

    // ✏️ MODIFY: The "(due today)" label below can be changed to whatever makes sense.
    //            The deposit amount itself is driven by DEPOSIT_AMOUNT at the top of the file.
    wrap.innerHTML = `
      <div class="summaryBar" id="summaryBar">
        <div class="summaryLeft">
          <span class="summaryLabel">Selected services</span>
          <span class="summaryServices">—</span> <!-- Updated dynamically by updateCart() -->
        </div>
        <div class="summaryRight">
          <div>
            <div class="summaryTotal"><span class="summaryTotalAmt">$0</span></div> <!-- Service total -->
            <div class="summaryDeposit"><span class="summaryDepositAmt">$0 deposit</span> due today</div> <!-- Deposit line -->
          </div>
          <div class="summaryActions">
            <button class="clearBtn" id="clearCartBtn" type="button">Clear</button>
            <button class="proceedBtn" id="openDepositBtn" type="button">
              View payment options
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(wrap); // Add the bar to the bottom of the page.

    // Wire up the Clear and View payment options buttons.
    document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
    document.getElementById("openDepositBtn")?.addEventListener("click", openDepositModal);
  }

  // Creates and appends the payment/deposit modal to the page.
  // This modal is hidden by default and shown when the user clicks "View payment options".
  function renderDepositModal() {
    const existing = $("#depositModal");
    if (existing) return; // Already rendered — don't add a duplicate.

    const modal = document.createElement("div");
    modal.className = "modalOverlay"; // Full-screen dark overlay background.
    modal.id = "depositModal";
    modal.setAttribute("role", "dialog");          // Accessibility: tells screen readers it's a dialog.
    modal.setAttribute("aria-modal", "true");      // Accessibility: traps focus inside the modal.
    modal.setAttribute("aria-labelledby", "modalTitle"); // Accessibility: links modal to its title.

    // ✏️ MODIFY: The payment method labels and handles below are generated from PAYMENT_METHODS.
    //            Change that array near the top of the file to add, remove, or edit methods.
    //            Methods with a `url` property render as clickable links; others render as plain text.
    modal.innerHTML = `
      <div class="modalCard">
        <div class="modalHead">
          <h3 id="modalTitle">Pay Your Deposit</h3>
          <button class="modalClose" id="closeModal" aria-label="Close">✕</button>
        </div>

        <!-- Service rows injected here by openDepositModal() -->
        <div class="modalServices"></div>

        <div class="modalTotals">
          <div class="modalTotalRow">
            <span class="label">Total services</span>
            <span class="val modalFullTotal">$0</span> <!-- Updated by openDepositModal() -->
          </div>
          <div class="modalTotalRow deposit">
            <!-- ✏️ MODIFY: Update the label text here if you rename the deposit policy. -->
            <span class="label">Booking deposit (flat fee)</span>
            <span class="val modalDepositTotal">$0</span> <!-- Updated by openDepositModal() -->
          </div>
        </div>

        <!-- ✏️ MODIFY: Update this explanatory note if your deposit or booking instructions change. -->
        <p class="modalNote">
          Send your $${DEPOSIT_AMOUNT} deposit using one of the payment methods below.
          Include your name and selected services in the payment note.
          After payment, continue to the booking calendar to choose your time slot.
        </p>

        <!-- Payment method rows generated from the PAYMENT_METHODS array -->
        <div class="paymentMethods">
          ${PAYMENT_METHODS.map(({ label, handle, url }) => `
            <div class="paymentRow">
              <span class="paymentPlatform">${escapeHtml(label)}</span>
              ${url
                // If a URL is provided, make the handle a clickable link.
                ? `<a class="paymentHandle paymentLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(handle)}</a>`
                // Otherwise, just show the handle as plain text.
                : `<span class="paymentHandle">${escapeHtml(handle)}</span>`
              }
            </div>
          `).join("")}
        </div>

        <div style="margin-top:16px; text-align:center">
          <p class="muted" style="font-size:0.8rem; margin-bottom:12px;">After sending your deposit:</p>
          <!-- ✏️ MODIFY: Change INTERNAL_BOOKING_URL at the top to update where this button goes. -->
          <a class="btn secondary" href="${escapeHtml(INTERNAL_BOOKING_URL)}">
            Go to booking page
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal); // Add the modal to the DOM.

    // Wire up the close button.
    document.getElementById("closeModal")?.addEventListener("click", closeDepositModal);

    // Clicking anywhere on the dark overlay (outside the modal card) also closes it.
    modal.addEventListener("click", e => { if (e.target === modal) closeDepositModal(); });

    // Pressing Escape also closes the modal.
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeDepositModal(); });
  }

  // ─── ANIMATIONS ─────────────────────────────────────────
  // Sets up scroll-triggered fade-in animations for elements with data-animate attributes.
  function wireAnimations() {
    const els = document.querySelectorAll("[data-animate]"); // Find all animatable elements.

    // If the browser doesn't support IntersectionObserver (very old browsers), reveal everything immediately.
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("inview"));
      return;
    }

    // Create an observer that adds the "inview" class when an element scrolls into view.
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("inview"); // Trigger the CSS animation.
          io.unobserve(e.target);           // Stop watching once it's revealed — no need to repeat.
        }
      });
    }, { threshold: 0.1 }); // Trigger when at least 10% of the element is visible.

    els.forEach(el => io.observe(el)); // Start observing each animatable element.
  }

  // ─── BOOT ───────────────────────────────────────────────
  // Main initialization function — runs once the page HTML is fully loaded.
  async function init() {
    const status = $("#liveStatus"); // Optional status text element on the page.

    // Render the sticky bar and deposit modal shells immediately
    // (they start hidden and only appear when services are selected).
    renderSummaryBar();
    renderDepositModal();

    try {
      // Fetch all live data from Google Sheets.
      const { price, specials, pictures } = await loadSheetsAuto();

      // Group price rows by category for display.
      const groups = groupByCategory(price);

      // Render each section of the page with live data.
      renderPhotoCarousel(pictures); // Portfolio photo gallery.
      renderCarousel(groups);        // Service category cards.
      renderPricing(groups);         // Collapsible pricing tables.
      renderSpecials(specials);      // Combo/special deal cards.

      if (status) status.textContent = "✓ Live menu loaded."; // Success message.
    } catch (err) {
      // If anything fails (network error, bad sheet format, etc.), show a fallback message.
      console.error("[EstheticallyShep] Failed to load menu:", err);
      if (status) status.textContent = "⚠️ Could not load menu — please refresh.";

      // Get references to all the content sections so we can show an error in them.
      const pricingList  = document.getElementById("pricingList");
      const carousel     = document.getElementById("servicesCarousel");
      const specialsList = document.getElementById("specialsList");

      // ✏️ MODIFY: Update the Instagram handle or fallback message below if needed.
      const msg = `<p style="padding:20px; color:#966044; background:rgba(150,96,68,0.08); border-radius:12px; border:1px solid rgba(150,96,68,0.2);">
        Unable to load pricing right now. Please refresh the page or DM
        <a href="https://instagram.com/esthetically.shep" target="_blank" rel="noopener" style="color:#536a30; font-weight:600;">@esthetically.shep</a>
        on Instagram for current pricing.
      </p>`;

      if (pricingList)  pricingList.innerHTML  = msg; // Show error in pricing section.
      if (carousel)     carousel.innerHTML      = "";  // Clear the carousel on error.
      if (specialsList) specialsList.innerHTML  = "";  // Clear the specials on error.
    }

    wireAnimations(); // Set up scroll-triggered reveal animations.
  }

  // Wait for the page HTML to finish loading before running init().
  document.addEventListener("DOMContentLoaded", init);

})(); // End of the immediately-invoked function wrapper.
