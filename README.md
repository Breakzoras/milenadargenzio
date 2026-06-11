# Milena D'Argenzio - Atelier Lookbook

Στατικός κατάλογος νυφικών (ιδιωτική διάθεση στοκ). Καθαρό HTML/CSS/JS, χωρίς build step, χωρίς dependencies.

## Δομή

```
milena-dargenzio/
  index.html      Η σελίδα (hero, story, catalog, ευρετήριο, footer)
  styles.css      Όλο το styling (light + dark θέμα)
  app.js          Rendering καταλόγου, ευρετήριο, theme toggle, schema.org
  data.js         CONFIG (επικοινωνία) + DRESSES (τα νυφικά)
  photos/         Φωτογραφίες ανά κωδικό (βλ. παρακάτω)
  llms.txt        LLM discoverability (σύντομο)
  llms-full.txt   LLM discoverability (πλήρες)
  robots.txt
```

## Πώς προστίθεται νυφικό

1. Φάκελος φωτογραφιών: `photos/<ΚΩΔΙΚΟΣ>/01.jpg, 02.jpg, ...`
   (κατακόρυφες 3:4 ιδανικά, max 1600px μεγάλη πλευρά, JPEG quality 85)
2. Νέο entry στο `data.js` στον πίνακα `DRESSES`:

```js
{
  code: "Α-05",
  title: "Σύντομος τίτλος",
  blurb: "Περιγραφή 2-4 προτάσεις.",
  details: { "Μέγεθος": "38", "Ύφασμα": "Μετάξι", "Κατάσταση": "Αφόρετο", "Χρώμα": "Ιβουάρ" },
  retail: 1900,
  photos: ["photos/A-05/01.jpg", "photos/A-05/02.jpg"],
},
```

Αν το `photos` είναι κενό `[]`, εμφανίζεται αυτόματα κομψό placeholder.

## Πριν το deploy (ΥΠΟΧΡΕΩΤΙΚΑ)

Στο `data.js`, στο `CONFIG`, συμπλήρωσε:
- `phone`: π.χ. `+306912345678` (E.164, χωρίς κενά)
- `email`

Τα κουμπιά Τηλέφωνο/Email στο site αποκαλύπτουν το νούμερο/διεύθυνση με το πρώτο κλικ
(δεν εμφανίζονται πουθενά πριν το κλικ, ήπια προστασία από scrapers).

## Τοπική προεπισκόπηση

Διπλό κλικ στο `index.html`, ή:

```powershell
python -m http.server 4750 --directory "C:\Claude Projects\milena-dargenzio"
# μετά άνοιξε http://localhost:4750
```

## Deploy σε Cloudflare Pages (δωρεάν hosting + δωρεάν subdomain)

1. https://dash.cloudflare.com > Workers & Pages > Create > Pages > "Upload assets"
2. Όνομα project: `milenadargenzio` (δίνει το URL `milenadargenzio.pages.dev`)
3. Σύρε ΟΛΟ τον φάκελο `milena-dargenzio` στο upload
4. Deploy. Το site είναι live σε λίγα δευτερόλεπτα με SSL.

Για κάθε ενημέρωση (νέα νυφικά, sold out): ξανά upload από το ίδιο μενού (Create new deployment).

Αν αργότερα θες δικό σου domain (.com): Pages project > Custom domains > πρόσθεσέ το, χωρίς καμία αλλαγή στον κώδικα.

## Σημειώσεις

- Dark/light theme: αυτόματο από το σύστημα του επισκέπτη + χειροκίνητο toggle (αποθηκεύεται).
- Πωλημένο κομμάτι: αφαίρεσέ το από το `DRESSES` (ή κρατάμε "sold" badge, μελλοντική προσθήκη).
- Προσβασιμότητα: 18px βάση, WCAG AA contrast, πλήκτρα 48px, focus rings, reduced motion support.
