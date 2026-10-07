# Milena D'Argenzio - Atelier Lookbook

Στατικός κατάλογος νυφικών (ιδιωτική διάθεση στοκ). Καθαρό HTML/CSS/JS, χωρίς dependencies.
Το Netlify δημοσιεύει τον φάκελο όπως είναι, χωρίς build step. Το `build.js` τρέχει τοπικά, με το χέρι.

## Δομή

```
milena-dargenzio/
  index.html        Η αρχική (hero, story, κάρτες, συχνές ερωτήσεις, footer)
  styles.css        Όλο το styling (light + dark θέμα), μαζί με τις σελίδες νυφικών
  app.js            Η αρχική: κάρτες, καρτέλα σε παράθυρο, ευρετήριο, λίστα, theme toggle
  dress-page.js     Μικρό script για τις σελίδες νυφικών (theme toggle, μετρήσεις)
  data.json         config (επικοινωνία) + dresses (τα νυφικά). Η μία πηγή αλήθειας
  build.js          Γράφει τις στατικές σελίδες και τα παράγωγα αρχεία από το data.json
  nyfiko/<κωδικός>/ Μία σελίδα ανά νυφικό (παράγεται από το build.js)
  photos/           Φωτογραφίες ανά κωδικό
  og-cover.jpg      Εικόνα προεπισκόπησης για κοινοποιήσεις (1200x630, από φωτογραφίες της συλλογής)
  sitemap.xml       Παράγεται από το build.js
  llms.txt          LLM discoverability (σύντομο)
  llms-full.txt     LLM discoverability (πλήρες, ο κατάλογος παράγεται από το build.js)
  netlify.toml      Κεφαλίδες cache και ασφαλείας
  robots.txt
```

## Μετά από ΚΑΘΕ αλλαγή στο data.json ή στις φωτογραφίες

```powershell
node build.js          # γράφει nyfiko/, κάρτες και JSON-LD στο index.html, sitemap.xml, llms-full.txt
node build.js --check  # επιβεβαίωση: κωδικός εξόδου 0 σημαίνει ότι όλα είναι ενημερωμένα
```

Το `build.js` αλλάζει στο `index.html` μόνο ό,τι βρίσκεται ανάμεσα στα σχόλια `BUILD:CARDS` και `BUILD:JSONLD`.
Οι σελίδες `nyfiko/` γράφονται ολόκληρες από το script, οπότε κάθε αλλαγή τους γίνεται στο `build.js`.

## Πώς προστίθεται νυφικό

1. Φάκελος φωτογραφιών: `photos/<ΚΩΔΙΚΟΣ>/01.jpg, 02.jpg, ...`
   (κατακόρυφες 3:4 ιδανικά, max 1600px μεγάλη πλευρά, JPEG quality 85)
2. Νέο entry στο `data.json`, στον πίνακα `dresses`:

```json
{
  "code": "034",
  "title": "Σύντομος τίτλος",
  "blurb": "Περιγραφή 2-4 προτάσεις.",
  "details": { "Σιλουέτα": "Α γραμμή", "Ύφασμα": "Σατέν", "Χρώμα": "Ιβουάρ", "Μέγεθος": "Medium" },
  "retail": 150,
  "photos": ["photos/034/01.jpg", "photos/034/02.jpg"]
}
```

3. `node build.js` και μετά `node build.js --check`.
4. Όταν αλλάζει το πλήθος ή το εύρος τιμών, ενημερώνονται με το χέρι ο τίτλος, η περιγραφή
   και οι συχνές ερωτήσεις στο `index.html`, καθώς και το `llms.txt` και η αρχή του `llms-full.txt`.

Πωλημένο κομμάτι: αφαιρείται από το `dresses` και ξανατρέχει το `build.js`, που σβήνει και τη σελίδα του.

Κρυμμένο κομμάτι (μένει στο αρχείο, βγαίνει από τη δημόσια θέα): `"hidden": true` στο entry του
και `node build.js`. Χάνει κάρτα, σελίδα, θέση στο sitemap και στο llms-full.txt. Για να κοπούν και
οι φωτογραφίες του μπαίνει ένας κανόνας 404 στο `netlify.toml`. Από 07-10 είναι κρυμμένα τα 21
νυφικά των 100 και 150 ευρώ, με εντολή της ιδιοκτήτριας. Επαναφορά: σβήνεται η σημαία, σβήνονται
οι κανόνες του `netlify.toml`, διορθώνονται οι τιμές «από 200» στο `index.html` και στα `llms`.

## Σύνδεσμοι ανά νυφικό

- `https://milenadargenzio.netlify.app/#kod-021` ανοίγει την καρτέλα του νυφικού μέσα στην αρχική.
- `https://milenadargenzio.netlify.app/nyfiko/021/` είναι η δική του σελίδα, με δική της φωτογραφία
  και τιμή στην προεπισκόπηση όταν κοινοποιείται.

## Τοπική προεπισκόπηση

```powershell
python -m http.server 4750 --directory "C:\Claude Projects\milena-dargenzio"
# μετά άνοιξε http://localhost:4750
```

## Deploy

Το Netlify δημοσιεύει τη ρίζα του repo σε κάθε push στο `main`. Κάθε push είναι ένα deploy.
Όταν αλλάζει το `styles.css` ή το `app.js`, αλλάζει και η παράμετρος `?v=` στο `index.html`
και ξανατρέχει το `build.js`, ώστε να την πάρουν και οι σελίδες νυφικών.

## Σημειώσεις

- Dark/light theme: αυτόματο από το σύστημα του επισκέπτη + χειροκίνητο toggle (αποθηκεύεται).
- Τα κουμπιά Τηλέφωνο/Email στην αρχική δείχνουν τον αριθμό και τη διεύθυνση με το πρώτο κλικ.
  Στις σελίδες νυφικών το τηλέφωνο φαίνεται κατευθείαν.
- Προσβασιμότητα: 18px βάση, υψηλή αντίθεση, πλήκτρα 48px, focus rings, reduced motion support.
