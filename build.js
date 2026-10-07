#!/usr/bin/env node
/* ============================================================
   Milena D'Argenzio - build.js
   Στατική προ-απόδοση του καταλόγου από το data.json.
   Καθαρό Node, καμία εξάρτηση. Τρέχει με το χέρι πριν από κάθε commit
   που αλλάζει το data.json ή τις φωτογραφίες. Το Netlify συνεχίζει να
   δημοσιεύει τον φάκελο όπως είναι (publish = ".").

     node build.js          γράφει τα αρχεία
     node build.js --check  ελέγχει μόνο. Κωδικός εξόδου 1 όταν κάτι διαφέρει.

   Τι παράγει:
     1. nyfiko/<κωδικός>/index.html   μία σελίδα ανά νυφικό
     2. index.html                    στατικές κάρτες + JSON-LD (ανάμεσα στα σχόλια BUILD:...)
     3. sitemap.xml                   αρχική + μία διεύθυνση ανά νυφικό, με όλες τις φωτογραφίες
     4. llms-full.txt                 το τμήμα «Ο κατάλογος αναλυτικά»

   Ασφάλεια: κάθε τιμή του data.json περνά από το esc() πριν μπει σε HTML.
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE = "https://milenadargenzio.netlify.app";
const BRAND = "Milena D'Argenzio";
const CHECK = process.argv.includes("--check");

const MARK = {
  cardsStart: "<!-- BUILD:CARDS:START",
  cardsEnd: "<!-- BUILD:CARDS:END -->",
  ldStart: "<!-- BUILD:JSONLD:START",
  ldEnd: "<!-- BUILD:JSONLD:END -->",
};
const LLMS_HEADING = "## Ο κατάλογος αναλυτικά";

/* ---------- Μικρά εργαλεία ---------- */
const abs = (rel) => path.join(ROOT, rel);
const lf = (s) => s.replace(/\r\n/g, "\n");
const readText = (rel) => lf(fs.readFileSync(abs(rel), "utf8"));
const exists = (rel) => fs.existsSync(abs(rel));

function fail(msg) {
  console.error("build.js: " + msg);
  process.exit(2);
}

/* Κάθε τιμή που μπαίνει σε HTML (κείμενο ή attribute) περνά από εδώ. */
function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const xml = (v) => esc(v);

/* JSON μέσα σε <script>: το σύμβολο «μικρότερο από» γράφεται με τον κωδικό του (u003c),
   ώστε καμία τιμή του data.json να μην μπορεί να κλείσει το script. */
const ldJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

/* 1000 -> "1.000", όπως το Intl el-GR του app.js, χωρίς εξάρτηση από το ICU του Node. */
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const hasPrice = (d) => typeof d.retail === "number" && isFinite(d.retail);
/* Σώμα σελίδας: αδιάσπαστο κενό (οντότητα &nbsp;) ανάμεσα στο ποσό και το €, όπως το δείχνει το app.js. */
const priceHtml = (d) => esc(thousands(d.retail)) + "&nbsp;€";
/* title, meta, aria-label, llms: απλό κενό. */
const priceSp = (d) => thousands(d.retail) + " €";

function truncate(text, max) {
  const s = String(text).trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return cut.slice(0, i > 0 ? i : max).replace(/[,.;:]$/, "") + "…";
}
const firstSentence = (text) => String(text).trim().split(/(?<=[.!;])\s+/)[0];

/* Ίδιο alt με το altFor() του app.js: σιλουέτα + ύφασμα + μέγεθος + πόλη. */
function altFor(d) {
  const det = d.details || {};
  const sil = (det["Σιλουέτα"] || "").trim();
  const fab = (det["Ύφασμα"] || "").split(/[,(]/)[0].trim();
  const bits = ["Νυφικό " + d.code + ": " + d.title];
  if (sil) bits.push("σιλουέτα " + sil.toLowerCase());
  if (fab) bits.push(fab.toLowerCase());
  bits.push("μέγεθος Medium, Θεσσαλονίκη");
  return bits.join(", ");
}

/* Διαστάσεις JPEG από τον δείκτη SOF, χωρίς βιβλιοθήκη. */
function jpegSize(rel) {
  const b = fs.readFileSync(abs(rel));
  if (b[0] !== 0xff || b[1] !== 0xd8) fail("Το αρχείο δεν είναι JPEG: " + rel);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  fail("Δεν βρέθηκαν διαστάσεις στο JPEG: " + rel);
}

/* ---------- Δεδομένα ---------- */
const data = JSON.parse(fs.readFileSync(abs("data.json"), "utf8"));
const config = data.config || {};
/* "hidden": true = το νυφικό μένει στο data.json αλλά βγαίνει από τη δημόσια θέα: καμία κάρτα,
   καμία σελίδα, καμία θέση στο sitemap και στο llms-full.txt. Οι φωτογραφίες του κόβονται
   με 404 στο netlify.toml. Επαναφορά: σβήνεται η σημαία και ακολουθεί node build.js. */
const dresses = (data.dresses || []).filter((d) => !d.hidden);
if (!dresses.length) fail("Το data.json δεν έχει νυφικά.");

const seen = new Set();
for (const d of dresses) {
  if (!/^[A-Za-z0-9_]+$/.test(String(d.code || ""))) fail("Μη έγκυρος κωδικός: " + JSON.stringify(d.code));
  if (seen.has(d.code)) fail("Διπλός κωδικός: " + d.code);
  seen.add(d.code);
  if (!d.title) fail("Λείπει ο τίτλος στο νυφικό " + d.code);
  for (const p of d.photos || []) {
    if (!/^photos\/[A-Za-z0-9_\-/.]+\.jpe?g$/i.test(p) || p.includes("..")) fail("Μη αναμενόμενη διαδρομή φωτογραφίας: " + p);
    if (!exists(p)) fail("Λείπει από τον δίσκο η φωτογραφία " + p + " (νυφικό " + d.code + ")");
  }
}

/* Ίδια σειρά εμφάνισης με το app.js: πρώτα τα showcase κομμάτια. Η λίστα διαβάζεται
   από το ίδιο το app.js, ώστε οι στατικές κάρτες να μένουν πάντα στη σειρά που βλέπει ο επισκέπτης. */
let SHOWCASE = ["01", "02", "03", "04"];
const appJs = readText("app.js");
const showcaseMatch = /const SHOWCASE = (\[[^\]]*\]);/.exec(appJs);
if (showcaseMatch) {
  try { SHOWCASE = JSON.parse(showcaseMatch[1]); } catch (e) { console.warn("build.js: η λίστα SHOWCASE του app.js δεν διαβάστηκε, κρατώ την προεπιλογή."); }
} else {
  console.warn("build.js: δεν βρέθηκε η λίστα SHOWCASE στο app.js, κρατώ την προεπιλογή.");
}
const rank = (d) => { const i = SHOWCASE.indexOf(d.code); return i === -1 ? Infinity : i; };
const list = dresses
  .map((d, i) => ({ d, i }))
  .sort((a, b) => (rank(a.d) - rank(b.d)) || (a.i - b.i))
  .map((x) => x.d);

const dims = new Map();
for (const d of list) for (const p of d.photos || []) dims.set(p, jpegSize(p));

const priced = list.filter(hasPrice);
const prices = priced.map((d) => d.retail);
const minPrice = Math.min(...prices);
const maxPrice = Math.max(...prices);
const countAtMin = priced.filter((d) => d.retail === minPrice).length;
const total = list.length;

const phoneTel = String(config.phone || "").replace(/\s/g, ""); // +306947262433
const phoneShow = String(config.phone || "").replace(/^\+30\s*/, ""); // 694 726 2433
const viberHref = "viber://chat?number=" + phoneTel.replace(/^\+/, "");
if (!/^\+30\d{10}$/.test(phoneTel)) fail("Το τηλέφωνο στο data.json δεν έχει τη μορφή +30 και δέκα ψηφία.");

const dressPath = (d) => "nyfiko/" + d.code + "/";
const dressUrl = (d) => SITE + "/" + dressPath(d);
const photoUrl = (p) => SITE + "/" + p;
const productName = (d) => "Νυφικό Νο " + d.code + ": " + d.title;

/* ---------- Κοινά στοιχεία από το index.html (μία πηγή αλήθειας) ---------- */
const indexSrc = readText("index.html");
const assetV = (/styles\.css\?v=([\w-]+)/.exec(indexSrc) || [])[1] || "1";
const gaId = (/gtag\/js\?id=(G-[A-Z0-9]+)/.exec(indexSrc) || [])[1] || "";
const fontsHref = (/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)" rel="stylesheet">/.exec(indexSrc) || [])[1] || "";

/* ---------- Schema.org ---------- */
function offerFor(d) {
  return {
    "@type": "Offer",
    url: dressUrl(d),
    price: String(d.retail),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
  };
}

function productLd(d, full) {
  const det = d.details || {};
  const photos = (d.photos || []).map(photoUrl);
  const p = { "@type": "Product", name: productName(d), sku: d.code };
  if (photos.length) p.image = full ? photos : photos[0];
  p.description = full ? d.blurb : truncate(d.blurb, 160);
  p.brand = { "@type": "Brand", name: BRAND };
  p.itemCondition = "https://schema.org/NewCondition";
  p.url = dressUrl(d);
  if (det["Ύφασμα"]) p.material = det["Ύφασμα"];
  if (det["Χρώμα"]) p.color = det["Χρώμα"];
  p.size = det["Μέγεθος"] || "Medium";
  const props = [];
  for (const k of full ? ["Σιλουέτα", "Ντεκολτέ", "Λεπτομέρειες"] : ["Σιλουέτα", "Ντεκολτέ"]) {
    if (det[k]) props.push({ "@type": "PropertyValue", name: k, value: det[k] });
  }
  if (props.length) p.additionalProperty = props;
  if (hasPrice(d)) p.offers = offerFor(d);
  return p;
}

function homeGraphLd() {
  const range = "από " + minPrice + " έως " + maxPrice + " ευρώ";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": SITE + "/#website",
        url: SITE + "/",
        name: BRAND,
        inLanguage: "el",
        description: "Στοκ " + total + " αφόρετων, οικονομικών νυφικών " + range + ", μεγέθους Medium, από κλειστό ατελιέ της Θεσσαλονίκης. Δαντέλα, σατέν, τούλι, γοργονέ, μποχό, με μανίκι. Για νύφες και επαγγελματίες του γάμου.",
      },
      {
        "@type": "Organization",
        "@id": SITE + "/#atelier",
        name: BRAND,
        url: SITE + "/",
        logo: SITE + "/logo.jpg",
        address: { "@type": "PostalAddress", addressLocality: config.city || "Θεσσαλονίκη", addressCountry: "GR" },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales",
          telephone: config.phone,
          email: config.email,
          areaServed: "GR",
          availableLanguage: ["el", "en"],
        },
      },
      {
        "@type": "CollectionPage",
        "@id": SITE + "/#catalog",
        url: SITE + "/",
        name: "Στοκ Χειροποίητων Νυφικών " + BRAND,
        isPartOf: { "@id": SITE + "/#website" },
        inLanguage: "el",
        about: "Κατάλογος " + total + " χειροποίητων νυφικών υψηλής ραπτικής, " + range + " το κομμάτι, για νύφες και επαγγελματίες του γάμου.",
      },
      {
        "@type": "ItemList",
        "@id": SITE + "/#items",
        name: "Τα νυφικά του καταλόγου",
        numberOfItems: total,
        itemListElement: list.map((d, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: dressUrl(d),
          item: productLd(d, false),
        })),
      },
    ],
  };
}

/* ---------- Κομμάτια HTML ---------- */
function imgTag(p, alt, extra) {
  const s = dims.get(p);
  return '<img src="' + esc(extra.src) + '" alt="' + esc(alt) + '" width="' + s.width + '" height="' + s.height + '"' + (extra.attrs || "") + ">";
}

function cardHtml(d) {
  const cover = (d.photos || [])[0];
  const label = "Λεπτομέρειες, νυφικό " + d.code + ": " + d.title + (hasPrice(d) ? ", " + priceSp(d) : "");
  const out = [];
  out.push('      <a class="grid-card" href="/' + esc(dressPath(d)) + '" aria-label="' + esc(label) + '">');
  if (cover) {
    out.push('        <div class="gc-photo">' + imgTag(cover, altFor(d), { src: cover, attrs: ' loading="lazy" decoding="async"' }) + "</div>");
  } else {
    out.push('        <div class="gc-photo"></div>');
  }
  out.push('        <p class="gc-code">Κωδικός ' + esc(d.code) + "</p>");
  out.push('        <h3 class="gc-title">' + esc(d.title) + "</h3>");
  out.push('        <p class="gc-price">' + (hasPrice(d) ? priceHtml(d) : "Διαθέσιμο") + "</p>");
  out.push("      </a>");
  return out.join("\n");
}

const ICON_SUN = '<svg class="icon-sun" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19"/></svg>';
const ICON_MOON = '<svg class="icon-moon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';

function dressPageHtml(d, idx) {
  const url = dressUrl(d);
  const det = d.details || {};
  const photos = d.photos || [];
  const cover = photos[0];
  const alt = altFor(d);
  const prev = list[(idx - 1 + total) % total];
  const next = list[(idx + 1) % total];
  const name = productName(d);

  /* Η τιμή μπαίνει νωρίς: η Google κόβει τον τίτλο γύρω στους 60 χαρακτήρες και την περιγραφή στους 160. */
  const title = "Νυφικό " + d.code + (hasPrice(d) ? ", " + priceSp(d) : "") + ": " + d.title + " | Θεσσαλονίκη";
  const desc =
    truncate(firstSentence(d.blurb || d.title), 82) +
    " Καινούργιο, αφόρετο, μέγεθος Medium" + (hasPrice(d) ? ", " + priceSp(d) : "") + ". Πρόβα στη Θεσσαλονίκη. Κωδ. " + d.code + ".";

  const ogImage = cover ? photoUrl(cover) : SITE + "/og-cover.jpg";
  const ogSize = cover ? dims.get(cover) : { width: 1200, height: 630 };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Νυφικά Θεσσαλονίκη", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: name, item: url },
    ],
  };
  const product = Object.assign({ "@context": "https://schema.org" }, productLd(d, true), { category: "Νυφικά" });

  const h = [];
  h.push("<!DOCTYPE html>");
  h.push('<html lang="el" data-dress="' + esc(d.code) + '">');
  h.push("<head>");
  h.push("  <!-- Παράγεται από το build.js με βάση το data.json. Οι αλλαγές γίνονται εκεί και ακολουθεί: node build.js -->");
  h.push('  <meta charset="UTF-8">');
  h.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
  h.push("  <title>" + esc(title) + "</title>");
  h.push('  <meta name="description" content="' + esc(desc) + '">');
  h.push('  <meta name="robots" content="index, follow, max-image-preview:large">');
  h.push('  <link rel="canonical" href="' + esc(url) + '">');
  h.push('  <meta name="geo.region" content="GR-B">');
  h.push('  <meta name="geo.placename" content="Θεσσαλονίκη">');
  h.push('  <meta property="og:title" content="' + esc(title) + '">');
  h.push('  <meta property="og:description" content="' + esc(desc) + '">');
  h.push('  <meta property="og:type" content="product">');
  h.push('  <meta property="og:locale" content="el_GR">');
  h.push('  <meta property="og:site_name" content="' + esc(BRAND) + '">');
  h.push('  <meta property="og:url" content="' + esc(url) + '">');
  h.push('  <meta property="og:image" content="' + esc(ogImage) + '">');
  h.push('  <meta property="og:image:width" content="' + ogSize.width + '">');
  h.push('  <meta property="og:image:height" content="' + ogSize.height + '">');
  h.push('  <meta property="og:image:alt" content="' + esc(alt) + '">');
  if (hasPrice(d)) {
    h.push('  <meta property="product:price:amount" content="' + esc(d.retail) + '">');
    h.push('  <meta property="product:price:currency" content="EUR">');
  }
  h.push('  <meta name="twitter:card" content="summary_large_image">');
  h.push('  <meta name="twitter:title" content="' + esc(title) + '">');
  h.push('  <meta name="twitter:description" content="' + esc(desc) + '">');
  h.push('  <meta name="twitter:image" content="' + esc(ogImage) + '">');
  h.push('  <link rel="icon" type="image/jpeg" href="/logo.jpg">');
  h.push("");
  /* Θέμα πριν ζωγραφιστεί η σελίδα: ίδιο κλειδί και ίδια λογική με το app.js. */
  h.push('  <script>(function(){try{var s=localStorage.getItem("md-theme");document.documentElement.dataset.theme=s||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}catch(e){}})();</script>');
  if (gaId) {
    h.push("");
    h.push("  <!-- Google Analytics 4 -->");
    h.push('  <script async src="https://www.googletagmanager.com/gtag/js?id=' + esc(gaId) + '"></script>');
    h.push("  <script>");
    h.push("    window.dataLayer = window.dataLayer || [];");
    h.push("    function gtag(){dataLayer.push(arguments);}");
    h.push("    gtag('js', new Date());");
    h.push("    gtag('config', '" + gaId.replace(/[^A-Z0-9-]/g, "") + "');");
    h.push("  </script>");
  }
  h.push("");
  if (fontsHref) {
    h.push('  <link rel="preconnect" href="https://fonts.googleapis.com">');
    h.push('  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
    h.push('  <link href="' + fontsHref + '" rel="stylesheet">');
    h.push("");
  }
  h.push('  <link rel="stylesheet" href="/styles.css?v=' + esc(assetV) + '">');
  h.push('  <script defer src="/dress-page.js?v=' + esc(assetV) + '"></script>');
  h.push("");
  h.push('  <script type="application/ld+json">');
  h.push(ldJson(product));
  h.push("  </script>");
  h.push('  <script type="application/ld+json">');
  h.push(ldJson(breadcrumb));
  h.push("  </script>");
  h.push("</head>");
  h.push('<body class="dp-page">');
  h.push('  <a class="skip-link" href="#main">Μετάβαση στο περιεχόμενο</a>');
  h.push("");
  h.push('  <header class="site-header dp-header">');
  h.push('    <a class="wordmark" href="/" aria-label="' + esc(BRAND) + ', αρχική σελίδα">Milena <span>D&#39;Argenzio</span></a>');
  h.push('    <nav class="header-actions" aria-label="Βασικές ενέργειες">');
  h.push('      <a class="dp-back" href="/">Όλα τα νυφικά</a>');
  h.push('      <button class="theme-toggle" id="themeToggle" type="button" hidden aria-label="Εναλλαγή σκούρου και φωτεινού θέματος">');
  h.push("        " + ICON_SUN);
  h.push("        " + ICON_MOON);
  h.push("      </button>");
  h.push("    </nav>");
  h.push("  </header>");
  h.push("");
  h.push('  <main id="main" class="dp">');
  h.push('    <nav class="dp-crumbs" aria-label="Διαδρομή">');
  h.push('      <a href="/">Νυφικά Θεσσαλονίκη</a>');
  h.push('      <span aria-hidden="true">/</span>');
  h.push('      <span aria-current="page">Νυφικό Νο ' + esc(d.code) + "</span>");
  h.push("    </nav>");
  h.push("");
  h.push('    <article class="dp-article">');
  h.push('      <header class="dp-head">');
  h.push('        <p class="dp-code">Κωδικός ' + esc(d.code) + "</p>");
  h.push('        <h1 class="dp-title">' + esc(name) + "</h1>");
  h.push("      </header>");
  h.push("");
  if (cover) {
    h.push('      <div class="dp-media">');
    h.push('        <a class="dp-cover" href="/' + esc(cover) + '">' + imgTag(cover, alt, { src: "/" + cover, attrs: ' fetchpriority="high" decoding="async"' }) + "</a>");
    if (photos.length > 1) {
      h.push('        <div class="dp-more">');
      photos.slice(1).forEach((p, k) => {
        const a = alt + ", φωτογραφία " + (k + 2) + " από " + photos.length;
        h.push('          <a class="dp-shot" href="/' + esc(p) + '">' + imgTag(p, a, { src: "/" + p, attrs: ' loading="lazy" decoding="async"' }) + "</a>");
      });
      h.push("        </div>");
    }
    h.push('        <p class="dp-hint">Πατήστε σε μια φωτογραφία για να τη δείτε ολόκληρη.</p>');
    h.push("      </div>");
    h.push("");
  }
  h.push('      <div class="dp-body">');
  if (hasPrice(d)) {
    h.push('        <p class="dp-price"><span class="dp-price-num">' + priceHtml(d) + '</span> <span class="dp-price-label">Τιμή λιανικής</span></p>');
  }
  h.push('        <ul class="dp-facts">');
  h.push("          <li>Καινούργιο και αφόρετο</li>");
  h.push("          <li>Μέγεθος Medium</li>");
  h.push("          <li>Το δοκιμάζετε από κοντά στη Θεσσαλονίκη και πληρώνετε αφού το δείτε</li>");
  h.push("        </ul>");
  h.push('        <div class="dp-cta">');
  h.push('          <a class="btn btn-fill" href="tel:' + esc(phoneTel) + '" data-contact="phone">Καλέστε στο ' + esc(phoneShow) + "</a>");
  h.push('          <a class="btn" href="' + esc(viberHref) + '" data-contact="viber">Μήνυμα στο Viber</a>');
  h.push("        </div>");
  h.push('        <p class="dp-help">Πείτε μας τον κωδικό ' + esc(d.code) + " και κλείνουμε μαζί το ραντεβού σας για πρόβα.</p>");
  if (d.blurb) h.push('        <p class="dp-blurb">' + esc(d.blurb) + "</p>");
  const detKeys = Object.keys(det);
  if (detKeys.length) {
    h.push('        <h2 class="dp-h2">Χαρακτηριστικά</h2>');
    h.push('        <dl class="dp-specs">');
    for (const k of detKeys) {
      h.push("          <dt>" + esc(k) + "</dt>");
      h.push("          <dd>" + esc(det[k]) + "</dd>");
    }
    h.push("        </dl>");
  }
  h.push("      </div>");
  h.push("    </article>");
  h.push("");
  h.push('    <nav class="dp-nav" aria-label="Περισσότερα νυφικά">');
  h.push('      <a class="dp-nav-link" href="/' + esc(dressPath(prev)) + '"><span class="dp-nav-label">Προηγούμενο νυφικό</span><span class="dp-nav-name">Νο ' + esc(prev.code) + ": " + esc(prev.title) + "</span></a>");
  h.push('      <a class="dp-nav-link dp-nav-next" href="/' + esc(dressPath(next)) + '"><span class="dp-nav-label">Επόμενο νυφικό</span><span class="dp-nav-name">Νο ' + esc(next.code) + ": " + esc(next.title) + "</span></a>");
  h.push("    </nav>");
  h.push('    <div class="dp-links">');
  h.push('      <a class="btn" href="/#kod-' + esc(d.code) + '">Δείτε το μέσα στον κατάλογο</a>');
  h.push('      <a class="btn" href="/">Όλη η συλλογή, ' + total + " νυφικά</a>");
  h.push("    </div>");
  h.push("  </main>");
  h.push("");
  h.push('  <footer class="site-footer">');
  h.push('    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>');
  h.push('    <p class="footer-brand">Milena D&#39;Argenzio</p>');
  h.push('    <p class="footer-brand-sub">ΝΥΦΙΚΑ</p>');
  h.push('    <p class="dp-footer-note">');
  h.push("      Τα νυφικά είναι το αφόρετο στοκ του ατελιέ Milena D&#39;Argenzio στη Θεσσαλονίκη, που ολοκλήρωσε");
  h.push("      τον κύκλο του λόγω συνταξιοδότησης. Διατίθενται ιδιωτικά, από ιδιώτη.");
  h.push('      Τηλέφωνο και Viber: <a href="tel:' + esc(phoneTel) + '" data-contact="phone">' + esc(phoneShow) + "</a>");
  h.push("    </p>");
  h.push("  </footer>");
  h.push("</body>");
  h.push("</html>");
  return h.join("\n") + "\n";
}

/* ---------- index.html: κάρτες + JSON-LD ανάμεσα στα σχόλια-οδηγούς ---------- */
function replaceBetween(src, startMark, endMark, inner, what) {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark);
  if (a === -1 || b === -1 || b < a) fail("Λείπουν τα σχόλια-οδηγοί για " + what + " στο index.html (" + startMark + " ... " + endMark + ").");
  const startLineEnd = src.indexOf("\n", a);
  const endLineStart = src.lastIndexOf("\n", b);
  return src.slice(0, startLineEnd + 1) + inner + src.slice(endLineStart);
}

function indexHtml() {
  let out = indexSrc;
  out = replaceBetween(out, MARK.cardsStart, MARK.cardsEnd, list.map(cardHtml).join("\n"), "τις κάρτες");
  const ld = '  <script type="application/ld+json">\n' + ldJson(homeGraphLd()) + "\n  </script>";
  out = replaceBetween(out, MARK.ldStart, MARK.ldEnd, ld, "το JSON-LD");
  return out;
}

/* ---------- sitemap.xml ---------- */
function sitemapXml(date) {
  const x = [];
  x.push('<?xml version="1.0" encoding="UTF-8"?>');
  x.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  x.push('        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');
  x.push("  <url>");
  x.push("    <loc>" + xml(SITE + "/") + "</loc>");
  x.push("    <lastmod>" + date + "</lastmod>");
  x.push("  </url>");
  for (const d of list) {
    x.push("  <url>");
    x.push("    <loc>" + xml(dressUrl(d)) + "</loc>");
    x.push("    <lastmod>" + date + "</lastmod>");
    for (const p of d.photos || []) {
      x.push("    <image:image>");
      x.push("      <image:loc>" + xml(photoUrl(p)) + "</image:loc>");
      x.push("    </image:image>");
    }
    x.push("  </url>");
  }
  x.push("</urlset>");
  return x.join("\n") + "\n";
}

/* ---------- llms-full.txt: το τμήμα του καταλόγου ---------- */
function llmsFull(date) {
  const src = readText("llms-full.txt");
  const at = src.indexOf(LLMS_HEADING);
  if (at === -1) fail("Λείπει η επικεφαλίδα «" + LLMS_HEADING + "» από το llms-full.txt.");
  const t = [];
  t.push(LLMS_HEADING + " (" + total + " κομμάτια)");
  t.push("");
  t.push("Τελευταία ενημέρωση: " + date);
  t.push("");
  t.push(
    "Όλα τα κομμάτια είναι καινούργια, αφόρετα, σε μέγεθος Medium. Τιμές λιανικής από " + minPrice + " έως " + maxPrice +
    " ευρώ, με " + countAtMin + " κομμάτια στα " + minPrice + " ευρώ. Κάθε νυφικό έχει δική του σελίδα με όλες τις φωτογραφίες του."
  );
  t.push("");
  for (const d of list) {
    const det = d.details || {};
    const bits = ["Νο " + d.code + ": " + d.title];
    for (const k of ["Σιλουέτα", "Ντεκολτέ", "Ύφασμα", "Χρώμα"]) if (det[k]) bits.push(k + ": " + det[k]);
    bits.push("Μέγεθος: " + (det["Μέγεθος"] || "Medium"));
    if (hasPrice(d)) bits.push("Τιμή: " + priceSp(d));
    bits.push(dressUrl(d));
    t.push("- " + bits.join(" | "));
  }
  return src.slice(0, at) + t.join("\n") + "\n";
}

/* ---------- Σύνθεση όλων των αρχείων ---------- */
function outputs(date) {
  const files = new Map();
  list.forEach((d, i) => files.set(dressPath(d) + "index.html", dressPageHtml(d, i)));
  files.set("index.html", indexHtml());
  files.set("sitemap.xml", sitemapXml(date));
  files.set("llms-full.txt", llmsFull(date));
  return files;
}

function diffList(files) {
  const changed = [];
  for (const [rel, content] of files) {
    if (!exists(rel) || readText(rel) !== content) changed.push(rel);
  }
  return changed;
}

/* Φάκελοι nyfiko/<κωδικός> που έμειναν από νυφικό το οποίο βγήκε από το data.json. */
function staleDirs() {
  if (!exists("nyfiko")) return [];
  const valid = new Set(list.map((d) => d.code));
  return fs.readdirSync(abs("nyfiko"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !valid.has(e.name))
    .map((e) => "nyfiko/" + e.name);
}

/* Η ημερομηνία αλλάζει μόνο όταν αλλάζει το περιεχόμενο: πρώτα δοκιμάζουμε με την
   ημερομηνία που είναι ήδη γραμμένη στο sitemap. Έτσι το lastmod μένει αληθινό και
   το --check δίνει το ίδιο αποτέλεσμα όποια μέρα κι αν τρέξει. */
const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
const now = new Date();
const today = process.env.BUILD_DATE || now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail("Μη έγκυρη ημερομηνία: " + today);
const prevDate = exists("sitemap.xml") ? (/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/.exec(readText("sitemap.xml")) || [])[1] : null;

const withPrev = outputs(prevDate || today);
const changed = diffList(withPrev);
const stale = staleDirs();

if (CHECK) {
  if (!changed.length && !stale.length) {
    console.log("build.js --check: όλα ενημερωμένα (" + total + " νυφικά, " + withPrev.size + " αρχεία).");
    process.exit(0);
  }
  console.error("build.js --check: " + (changed.length + stale.length) + " διαφορές. Τρέξτε: node build.js");
  for (const rel of changed) console.error("  διαφέρει: " + rel);
  for (const rel of stale) console.error("  περισσεύει: " + rel);
  process.exit(1);
}

if (!changed.length && !stale.length) {
  console.log("build.js: καμία αλλαγή (" + total + " νυφικά, " + withPrev.size + " αρχεία ήδη ενημερωμένα).");
  process.exit(0);
}

/* Κρατάμε το είδος αλλαγής γραμμής που έχει ήδη ο φάκελος εργασίας (CRLF στα Windows με autocrlf). */
const eol = /\r\n/.test(fs.readFileSync(abs("index.html"), "utf8")) ? "\r\n" : "\n";
const finalFiles = outputs(today);
let written = 0;
for (const [rel, content] of finalFiles) {
  if (exists(rel) && readText(rel) === content) continue;
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), eol === "\n" ? content : content.replace(/\n/g, eol), "utf8");
  written++;
}
for (const rel of stale) {
  const entries = fs.readdirSync(abs(rel));
  if (entries.every((n) => n === "index.html")) {
    fs.rmSync(abs(rel), { recursive: true });
    console.log("build.js: αφαιρέθηκε " + rel);
  } else {
    console.warn("build.js: ο φάκελος " + rel + " έχει και άλλα αρχεία, τον αφήνω ως έχει.");
  }
}
console.log(
  "build.js: γράφτηκαν " + written + " αρχεία. " + total + " νυφικά, " + dims.size + " φωτογραφίες, τιμές " +
  minPrice + " έως " + maxPrice + " ευρώ, ημερομηνία " + today + "."
);
