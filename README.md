
# 💱 Currency Exchange App

Aplicație web simplă și modernă de conversie valutară, construită în cadrul workshopului **"Dezvoltare modernă cu asistenți AI"**, folosind HTML, CSS și JavaScript vanilla, cu asistența GitHub Copilot.

🔗 **Demo live:** [[GitHub Pages]](https://yamatonm.github.io/PSI/)
📦 **Repository:** [[repo]](https://yamatonm.github.io/PSI/)

---

## ✨ Funcționalități

- **Conversie valutară în timp real**, folosind [Currency API](https://github.com/fawazahmed0/currency-api) (gratuit, fără cheie API).
- **Butoane rapide** pentru cele mai utilizate monede (EUR, USD, GBP, RON) + **listă completă** pentru monede mai puțin comune.
- **Monede favorite** — poți fixa propriile monede preferate (salvate local în browser), cu buton dedicat de adăugare/eliminare.
- **Buton de swap** pentru inversarea rapidă a valutelor.
- **Curs de referință afișat automat** ("1 EUR = 1.08 USD"), independent de suma introdusă.
- **Grafic istoric** (sparkline) cu evoluția cursului pe ultimele 7/30 de zile, inclusiv puncte de referință (min/max, hover cu detalii, linie pentru cursul curent).
- **Mod offline/fallback** — dacă API-ul nu răspunde, aplicația afișează ultimul curs cunoscut, salvat local, cu un avertisment vizibil.
- **Fundal animat SVG**, discret și performant, cu suport pentru `prefers-reduced-motion`.
- **Accesibilitate** — navigare completă din tastatură, `aria-live` pentru rezultate, focus vizibil.
- **Animație la actualizarea rezultatului** (count-up/count-down).
- **Filtrare monede inexistente** — codurile valutare istorice/desființate (ex: ITL, ROL, DEM) sunt excluse automat din liste.
- Input cu **debounce**, pentru performanță la tastare rapidă.

## 🛠️ Tehnologii folosite

- HTML5, CSS3, JavaScript (ES6+) — fără framework-uri sau build tools
- [Currency API by fawazahmed0](https://github.com/fawazahmed0/currency-api) pentru cursurile valutare (curente și istorice)
- `localStorage` pentru favorite și cache offline
- GitHub Copilot pentru generarea și rafinarea codului

## 📁 Structura proiectului

```
├── index.html      # structura paginii
├── style.css       # stiluri și animații
├── script.js       # logica aplicației (fetch, conversie, favorite, cache)
├── config.js       # constante pentru URL-urile API-ului
└── README.md
```

## 🚀 Rulare locală

Fiind un proiect frontend static, nu necesită instalare de dependențe:

1. Clonează repository-ul:
   ```bash
   git clone [adaugă aici URL-ul repo-ului]
   cd [numele-repo-ului]
   ```
2. Deschide `index.html` direct în browser, sau rulează un server local simplu, de exemplu:
   ```bash
   npx serve .
   ```
3. Accesează adresa afișată în terminal (de obicei `http://localhost:3000`).

## 🧪 Testare

Testele unitare acoperă logica de conversie, cache/fallback offline, favorite și filtrarea monedelor. Pentru a le rula (dacă e configurat Jest):

```bash
npm install
npm test
```

## 🌐 Despre API

Aplicația folosește endpointul:
```
https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{base}.json
```
pentru cursul curent, și varianta cu dată specifică (`@YYYY-MM-DD` în loc de `@latest`) pentru datele istorice din grafic.

## 📝 Notă

Acest proiect a fost realizat ca exercițiu practic de dezvoltare asistată de AI (GitHub Copilot), parcurgând întregul flux: configurare mediu → prompt engineering → dezvoltare → testare → versionare (branch/commit/push) → deploy.


