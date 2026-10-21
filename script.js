// Normal Shoes v4 — shared site behaviour (no external scripts).
"use strict";

const THEME_KEY = "normal-shoes-theme";
const CONTACT_EMAIL = "normalshoeseditions@gmail.com";

/* ---------- Helpers ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Wrap placeholder values (anything containing "XX" or "TBC") in <span data-placeholder>.
const ph = (s) => (/XX|TBC/.test(String(s)) ? `<span data-placeholder>${esc(s)}</span>` : esc(s));
const isRealUrl = (u) => typeof u === "string" && u.trim() !== "" && u.trim() !== "#";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function parseDate(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
// Unambiguous UK dates, e.g. "Saturday 14 March 2027"
function fmtDate(iso, withDay) { const d = parseDate(iso); if (!d) return "Date TBC"; return `${withDay ? DAYS[d.getDay()] + " " : ""}${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
async function loadJSON(path) { const r = await fetch(path, { cache: "no-store" }); if (!r.ok) throw new Error(path + " " + r.status); return r.json(); }

/* ---------- Theme ---------- */
function initTheme() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const apply = (t) => { btn.setAttribute("aria-label", `Switch to ${t === "dark" ? "light" : "dark"} theme`); btn.setAttribute("aria-pressed", String(t === "dark")); };
  apply(document.documentElement.getAttribute("data-theme") || "light");
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    apply(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
  });
  window.addEventListener("storage", (e) => { if (e.key === THEME_KEY && /^(dark|light)$/.test(e.newValue || "")) { document.documentElement.setAttribute("data-theme", e.newValue); apply(e.newValue); } });
}

/* ---------- Mobile nav ---------- */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("main-nav");
  if (!toggle || !nav) return;
  const set = (open) => { nav.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", String(open)); document.body.classList.toggle("nav-open", open); };
  toggle.addEventListener("click", () => { const open = !nav.classList.contains("is-open"); set(open); if (open) { const a = nav.querySelector("a"); if (a) a.focus(); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) { set(false); toggle.focus(); } });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => set(false)));
  window.matchMedia("(min-width: 721px)").addEventListener("change", (m) => { if (m.matches) set(false); });
}

/* ---------- Partners (confirmed only) ---------- */
async function initPartners() {
  const targets = document.querySelectorAll("[data-partners]");
  if (!targets.length) return;
  let partners = [];
  try { partners = (await loadJSON("/data/partners.json")).partners || []; } catch (e) { return; }
  const confirmed = partners.filter((p) => p && p.confirmed === true);
  targets.forEach((el) => {
    const section = el.closest("[data-partners-section]");
    if (!confirmed.length) { el.innerHTML = ""; if (section) section.hidden = true; return; }
    const style = el.getAttribute("data-partners");
    el.innerHTML = confirmed.map((p) => {
      const inner = p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" width="56" height="56" loading="lazy">` : `<span class="partner-text">${esc(p.name)}</span>`;
      const linkOpen = isRealUrl(p.url) ? `<a href="${esc(p.url)}" rel="noopener" target="_blank" aria-label="${esc(p.name)} (opens in a new tab)">` : "";
      const linkClose = isRealUrl(p.url) ? "</a>" : "";
      if (style === "cards") return `<article class="card card-accent">${p.logo ? `<img src="${esc(p.logo)}" alt="" width="72" height="72" loading="lazy" style="width:72px;height:72px;object-fit:contain">` : ""}<h3>${esc(p.name)}</h3><p>${esc(p.description || "")}</p>${isRealUrl(p.url) ? `<a class="card-link" href="${esc(p.url)}" rel="noopener" target="_blank">Visit website</a>` : ""}</article>`;
      return `<span class="partner-badge">${linkOpen}${inner}${linkClose}</span>`;
    }).join("");
    if (section) section.hidden = false;
  });
}

/* ---------- Events ---------- */
function ratingText(ev) {
  if (!ev.ageRating || !ev.ratingSource || ev.ratingSource === "TBC") return "Age rating to be confirmed";
  const by = ev.ratingSource === "BBFC" ? "the BBFC" : ev.ratingSource;
  return `Age ${ev.ageRating} · rated by ${by}`;
}
function eventCard(ev) {
  const acc = ev.accessibility || {};
  const accList = [acc.stepFree && "Step-free access", acc.captioned && "Captioned", acc.relaxed && "Relaxed screening"].filter(Boolean);
  const venue = ev.venueName || "Venue to be announced";
  const time = [ev.start, ev.end].filter(Boolean).join("–");
  let ticket;
  if (ev.soldOut) ticket = `<span class="badge">Sold out</span>`;
  else if (isRealUrl(ev.ticketUrl)) ticket = `<a class="btn btn-primary btn-small" href="${esc(ev.ticketUrl)}">${ev.strand === "Disc Lab" ? "Book this session" : "Tickets"}${ev.ticketPrice ? " · " + esc(ev.ticketPrice) : ""}</a>`;
  else ticket = `<span class="event-meta">${ev.strand === "Disc Lab" ? "Booking" : "Tickets"}: ${ev.ticketPrice ? ph(ev.ticketPrice) + " · " : ""}link to follow</span>`;
  const station = ev.discLabStation ? `<div class="station" role="note"><strong>Disc Lab Station: for selected filmmakers (booking required)</strong>Not open to audiences. Selected filmmakers make discs of their own film here. ${isRealUrl(ev.stationBookingUrl) ? `<a href="${esc(ev.stationBookingUrl)}">Filmmaker station booking</a>` : "Filmmaker booking link to follow."}</div>` : "";
  return `<li class="event" data-id="${esc(ev.id)}">
    <h3>${esc(ev.title)}</h3>
    <p class="event-meta">${esc(fmtDate(ev.date, true))}${time ? " · " + esc(time) : ""} · ${esc(venue)}${ev.venueAddress ? ", " + esc(ev.venueAddress) : ""}</p>
    <ul class="badges">
      ${ev.edition ? `<li class="badge">${esc(ev.edition)}</li>` : ""}
      ${ev.strand ? `<li class="badge badge-strand">${esc(ev.strand)}</li>` : ""}
      ${ev.strand !== "Disc Lab" && ev.strand !== "Social" ? `<li class="badge badge-rating">${esc(ratingText(ev))}</li>` : ""}
      ${ev.country ? `<li class="badge">Country: ${esc(ev.country)}</li>` : ""}
      ${accList.map((a) => `<li class="badge">${a}</li>`).join("")}
    </ul>
    ${ev.description ? `<p>${esc(ev.description)}</p>` : ""}
    <div class="event-actions">${ticket}</div>
    ${station}
  </li>`;
}
function fetchFail(el) {
  el.innerHTML = `<p class="notice" role="status">We couldn't load the programme just now. If you're viewing this file directly from your computer, it needs to be served from a web server. Otherwise please try again later, or email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`;
}

async function initComingUp() {
  const el = document.getElementById("coming-up");
  if (!el) return;
  try {
    const events = (await loadJSON("/data/events.json")).events || [];
    const t = todayISO();
    const next = events.filter((e) => (e.date || "") >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 3);
    el.innerHTML = next.length ? `<ul class="event-list">${next.map(eventCard).join("")}</ul>` : `<p class="notice">New dates will be announced soon.</p>`;
  } catch (e) { fetchFail(el); }
}

async function initProgramme() {
  const el = document.getElementById("programme");
  if (!el) return;
  let events;
  try { events = (await loadJSON("/data/events.json")).events || []; } catch (e) { fetchFail(el); return; }
  events.sort((a, b) => ((a.date || "") + (a.start || "")).localeCompare((b.date || "") + (b.start || "")));
  const form = document.getElementById("filters");
  const fill = (id, values, label) => { const s = document.getElementById(id); s.innerHTML = `<option value="">All ${label}</option>` + values.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(""); };
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  fill("f-edition", uniq(events.map((e) => e.edition)).map((v) => [v, v]), "editions");
  fill("f-strand", uniq(events.map((e) => e.strand)).map((v) => [v, v]), "strands");
  fill("f-month", uniq(events.map((e) => (e.date || "").slice(0, 7))).map((v) => { const d = parseDate(v + "-01"); return [v, d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : v]; }), "months");
  form.hidden = false;
  const status = document.getElementById("programme-status");
  const render = () => {
    const ed = form.elements.edition.value, st = form.elements.strand.value, mo = form.elements.month.value;
    const list = events.filter((e) => (!ed || e.edition === ed) && (!st || e.strand === st) && (!mo || (e.date || "").startsWith(mo)));
    const t = todayISO();
    const group = (arr) => { const by = {}; arr.forEach((e) => { (by[e.date] = by[e.date] || []).push(e); }); return Object.keys(by).sort().map((d) => `<div class="day-group"><h2 class="day-head">${esc(fmtDate(d, true))}</h2><ul class="event-list">${by[d].map(eventCard).join("")}</ul></div>`).join(""); };
    const up = list.filter((e) => (e.date || "") >= t), past = list.filter((e) => (e.date || "") < t);
    el.innerHTML = (up.length ? group(up) : `<p class="notice">No upcoming sessions match these filters.</p>`) + (past.length ? `<details class="past-sessions"><summary>Past sessions (${past.length})</summary>${group(past.reverse())}</details>` : "");
    status.textContent = `Showing ${up.length} upcoming session${up.length === 1 ? "" : "s"}.`;
  };
  form.addEventListener("change", render);
  form.addEventListener("reset", () => setTimeout(render, 0));
  render();
  // schema.org Event JSON-LD
  const ld = events.map((e) => ({
    "@context": "https://schema.org", "@type": "Event", name: e.title, startDate: e.date + (e.start ? "T" + e.start : ""), endDate: e.date + (e.end ? "T" + e.end : ""),
    eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", description: e.description || "",
    location: { "@type": "Place", name: e.venueName || "Venue to be announced", address: e.venueAddress || "Worthing, West Sussex, UK" },
    organizer: { "@type": "Organization", name: "Normal Shoes", url: location.origin + "/" },
    ...(isRealUrl(e.ticketUrl) ? { offers: { "@type": "Offer", url: e.ticketUrl, priceCurrency: "GBP", availability: e.soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock" } } : {}),
  }));
  const s = document.createElement("script"); s.type = "application/ld+json"; s.id = "events-jsonld"; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
}

/* ---------- Compilation (Route B) ---------- */
async function initCompilation() {
  const el = document.getElementById("compilation");
  if (!el) return;
  let c;
  try { c = await loadJSON("/data/compilation.json"); } catch (e) { el.innerHTML = `<p class="notice">Compilation details couldn't be loaded. Please try again later.</p>`; return; }
  let status;
  if (c.status === "on sale") status = `<p><strong>On sale.</strong> ${c.ratingText ? "Classification: " + esc(c.ratingText) + "." : ""}</p>${c.price ? `<p class="price">${esc(c.price)}</p>` : ""}${isRealUrl(c.buyUrl) ? `<p><a class="btn btn-sea" id="compilation-buy" href="${esc(c.buyUrl)}">Buy the compilation</a></p>` : ""}`;
  else if (c.status === "rating pending") status = `<p><strong>Awaiting BBFC classification. On sale once rated.</strong></p>`;
  else status = `<p><strong>Coming soon.</strong></p>`;
  const films = (c.films || []).map((f) => `<li>${esc(f.title)}${f.director ? " — " + esc(f.director) : ""}${f.country ? " (" + esc(f.country) + ")" : ""}</li>`).join("");
  el.innerHTML = `<article class="card card-accent" data-status="${esc(c.status)}"><h3>${esc(c.title)}${c.year ? " (" + esc(c.year) + ")" : ""}</h3>${status}${films ? `<h4>Films</h4><ul>${films}</ul>` : ""}</article>`;
}

/* ---------- Forms (Netlify Forms with honest success / error) ---------- */
function fieldError(field, msg) {
  const id = (field.id || field.name) + "-error";
  let err = document.getElementById(id);
  if (!err) { err = document.createElement("p"); err.id = id; err.className = "field-error"; err.hidden = true; (field.closest(".field") || field.closest("fieldset") || field.parentNode).appendChild(err); }
  if (msg) { err.textContent = msg; err.hidden = false; field.setAttribute("aria-invalid", "true"); field.setAttribute("aria-describedby", [field.getAttribute("data-desc"), id].filter(Boolean).join(" ")); }
  else { err.hidden = true; field.removeAttribute("aria-invalid"); if (field.getAttribute("data-desc")) field.setAttribute("aria-describedby", field.getAttribute("data-desc")); else field.removeAttribute("aria-describedby"); }
}
function validateField(f) {
  if (f.type === "checkbox" || f.type === "hidden" || f.name === "bot-field") return true;
  const v = (f.value || "").trim();
  let msg = "";
  if (f.required && !v) msg = (f.dataset.label || "This field") + " is required.";
  else if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Please enter a valid email address, like name@example.com.";
  else if (v && f.type === "number" && f.min && +v < +f.min) msg = `Please enter ${f.min} or more.`;
  fieldError(f, msg);
  return !msg;
}
function validateGroups(form) {
  let ok = true;
  form.querySelectorAll("fieldset[data-required-group]").forEach((fs) => {
    const boxes = fs.querySelectorAll('input[type="checkbox"]');
    const any = [...boxes].some((b) => b.checked);
    const first = boxes[0];
    if (!first) return;
    fieldError(first, any ? "" : fs.dataset.requiredGroup);
    if (!any) ok = false;
  });
  return ok;
}
function buildMailto(form, subject) {
  const lines = [];
  form.querySelectorAll("[name]").forEach((f) => {
    if (["form-name", "bot-field"].includes(f.name)) return;
    if ((f.type === "checkbox" || f.type === "radio") && !f.checked) return;
    const v = (f.value || "").trim(); if (!v) return;
    const label = f.id ? form.querySelector(`label[for="${f.id}"]`) : null;
    lines.push(`${label ? label.textContent.trim() : f.name}: ${v}`);
  });
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
function initForms() {
  document.querySelectorAll("form[data-netlify-form]").forEach((form) => {
    form.noValidate = true;
    form.querySelectorAll("input, select, textarea").forEach((f) => f.addEventListener("blur", () => { if (f.getAttribute("aria-invalid") === "true" || f.value) validateField(f); }));
    form.querySelectorAll("fieldset[data-required-group] input[type=checkbox]").forEach((b) => b.addEventListener("change", () => { if (b.closest("fieldset").querySelector('[aria-invalid="true"]')) validateGroups(form); }));
    form.querySelectorAll("input, textarea").forEach((f) => f.addEventListener("input", () => { if (f.getAttribute("aria-invalid") === "true") validateField(f); }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fields = [...form.querySelectorAll("input, select, textarea")];
      const okFields = fields.map(validateField).every(Boolean);
      const okGroups = validateGroups(form);
      if (!okFields || !okGroups) { const bad = form.querySelector('[aria-invalid="true"]'); if (bad) bad.focus(); return; }
      const success = document.getElementById(form.id + "-success");
      const error = document.getElementById(form.id + "-error");
      success.classList.remove("is-visible"); error.classList.remove("is-visible");
      const btn = form.querySelector('[type="submit"]'); const label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending…";
      const subject = form.dataset.subject || "Website message";
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(form)).toString() })
        .then((r) => { if (!r.ok) throw new Error("Form failed " + r.status); success.classList.add("is-visible"); success.focus(); form.reset(); })
        .catch(() => {
          // TODO: confirm form backend (Netlify Forms on the normalshoes3 site; enable notifications to normalshoeseditions@gmail.com).
          error.innerHTML = `Sorry, that didn't send. Please email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>, or <a class="js-mailto" href="#">open a pre-filled email</a> with the details you entered.`;
          error.querySelector(".js-mailto").href = buildMailto(form, subject);
          error.classList.add("is-visible"); error.focus();
        })
        .finally(() => { btn.disabled = false; btn.textContent = label; });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme(); initNav(); initForms();
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  initPartners(); initComingUp(); initProgramme(); initCompilation();
});
