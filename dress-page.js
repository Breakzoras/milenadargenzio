/* ============================================================
   Milena D'Argenzio - dress-page.js
   Μικρό βοηθητικό script για τις στατικές σελίδες nyfiko/<κωδικός>/.
   Οι σελίδες διαβάζονται ολόκληρες και χωρίς αυτό. Εδώ ζουν μόνο:
   το κουμπί θέματος (σκούρο ή φωτεινό) και οι μετρήσεις επικοινωνίας.
   Κανένα innerHTML, κανένα δεδομένο χρήστη στο DOM.
   ============================================================ */
(function () {
  "use strict";
  var root = document.documentElement;

  /* Κουμπί θέματος: ίδιο κλειδί αποθήκευσης με την αρχική σελίδα (md-theme). */
  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      var next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("md-theme", next);
      } catch (e) {
        /* η επιλογή ισχύει για αυτή την επίσκεψη */
      }
    });
  }

  /* Μετρήσεις Google Analytics: στέλνει γεγονός μόνο όταν υπάρχει το gtag. */
  function track(name, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params || {});
    } catch (e) {
      /* η μέτρηση μένει πάντα αθόρυβη */
    }
  }

  var code = root.getAttribute("data-dress") || "";
  if (code) track("view_dress", { dress_code: code, context: "dress_page" });

  var links = document.querySelectorAll("[data-contact]");
  for (var i = 0; i < links.length; i++) {
    (function (a) {
      a.addEventListener("click", function () {
        track("contact_click", { method: a.getAttribute("data-contact"), context: "dress_page_" + code });
      });
    })(links[i]);
  }
})();
