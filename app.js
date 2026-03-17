// EstheticallyShep — app.js v2
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

(() => {
  "use strict";

  // ─── CONFIG ────────────────────────────────────────────
  // Direct published CSV URLs from Google Sheets "Publish to web"
  const PRICE_LIST_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=0&single=true&output=csv";

  const SPECIALS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=1455379722&single=true&output=csv";

  const PICTURES_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhRCNZmB9vHs67FAgRoWfNnKzqPbY_o_pEZmCSbCSv7y834V5cKlEdFOYYROH2odsMxvDUAfHFTQGl/pub?gid=57851392&single=true&output=csv";

  const INTERNAL_BOOKING_URL = "booking.html";

  const PAYMENT_METHODS = [
    { label: "Cash App", handle: "$estheticallyshep" },
    { label: "Venmo", handle: "@estheticallyshep" },
    { label: "Zelle", handle: "estheticallyshep@gmail.com" },
  ];

  // ─── CART STATE ────────────────────────────────────────
  const cart = new Map(); // service name → price (number)

  // ─── UTILS ─────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = String(text ?? "");
    return d.innerHTML;
  }

  function parsePrice(str) {
    if (!str) return null;
    const m = String(str).match(/\$(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }

  function formatMoney(num) {
    return "$" + num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function looksLikeHtml(text) {
    const t = String(text || "").trim().slice(0, 200).toLowerCase();
    return t.includes("<!doctype") || t.includes("<html") || t.includes("<body");
  }

  function parseCSV(csvText) {
    const rows = [];
    let row = [], cur = "", inQ = false;
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i], nx = csvText[i + 1];
      if (ch === '"') { if (inQ && nx === '"') { cur += '"'; i++; } else inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { row.push(cur); cur = ""; continue; }
      if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && nx === '\n') i++;
        row.push(cur); cur = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = []; continue;
      }
      cur += ch;
    }
    row.push(cur);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    const headers = (rows.shift() || []).map(h => h.trim());
    return {
      headers,
      rows: rows
        .map(r => { const o = {}; headers.forEach((h, i) => o[h] = (r[i] ?? "").trim()); return o; })
        .filter(o => Object.values(o).some(v => v.trim() !== ""))
    };
  }


  async function fetchCsv(url, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal, mode: "cors" });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.trim().length === 0) throw new Error("Empty response");
      if (looksLikeHtml(text)) throw new Error("Got HTML — sheet may not be published as CSV");
      console.log(`[EstheticallyShep] ✓ ${label} loaded (${text.length} bytes)`);
      return text;
    } catch (err) {
      clearTimeout(timer);
      console.warn(`[EstheticallyShep] ✗ ${label} failed:`, err.message);
      throw err;
    }
  }

  async function loadSheetsAuto() {
    const [price, specials, pictures] = await Promise.all([
      fetchCsv(PRICE_LIST_CSV_URL, "Price List").then(t => parseCSV(t).rows),
      fetchCsv(SPECIALS_CSV_URL,   "Specials").then(t => parseCSV(t).rows),
      fetchCsv(PICTURES_CSV_URL,   "Pictures").then(t => parseCSV(t).rows).catch(() => []),
    ]);
    console.log(`[EstheticallyShep] ✓ Live data loaded — ${price.length} price rows, ${specials.length} specials, ${pictures.length} pictures`);
    return { price, specials, pictures };
  }

  // ─── GROUP BY CATEGORY ──────────────────────────────────
  function groupByCategory(rows) {
    const map = new Map();
    rows.forEach(r => {
      const cat = (r.Category || r.category || "Other").trim();
      const svc = (r.Service || r.service || "").trim();
      const price = (r.Price || r.price || "").trim();
      if (!svc) return;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ service: svc, price });
    });
    const preferred = ["Face", "Body", "Brazilian & Bikini", "Legs", "Add On", "Bundle"];
    const ordered = [];
    preferred.forEach(c => { if (map.has(c)) ordered.push([c, map.get(c)]); });
    map.forEach((v, k) => { if (!preferred.includes(k)) ordered.push([k, v]); });
    return ordered;
  }

  // ─── SVG ILLUSTRATIONS per category ────────────────────
  function categoryIllustration(cat) {
    const c = cat.toLowerCase();

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
        <!-- Sparkle -->
        <text x="220" y="40" font-size="22" opacity="0.6">✨</text>
        <text x="40" y="155" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.8)" font-style="italic">Face &amp; Brow Waxing</text>
      </svg>`;

    if (c.includes("body")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#9abe83"/>
            <stop offset="1" stop-color="#536a30"/>
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
            <stop offset="0" stop-color="#966044"/>
            <stop offset="1" stop-color="#e7c6af"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g3)"/>
        <circle cx="60"  cy="40"  r="30" fill="rgba(255,255,255,0.08)"/>
        <circle cx="230" cy="140" r="42" fill="rgba(255,255,255,0.08)"/>
        <path d="M60 120 Q100 90 145 100 Q190 110 230 85" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round"/>
        <text x="22" y="165" font-size="12" font-family="Georgia,serif" fill="rgba(255,255,255,0.9)" font-style="italic">Brazilian &amp; Bikini</text>
        <text x="220" y="35" font-size="20" opacity="0.7">💗</text>
      </svg>`;

    if (c.includes("leg")) return `
      <svg viewBox="0 0 290 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#bb8b4d"/>
            <stop offset="1" stop-color="#9abe83"/>
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
            <stop offset="0" stop-color="#e7c6af"/>
            <stop offset="1" stop-color="#966044"/>
          </linearGradient>
        </defs>
        <rect width="290" height="180" fill="url(#g5)"/>
        <text x="100" y="100" font-size="56" opacity="0.5">✨</text>
        <text x="28" y="160" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.85)" font-style="italic">Add-On Services</text>
      </svg>`;

    // Bundle / default
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
        <circle cx="90"  cy="75"  r="34" fill="rgba(255,255,255,0.15)"/>
        <circle cx="200" cy="95"  r="28" fill="rgba(255,255,255,0.15)"/>
        <text x="28" y="162" font-size="12" font-family="Georgia,serif" fill="rgba(83,106,48,0.85)" font-style="italic">${escapeHtml(cat)}</text>
        <text x="220" y="35" font-size="20" opacity="0.65">💚</text>
      </svg>`;
  }

  // ─── CART LOGIC ─────────────────────────────────────────
  function updateCart() {
    const bar = $("#summaryBar");
    if (!bar) return;

    if (cart.size === 0) {
      bar.classList.remove("visible");
      return;
    }

    let total = 0;
    let names = [];
    cart.forEach((price, name) => {
      total += price;
      names.push(name);
    });

    const deposit = total / 2;

    const svcEl = bar.querySelector(".summaryServices");
    const totalEl = bar.querySelector(".summaryTotalAmt");
    const depEl = bar.querySelector(".summaryDepositAmt");

    if (svcEl) svcEl.textContent = names.join(", ");
    if (totalEl) totalEl.textContent = formatMoney(total);
    if (depEl) depEl.textContent = formatMoney(deposit) + " deposit";

    bar.classList.add("visible");
  }

  function handleCheck(e) {
    const cb = e.target;
    const name = cb.dataset.service;
    const price = parseFloat(cb.dataset.price);

    if (cb.checked) {
      cart.set(name, isNaN(price) ? 0 : price);
    } else {
      cart.delete(name);
    }

    // Sync any other checkboxes for same service
    $$(`input.priceCheck[data-service="${CSS.escape(name)}"]`).forEach(el => {
      el.checked = cart.has(name);
    });

    updateCart();
  }

  function clearCart() {
    cart.clear();
    $$("input.priceCheck").forEach(el => { el.checked = false; });
    updateCart();
  }

  // ─── DEPOSIT MODAL ──────────────────────────────────────
  function openDepositModal() {
    if (cart.size === 0) return;

    let total = 0;
    const items = [];
    cart.forEach((price, name) => {
      total += price;
      items.push({ name, price });
    });
    const deposit = 10;

    const modal = $("#depositModal");
    if (!modal) return;

    // Build service rows
    const rowsHtml = items.map(({ name, price }) => `
      <div class="modalRow">
        <span class="svc">${escapeHtml(name)}</span>
        <span class="price">${price > 0 ? formatMoney(price) : "—"}</span>
      </div>
    `).join("");

    modal.querySelector(".modalServices").innerHTML = rowsHtml;
    modal.querySelector(".modalFullTotal").textContent = formatMoney(total);
    modal.querySelector(".modalDepositTotal").textContent = formatMoney(deposit);

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeDepositModal() {
    const modal = $("#depositModal");
    if (modal) modal.classList.remove("open");
    document.body.style.overflow = "";
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
    if (!url) return "";

    // Already a direct lh3 or uc export — return as-is
    if (url.includes("lh3.googleusercontent.com")) return url;

    // Extract file ID from any known Drive URL pattern
    let fileId = null;

    // Pattern 1: /file/d/FILE_ID/
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (fileMatch) fileId = fileMatch[1];

    // Pattern 2: ?id=FILE_ID or &id=FILE_ID
    if (!fileId) {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
      if (idMatch) fileId = idMatch[1];
    }

    // Pattern 3: open?id=FILE_ID
    if (!fileId) {
      const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]{10,})/);
      if (openMatch) fileId = openMatch[1];
    }

    if (fileId) {
      // lh3.googleusercontent.com/d/ID is the most reliable embed URL
      // sz=w800 requests an 800px-wide version (fast, cached by Google CDN)
      return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
    }

    // Not a Drive URL — return unchanged (might be a direct image URL)
    return url;
  }

  // ─── RENDER PHOTO CAROUSEL ─────────────────────────────
  function renderPhotoCarousel(pictures) {
    const root = $("#photoCarousel");
    if (!root) return;

    if (!pictures || pictures.length === 0) {
      root.style.display = "none";
      return;
    }

    const slides = pictures.map((row, i) => {
      // Column names: Image (URL), Heading, Description
      const rawUrl  = (row.Image || row.image || row.URL || row.url || "").trim();
      const imgUrl  = convertDriveUrl(rawUrl);
      const heading = (row.Heading || row.heading || row.Title || row.title || "").trim();
      const desc    = (row.Description || row.description || "").trim();

      if (!imgUrl) return "";

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
    }).filter(Boolean).join("");

    if (!slides) {
      root.style.display = "none";
      return;
    }

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

    // Dots
    const track  = root.querySelector("#photoTrack");
    const dotsEl = root.querySelector("#photoDots");
    const items  = track.querySelectorAll(".photoSlide");
    const total  = items.length;

    if (total > 1 && dotsEl) {
      dotsEl.innerHTML = Array.from({ length: total }, (_, i) =>
        `<button class="photoDot${i === 0 ? " active" : ""}" data-idx="${i}" aria-label="Go to photo ${i + 1}"></button>`
      ).join("");

      dotsEl.addEventListener("click", e => {
        const btn = e.target.closest(".photoDot");
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx);
        const w = items[0]?.getBoundingClientRect().width || 320;
        track.scrollTo({ left: idx * (w + 16), behavior: "smooth" });
      });
    }

    // Update active dot on scroll
    let scrollTimer;
    track.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const w = items[0]?.getBoundingClientRect().width || 320;
        const idx = Math.round(track.scrollLeft / (w + 16));
        dotsEl?.querySelectorAll(".photoDot").forEach((d, i) => {
          d.classList.toggle("active", i === idx);
        });
      }, 60);
    });

    // Prev / next buttons
    root.querySelector("#photoPrev")?.addEventListener("click", () => {
      const w = items[0]?.getBoundingClientRect().width || 320;
      track.scrollBy({ left: -(w + 16), behavior: "smooth" });
    });
    root.querySelector("#photoNext")?.addEventListener("click", () => {
      const w = items[0]?.getBoundingClientRect().width || 320;
      track.scrollBy({ left: w + 16, behavior: "smooth" });
    });

    // Touch/swipe support
    let touchStartX = 0;
    track.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        const w = items[0]?.getBoundingClientRect().width || 320;
        track.scrollBy({ left: diff > 0 ? (w + 16) : -(w + 16), behavior: "smooth" });
      }
    }, { passive: true });
  }

  // ─── RENDER CAROUSEL ────────────────────────────────────
  function renderCarousel(groups) {
    const root = $("#servicesCarousel");
    if (!root) return;

    const slides = groups.map(([cat, items]) => {
      const top3 = items.slice(0,3).map(x => escapeHtml(x.service)).join(" · ");
      const catSlug = cat.toLowerCase().replace(/[^a-z]/g, "");

      return `
        <article class="slide glass" data-animate="fade-up">
          <div class="slideMedia">
            ${categoryIllustration(cat)}
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
      track.scrollBy({ left: -(w + 18), behavior: "smooth" });
    });
    $("#carNext")?.addEventListener("click", () => {
      const w = track.querySelector(".slide")?.getBoundingClientRect().width || 300;
      track.scrollBy({ left: w + 18, behavior: "smooth" });
    });
  }

  // ─── RENDER PRICING TABLES ──────────────────────────────
  function renderPricing(groups) {
    const root = $("#pricingList");
    if (!root) return;

    const note = `<p class="pricingNote">
      Select the services you want below, then send your $10 deposit using one of the payment options.
    </p>`;

    // Build tables
    const tableHtml = groups.map(([cat, items]) => {
      const rows = items.map(({ service, price }) => {
        const num = parsePrice(price);
        const hasParsedPrice = num !== null;
        const displayPrice = price
          ? escapeHtml(price)
          : `<span class="rowInquire">Ask to inquire</span>`;

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

        return `
          <tr>
            <td class="check">${cb}</td>
            <td>${escapeHtml(service)}</td>
            <td class="right">${displayPrice}</td>
          </tr>
        `;
      }).join("");

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

    // Wire checkboxes
    $$("input.priceCheck", root).forEach(cb => {
      cb.addEventListener("change", handleCheck);
    });
  }

  // ─── RENDER SPECIALS ────────────────────────────────────
  function renderSpecials(rows) {
    const root = $("#specialsList");
    if (!root) return;

    if (!rows || rows.length === 0) {
      root.innerHTML = `<p class="muted">Specials coming soon ✨</p>`;
      return;
    }

    const cards = rows.map(r => {
      const emoji = (r.Emoji || r.emoji || "✨").trim();
      const name  = (r["Combo Name"] || r.combo || "").trim();
      const desc  = (r.Description || r.description || "").trim();
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
  function renderSummaryBar() {
    const existing = $("#summaryBar");
    if (existing) return; // already rendered

    const wrap = document.createElement("div");
    wrap.className = "summaryStickyWrap";
    wrap.innerHTML = `
      <div class="summaryBar" id="summaryBar">
        <div class="summaryLeft">
          <span class="summaryLabel">Selected services</span>
          <span class="summaryServices">—</span>
        </div>
        <div class="summaryRight">
          <div>
            <div class="summaryTotal"><span class="summaryTotalAmt">$0</span></div>
            <div class="summaryDeposit"><span class="summaryDepositAmt">$0 deposit</span> due today (50%)</div>
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
    document.body.appendChild(wrap);

    document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
    document.getElementById("openDepositBtn")?.addEventListener("click", openDepositModal);
  }

  function renderDepositModal() {
    const existing = $("#depositModal");
    if (existing) return;

    const modal = document.createElement("div");
    modal.className = "modalOverlay";
    modal.id = "depositModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modalTitle");

    modal.innerHTML = `
      <div class="modalCard">
        <div class="modalHead">
          <h3 id="modalTitle">Pay Your Deposit</h3>
          <button class="modalClose" id="closeModal" aria-label="Close">✕</button>
        </div>

        <div class="modalServices"></div>

        <div class="modalTotals">
          <div class="modalTotalRow">
            <span class="label">Total services</span>
            <span class="val modalFullTotal">$0</span>
          </div>
          <div class="modalTotalRow deposit">
            <span class="label">50% deposit due today</span>
            <span class="val modalDepositTotal">$0</span>
          </div>
        </div>

        <p class="modalNote">
          Send your 50% deposit using one of the payment methods below. Include your name and selected services in the payment note.
          After payment, continue to the booking calendar to choose your time slot.
        </p>

        <div class="paymentMethods">
          ${PAYMENT_METHODS.map(({ label, handle }) => `
            <div class="paymentRow">
              <span class="paymentPlatform">${escapeHtml(label)}</span>
              <span class="paymentHandle">${escapeHtml(handle)}</span>
            </div>
          `).join("")}
        </div>

        <div style="margin-top:16px; text-align:center">
          <p class="muted" style="font-size:0.8rem; margin-bottom:12px;">After sending your deposit:</p>
          <a class="btn secondary" href="${escapeHtml(INTERNAL_BOOKING_URL)}">
            Go to booking page
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    document.getElementById("closeModal")?.addEventListener("click", closeDepositModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeDepositModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeDepositModal(); });
  }

  // ─── ANIMATIONS ─────────────────────────────────────────
  function wireAnimations() {
    const els = document.querySelectorAll("[data-animate]");
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("inview"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("inview"); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    els.forEach(el => io.observe(el));
  }

  // ─── BOOT ───────────────────────────────────────────────
  async function init() {
    const status = $("#liveStatus");

    // Render chrome immediately
    renderSummaryBar();
    renderDepositModal();

    try {
      const { price, specials, pictures } = await loadSheetsAuto();
      const groups = groupByCategory(price);
      renderPhotoCarousel(pictures);
      renderCarousel(groups);
      renderPricing(groups);
      renderSpecials(specials);
      if (status) status.textContent = "✓ Live menu loaded.";
    } catch (err) {
      console.error("[EstheticallyShep] Failed to load menu:", err);
      if (status) status.textContent = "⚠️ Could not load menu — please refresh.";
      const pricingList = document.getElementById("pricingList");
      const carousel = document.getElementById("servicesCarousel");
      const specialsList = document.getElementById("specialsList");
      const msg = `<p style="padding:20px; color:#966044; background:rgba(150,96,68,0.08); border-radius:12px; border:1px solid rgba(150,96,68,0.2);">
        Unable to load pricing right now. Please refresh the page or DM
        <a href="https://instagram.com/esthetically.shep" target="_blank" rel="noopener" style="color:#536a30; font-weight:600;">@esthetically.shep</a>
        on Instagram for current pricing.
      </p>`;
      if (pricingList) pricingList.innerHTML = msg;
      if (carousel) carousel.innerHTML = "";
      if (specialsList) specialsList.innerHTML = "";
    }

    wireAnimations();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
