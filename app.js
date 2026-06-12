/* ============================================================
   Milena D'Argenzio - Atelier Lookbook
   Rendering + interactions. Δεδομένα από data.json (config, dresses).
   ============================================================ */

(async function () {
  "use strict";

  /* ---------- Θέμα (dark/light) ---------- */
  const root = document.documentElement;
  const stored = localStorage.getItem("md-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = stored || (prefersDark ? "dark" : "light");

  document.getElementById("themeToggle").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("md-theme", root.dataset.theme);
  });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Φόρτωση δεδομένων από data.json ---------- */
  let CONFIG = {};
  let DRESSES = [];
  try {
    const _data = await fetch("data.json", { cache: "no-store" }).then((r) => r.json());
    CONFIG = _data.config || {};
    DRESSES = _data.dresses || [];
  } catch (e) {
    console.error("Milena D'Argenzio: αποτυχία φόρτωσης data.json", e);
    document.getElementById("catalog").innerHTML =
      '<p style="text-align:center;padding:4rem 1rem;color:var(--ink-soft)">Προσωρινό πρόβλημα φόρτωσης. Δοκιμάστε ανανέωση.</p>';
    return;
  }

  /* ---------- Header state ---------- */
  const header = document.getElementById("siteHeader");
  const onScrollHeader = () => header.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* ---------- Helpers ---------- */
  const euro = new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  const telHref = () => `tel:${CONFIG.phone.replace(/\s/g, "")}`;

  /* ---------- Toast ---------- */
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3800);
  }

  /* ---------- "Η λίστα μου" (likes) ---------- */
  const likesKey = "md-likes";
  let likes = [];
  try {
    likes = JSON.parse(localStorage.getItem(likesKey) || "[]");
    if (!Array.isArray(likes)) likes = [];
  } catch (e) {
    likes = [];
  }
  likes = likes.filter((c) => DRESSES.some((d) => d.code === c));

  const likeButtons = new Map(); // code -> button
  const likesCountEl = document.getElementById("likesCount");
  const likesFab = document.getElementById("likesFab");
  const likesDialog = document.getElementById("likesDialog");
  const likesBody = document.getElementById("likesBody");

  function saveLikes() {
    localStorage.setItem(likesKey, JSON.stringify(likes));
    likesCountEl.textContent = String(likes.length);
    likesFab.classList.toggle("has-items", likes.length > 0);
  }

  /* Εικονίδιο: "+" όταν δεν είναι στη λίστα, "✓" όταν είναι. Πιο ξεκάθαρο
     affordance για τον χρήστη από μια καρδιά. */
  function likeIcon(saved) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("d", saved ? "M5 12.5l4.5 4.5L19 7" : "M12 5v14M5 12h14");
    svg.appendChild(path);
    return svg;
  }

  function syncLikeButton(code) {
    const btn = likeButtons.get(code);
    if (!btn) return;
    const liked = likes.includes(code);
    btn.classList.toggle("liked", liked);
    btn.setAttribute("aria-pressed", liked ? "true" : "false");
    btn.replaceChildren(
      likeIcon(liked),
      document.createTextNode(liked ? "Αποθηκευμένο στη λίστα μου" : "Μου αρέσει, κράτησέ το")
    );
  }

  function toggleLike(code) {
    if (likes.includes(code)) {
      likes = likes.filter((c) => c !== code);
      saveLikes();
      syncLikeButton(code);
      toast(`Ο κωδικός ${code} αφαιρέθηκε από τη λίστα σας.`);
    } else {
      likes.push(code);
      saveLikes();
      syncLikeButton(code);
      toast(`Ο κωδικός ${code} αποθηκεύτηκε. Δείτε τη λίστα σας κάτω δεξιά.`);
    }
  }

  function makeLikeButton(code) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "like-btn";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", `Μου αρέσει το νυφικό με κωδικό ${code}, αποθήκευση στη λίστα μου`);
    btn.addEventListener("click", () => toggleLike(code));
    likeButtons.set(code, btn);
    return btn;
  }

  /* ---------- Κουμπιά επικοινωνίας (click-to-reveal) ---------- */
  function revealButton(label, value, href) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = label;
    btn.setAttribute("aria-label", `Εμφάνιση: ${label}`);
    btn.addEventListener(
      "click",
      () => {
        const a = document.createElement("a");
        a.className = "btn btn-fill";
        a.href = href;
        a.textContent = value;
        btn.replaceWith(a);
        a.focus();
      },
      { once: true }
    );
    return btn;
  }

  function ctaRow(code) {
    const wrap = document.createElement("div");
    wrap.className = "cta-wrap";

    /* Κύρια ενέργεια: Μου αρέσει */
    wrap.appendChild(makeLikeButton(code));
    const help = document.createElement("p");
    help.className = "cta-help";
    help.textContent = "Κρατήστε τον κωδικό στη λίστα σας και στείλτε τον μας όποτε θέλετε.";
    wrap.appendChild(help);

    /* Δευτερεύουσες ενέργειες: επικοινωνία */
    const row = document.createElement("div");
    row.className = "cta-row";
    const subject = encodeURIComponent(CONFIG.emailSubject.replace("{code}", code));
    row.appendChild(revealButton("Τηλέφωνο", CONFIG.phone, telHref()));
    row.appendChild(revealButton("Email", CONFIG.email, `mailto:${CONFIG.email}?subject=${subject}`));
    wrap.appendChild(row);
    return wrap;
  }

  /* ---------- Placeholder "φωτογραφία" (SVG) ---------- */
  function placeholderSrc(code, i) {
    const palettes = [
      ["#efe3d8", "#dcc8e4", "#8a6da6"],
      ["#ece4dc", "#d4c2e8", "#7d639c"],
      ["#f1e6dd", "#cfc0e0", "#94789f"],
    ];
    const [c1, c2, ink] = palettes[i % palettes.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${c1}"/>
          <stop offset="1" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="600" height="800" fill="url(#g)"/>
      <g fill="none" stroke="${ink}" stroke-width="2.2" opacity="0.7">
        <path d="M300 118 c0 -16 20 -16 20 -4 c0 9 -9 11 -20 16 l0 22"/>
        <path d="M300 152 l-88 46 l176 0 z"/>
        <path d="M245 240 Q300 268 355 240 Q359 318 331 362 Q452 540 428 668 Q300 708 172 668 Q148 540 269 362 Q241 318 245 240 Z"/>
        <path d="M269 362 Q300 378 331 362"/>
        <path d="M281 424 Q299 590 289 658 M324 424 Q338 580 350 654"/>
        <path d="M245 244 Q232 296 218 322 M355 244 Q368 296 382 322"/>
      </g>
      <text x="300" y="752" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${ink}" opacity="0.85">${code} · Φωτογραφία σύντομα</text>
    </svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function firstPhoto(dress, i) {
    return dress.photos && dress.photos.length
      ? dress.photos[0]
      : placeholderSrc(dress.code, i);
  }

  /* ---------- Lightbox (φωτογραφία πλήρους οθόνης) ---------- */
  const lightbox = document.getElementById("lightbox");
  const lbImage = document.getElementById("lbImage");
  const lbCaption = document.getElementById("lbCaption");
  const lbPrev = document.getElementById("lbPrev");
  const lbNext = document.getElementById("lbNext");
  let lbDress = null;
  let lbList = [];
  let lbIndex = 0;

  function lbRender() {
    lbImage.src = lbList[lbIndex];
    lbImage.alt = `Νυφικό ${lbDress.code}: ${lbDress.title}`;
    const counter = lbList.length > 1 ? ` (${lbIndex + 1}/${lbList.length})` : "";
    lbCaption.textContent = `Κωδικός ${lbDress.code} · ${lbDress.title}${counter}`;
    const multi = lbList.length > 1;
    lbPrev.hidden = !multi;
    lbNext.hidden = !multi;
  }
  function lbStep(delta) {
    if (lbList.length < 2) return;
    lbIndex = (lbIndex + delta + lbList.length) % lbList.length;
    lbRender();
  }
  function openLightbox(dress, list, index) {
    lbDress = dress;
    lbList = list;
    lbIndex = index || 0;
    lbRender();
    if (!lightbox.open) lightbox.showModal();
  }

  lbPrev.addEventListener("click", (e) => { e.stopPropagation(); lbStep(-1); });
  lbNext.addEventListener("click", (e) => { e.stopPropagation(); lbStep(1); });
  document.getElementById("lbClose").addEventListener("click", () => lightbox.close());
  // Κλικ στο φόντο (έξω από την εικόνα) κλείνει
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.classList.contains("lb-figure")) lightbox.close();
  });
  // Βελάκια πληκτρολογίου
  document.addEventListener("keydown", (e) => {
    if (!lightbox.open) return;
    if (e.key === "ArrowLeft") lbStep(-1);
    else if (e.key === "ArrowRight") lbStep(1);
  });
  // Σύρσιμο (swipe) σε κινητά
  let touchX = null;
  lightbox.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) lbStep(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  /* ---------- Σειρά εμφάνισης ----------
     Τα showcase κομμάτια προβάλλονται πρώτα. Άλλαξε τη σειρά εδώ
     ή πρόσθεσε/αφαίρεσε κωδικούς. Τα υπόλοιπα κρατούν τη σειρά του data.js. */
  const SHOWCASE = ["01", "02", "03", "04"];
  DRESSES.sort((a, b) => {
    const ai = SHOWCASE.indexOf(a.code);
    const bi = SHOWCASE.indexOf(b.code);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });

  /* ---------- Render καταλόγου ---------- */
  const catalog = document.getElementById("catalog");

  DRESSES.forEach((d, i) => {
    const section = document.createElement("article");
    section.className = "chapter";
    section.id = `kod-${d.code}`;

    /* Φωτογραφίες του κομματιού (πραγματικές ή placeholder) */
    const gallery = d.photos && d.photos.length ? d.photos.slice() : [placeholderSrc(d.code, i)];
    let activeIndex = 0;

    /* Photo + gallery thumbnails */
    const photoWrap = document.createElement("div");
    photoWrap.className = "ch-photo";
    const frame = document.createElement("button");
    frame.type = "button";
    frame.className = "frame reveal-wipe";
    frame.setAttribute("aria-label", `Άνοιγμα φωτογραφίας σε πλήρη οθόνη, νυφικό ${d.code}`);
    const img = document.createElement("img");
    img.src = gallery[0];
    img.alt = `Νυφικό ${d.code}: ${d.title}`;
    img.loading = i === 0 ? "eager" : "lazy";
    img.decoding = "async";
    frame.appendChild(img);
    const zoomHint = document.createElement("span");
    zoomHint.className = "zoom-hint";
    zoomHint.setAttribute("aria-hidden", "true");
    zoomHint.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.8v5.4M7.8 10.5h5.4"/></svg><span>Μεγέθυνση</span>';
    frame.appendChild(zoomHint);
    frame.addEventListener("click", () => openLightbox(d, gallery, activeIndex));
    photoWrap.appendChild(frame);

    let thumbButtons = [];
    if (gallery.length > 1) {
      const thumbs = document.createElement("div");
      thumbs.className = "thumbs reveal";
      thumbs.style.setProperty("--d", "0.45s");
      thumbs.setAttribute("role", "group");
      thumbs.setAttribute("aria-label", `Φωτογραφίες νυφικού ${d.code}`);
      gallery.forEach((src, pi) => {
        const tBtn = document.createElement("button");
        tBtn.type = "button";
        tBtn.className = "thumb" + (pi === 0 ? " active" : "");
        tBtn.setAttribute("aria-label", `Φωτογραφία ${pi + 1} από ${gallery.length}`);
        const tImg = document.createElement("img");
        tImg.src = src;
        tImg.alt = "";
        tImg.loading = "lazy";
        tImg.decoding = "async";
        tBtn.appendChild(tImg);
        tBtn.addEventListener("click", () => {
          activeIndex = pi;
          img.src = src;
          thumbButtons.forEach((b) => b.classList.remove("active"));
          tBtn.classList.add("active");
        });
        thumbButtons.push(tBtn);
        thumbs.appendChild(tBtn);
      });
      photoWrap.appendChild(thumbs);
    }
    section.appendChild(photoWrap);

    /* Info */
    const info = document.createElement("div");
    info.className = "ch-info";

    const codeEl = document.createElement("p");
    codeEl.className = "ch-code reveal-code";
    codeEl.textContent = `Κωδικός ${d.code}`;
    info.appendChild(codeEl);

    const title = document.createElement("h2");
    title.className = "ch-title reveal";
    title.style.setProperty("--d", "0.08s");
    title.textContent = d.title;
    info.appendChild(title);

    const blurb = document.createElement("p");
    blurb.className = "ch-blurb reveal";
    blurb.style.setProperty("--d", "0.18s");
    blurb.textContent = d.blurb;
    info.appendChild(blurb);

    if (d.details && Object.keys(d.details).length) {
      const dl = document.createElement("dl");
      dl.className = "ch-specs reveal";
      dl.style.setProperty("--d", "0.26s");
      for (const [k, v] of Object.entries(d.details)) {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        dl.appendChild(dt);
        dl.appendChild(dd);
      }
      info.appendChild(dl);
    }

    const priceRow = document.createElement("div");
    priceRow.className = "ch-price-row reveal";
    priceRow.style.setProperty("--d", "0.32s");
    const price = document.createElement("span");
    price.className = "ch-price";
    price.textContent = d.retail != null ? euro.format(d.retail) : "Διαθέσιμο";
    if (d.retail == null) price.classList.add("ch-price-tbd");
    priceRow.appendChild(price);
    if (d.retail != null) {
      const priceLabel = document.createElement("span");
      priceLabel.className = "ch-price-label";
      priceLabel.textContent = "Τιμή λιανικής";
      priceRow.appendChild(priceLabel);
    }
    info.appendChild(priceRow);

    const b2bNote = document.createElement("p");
    b2bNote.className = "ch-b2b-note reveal";
    b2bNote.style.setProperty("--d", "0.36s");
    b2bNote.textContent = "Ειδική τιμή επαγγελματία κατόπιν επικοινωνίας.";
    info.appendChild(b2bNote);

    const cta = ctaRow(d.code);
    cta.classList.add("reveal");
    cta.style.setProperty("--d", "0.42s");
    info.appendChild(cta);

    section.appendChild(info);
    catalog.appendChild(section);
    syncLikeButton(d.code);
  });

  saveLikes();

  /* ---------- Outro CTA ---------- */
  (function buildOutroCta() {
    const row = document.getElementById("outroCta");
    const subject = encodeURIComponent("Ενδιαφέρον για τον κατάλογο - Milena D'Argenzio");
    row.appendChild(revealButton("Τηλέφωνο", CONFIG.phone, telHref()));
    row.appendChild(revealButton("Email", CONFIG.email, `mailto:${CONFIG.email}?subject=${subject}`));
  })();

  /* ---------- Ευρετήριο ---------- */
  const dialog = document.getElementById("indexDialog");
  const grid = document.getElementById("indexGrid");

  DRESSES.forEach((d, i) => {
    const card = document.createElement("a");
    card.className = "index-card";
    card.href = `#kod-${d.code}`;

    const img = document.createElement("img");
    img.src = firstPhoto(d, i);
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    card.appendChild(img);

    const code = document.createElement("p");
    code.className = "index-card-code";
    code.textContent = d.code;
    card.appendChild(code);

    const title = document.createElement("p");
    title.className = "index-card-title";
    title.textContent = d.title;
    card.appendChild(title);

    const price = document.createElement("p");
    price.className = "index-card-price";
    price.textContent = d.retail != null ? euro.format(d.retail) : "Διαθέσιμο";
    card.appendChild(price);

    card.addEventListener("click", () => dialog.close());
    grid.appendChild(card);
  });

  document.getElementById("indexBtn").addEventListener("click", () => dialog.showModal());
  document.getElementById("indexClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* ---------- "Η λίστα μου" dialog ---------- */
  function renderLikesDialog() {
    likesBody.replaceChildren();

    if (!likes.length) {
      const empty = document.createElement("p");
      empty.className = "likes-empty";
      empty.textContent =
        "Δεν έχετε κρατήσει κανένα νυφικό ακόμη. Καθώς βλέπετε τον κατάλογο, πατήστε «Μου αρέσει» κάτω από όποιο νυφικό σας ενδιαφέρει και ο κωδικός του θα εμφανιστεί εδώ.";
      likesBody.appendChild(empty);
      return;
    }

    const help = document.createElement("p");
    help.className = "likes-help";
    help.textContent =
      "Αυτά είναι τα νυφικά που κρατήσατε. Αναφέρετε τους κωδικούς τους όταν επικοινωνήσετε μαζί μας.";
    likesBody.appendChild(help);

    const list = document.createElement("div");
    list.className = "likes-list";
    likes.forEach((code) => {
      const d = DRESSES.find((x) => x.code === code);
      if (!d) return;
      const i = DRESSES.indexOf(d);

      const row = document.createElement("div");
      row.className = "likes-row";

      const img = document.createElement("img");
      img.src = firstPhoto(d, i);
      img.alt = "";
      img.loading = "lazy";
      row.appendChild(img);

      const meta = document.createElement("div");
      meta.className = "likes-row-meta";
      const codeP = document.createElement("p");
      codeP.className = "index-card-code";
      codeP.textContent = `Κωδικός ${d.code}`;
      const titleP = document.createElement("p");
      titleP.className = "likes-row-title";
      titleP.textContent = d.title;
      meta.appendChild(codeP);
      meta.appendChild(titleP);
      row.appendChild(meta);

      const goto = document.createElement("a");
      goto.className = "likes-row-goto";
      goto.href = `#kod-${d.code}`;
      goto.textContent = "Προβολή";
      goto.addEventListener("click", () => likesDialog.close());
      row.appendChild(goto);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "likes-row-remove";
      remove.setAttribute("aria-label", `Αφαίρεση του κωδικού ${d.code} από τη λίστα`);
      remove.textContent = "Αφαίρεση";
      remove.addEventListener("click", () => {
        toggleLike(d.code);
        renderLikesDialog();
      });
      row.appendChild(remove);

      list.appendChild(row);
    });
    likesBody.appendChild(list);

    /* Σύνοψη κωδικών + ενέργειες */
    const summary = document.createElement("div");
    summary.className = "likes-summary";

    const codesLine = document.createElement("p");
    codesLine.className = "likes-codes";
    codesLine.textContent = `Οι κωδικοί σας: ${likes.join(", ")}`;
    summary.appendChild(codesLine);

    const actions = document.createElement("div");
    actions.className = "cta-row likes-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn";
    copyBtn.textContent = "Αντιγραφή κωδικών";
    copyBtn.addEventListener("click", () => {
      const text = likes.join(", ");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => toast("Οι κωδικοί αντιγράφηκαν. Μπορείτε να τους επικολλήσετε σε μήνυμα."),
          () => toast(`Οι κωδικοί σας: ${text}`)
        );
      } else {
        toast(`Οι κωδικοί σας: ${text}`);
      }
    });
    actions.appendChild(copyBtn);

    const subject = encodeURIComponent(`Ενδιαφέρον για νυφικά: ${likes.join(", ")} - Milena D'Argenzio`);
    const body = encodeURIComponent(
      `Καλησπέρα σας.\n\nΕίδα τον κατάλογο Milena D'Argenzio και ενδιαφέρομαι για τα νυφικά με κωδικούς: ${likes.join(", ")}.\n\nΠαρακαλώ ενημερώστε με για τις τιμές επαγγελματία και τη διαθεσιμότητα.\n\nΕυχαριστώ.`
    );
    actions.appendChild(revealButton("Τηλέφωνο", CONFIG.phone, telHref()));
    actions.appendChild(
      revealButton("Αποστολή με Email", CONFIG.email, `mailto:${CONFIG.email}?subject=${subject}&body=${body}`)
    );
    summary.appendChild(actions);
    likesBody.appendChild(summary);
  }

  likesFab.addEventListener("click", () => {
    renderLikesDialog();
    likesDialog.showModal();
  });
  document.getElementById("likesClose").addEventListener("click", () => likesDialog.close());
  likesDialog.addEventListener("click", (e) => {
    if (e.target === likesDialog) likesDialog.close();
  });

  /* ---------- Tutorial (μία φορά) ---------- */
  const tutorialDialog = document.getElementById("tutorialDialog");
  const tutorialKey = "md-tutorial-seen";
  if (!localStorage.getItem(tutorialKey)) {
    const firstChapter = catalog.querySelector(".chapter");
    if (firstChapter) {
      const tutObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            tutObserver.disconnect();
            if (!localStorage.getItem(tutorialKey)) tutorialDialog.showModal();
          }
        },
        { threshold: 0.25 }
      );
      tutObserver.observe(firstChapter);
    }
    tutorialDialog.addEventListener("close", () => localStorage.setItem(tutorialKey, "1"));
    document.getElementById("tutorialOk").addEventListener("click", () => tutorialDialog.close());
  }

  /* ---------- Scroll reveals (scroll-driven, αλάνθαστο) ----------
     Αντί για IntersectionObserver (που χάνει στοιχεία σε γρήγορο
     scroll και άφηνε φωτογραφίες μισοκρυμμένες), ελέγχουμε σε κάθε
     scroll τη θέση κάθε στοιχείου. Μόλις το πάνω χείλος του μπει
     λίγο μέσα από το κάτω χείλος της οθόνης, αποκαλύπτεται. */
  let revealPending = Array.from(
    document.querySelectorAll(".reveal, .reveal-wipe, .reveal-code")
  );

  function runReveal() {
    revealTicking = false;
    if (!revealPending.length) return;
    const vh = window.innerHeight;
    const trigger = vh * 0.9; // σκάει όταν μπει 10% μέσα από το κάτω χείλος
    const still = [];
    for (const el of revealPending) {
      const r = el.getBoundingClientRect();
      // Ορατό ή ήδη πέρασε (πάνω από την οθόνη) -> αποκάλυψη
      if (r.top < trigger && r.bottom > -40) {
        el.classList.add("in");
      } else if (r.bottom <= -40) {
        // πέρασε εντελώς προς τα πάνω χωρίς να προλάβει: δείξ' το ούτως ή άλλως
        el.classList.add("in");
      } else {
        still.push(el);
      }
    }
    revealPending = still;
  }

  let revealTicking = false;
  function onRevealScroll() {
    if (!revealTicking) {
      revealTicking = true;
      requestAnimationFrame(runReveal);
    }
  }
  window.addEventListener("scroll", onRevealScroll, { passive: true });
  window.addEventListener("resize", onRevealScroll, { passive: true });
  // Ασφάλεια για anchor-jumps (Ευρετήριο, #hash) που δεν παράγουν scroll event
  window.addEventListener("load", () => setTimeout(onRevealScroll, 100));
  window.addEventListener("hashchange", () => setTimeout(onRevealScroll, 500));
  runReveal(); // αρχικό πέρασμα για ό,τι είναι ήδη ορατό

  /* ---------- Cinematic parallax (interlude) ----------
     Η εικόνα κινείται πιο αργά από το scroll -> βάθος. Μόνο transform
     (GPU), rAF-throttled. Ανενεργό σε κινητά + reduced-motion (εκεί
     μένει στατική) για να μην υπάρχει jank. */
  const interludeBg = document.getElementById("interludeBg");
  if (
    interludeBg &&
    !reducedMotion &&
    window.matchMedia("(min-width: 901px)").matches
  ) {
    const band = interludeBg.parentElement;
    let pTick = false;
    function parallax() {
      pTick = false;
      const rect = band.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < -50 || rect.top > vh + 50) return;
      const center = rect.top + rect.height / 2;
      const rel = (center - vh / 2) / (vh / 2 + rect.height / 2); // ~ -1..1
      const y = -rel * rect.height * 0.14; // μένει μέσα στο 18% overflow
      interludeBg.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    }
    const onParallax = () => {
      if (!pTick) {
        pTick = true;
        requestAnimationFrame(parallax);
      }
    };
    window.addEventListener("scroll", onParallax, { passive: true });
    window.addEventListener("resize", onParallax, { passive: true });
    parallax();
  }

  /* ---------- Schema.org JSON-LD ---------- */
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Milena D'Argenzio, Κατάλογος χειροποίητων νυφικών (ιδιωτική διάθεση στοκ)",
    description:
      "Χειροποίητα νυφικά υψηλής ραπτικής από κλειστό κατάστημα της Θεσσαλονίκης. Ιδιωτική πώληση στοκ, ειδικές τιμές για επαγγελματίες του γάμου.",
    itemListElement: DRESSES.map((d, i) => {
      const item = {
        "@type": "Product",
        name: `Νυφικό ${d.code}: ${d.title}`,
        description: d.blurb,
        sku: d.code,
      };
      if (d.retail != null) {
        item.offers = {
          "@type": "Offer",
          price: d.retail,
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
        };
      }
      return { "@type": "ListItem", position: i + 1, item };
    }),
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(ld);
  document.head.appendChild(script);

  /* ---------- Υπενθύμιση config ---------- */
  if (CONFIG.phone.includes("X") || CONFIG.email.includes("example")) {
    console.warn(
      "Milena D'Argenzio: Συμπληρώστε email/phone στο data.js πριν το deploy."
    );
  }
})();
