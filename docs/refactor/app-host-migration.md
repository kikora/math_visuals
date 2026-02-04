# App-host refaktorering: Tallinje som pilot

Denne endringen flytter `tallinje`-appen over til den nye `@math-visuals/core`-kontrakten.
Pilotprosessen er dokumentert her slik at øvrige apper kan følge samme mønster.

## Oversikt

- **App-definisjon**: All forretningslogikk ligger nå i `apps/tallinje/app.js` og eksporteres via
  `defineMathVisualApp`. Livssyklus-hookene kapsler initiering, oppdateringer og opprydding.
- **Host-init**: `tallinje.js` oppretter en `createAppHost()`-instans, monterer appen på
  `data-math-visual-app-root="tallinje"`, og speiler host-bus-hendelser til de eksisterende
  `window.mathVisuals`-eventene.
- **HTML-endringer**: `tallinje.html` laster host-skriptet som et ES-modul, eksponerer et eksplisitt
  rot-element og definerer et import-map for `@math-visuals/core`.
- **Testing**: En ny Playwright-test (`tests/tallinje-app-host.spec.js`) verifiserer at hosten kan
  montere appen uten konsollfeil og at `window.mathVisuals.tallinjeHost` er tilgjengelig.

## Migrasjonsoppskrift for andre apper

1. **Flytt IIFE-logikk inn i en app-definisjon**
   - Opprett `apps/<app-id>/app.js` og returner en app via `defineMathVisualApp({ id, title, create })`.
   - Pakk livssyklusene inn i en lokal `setup...`-funksjon og samle opprydding via små hjelpefunksjoner
     (f.eks. `addManagedEventListener`).
2. **Lag et host-skript**
   - La `<app>.js` importere app-definisjonen og `createAppHost`, finne et rot-element og kalle
     `host.mount(app, { target })`.
   - Speil relevante hendelser fra `host.bus` til `window` slik at eksisterende lyttere fungerer i
     overgangsperioden.
3. **Oppdater HTML**
   - Merk rot-elementet med `data-math-visual-app-root="<app-id>"`.
   - Bytt til `<script type="module" src="<app>.js">` og legg til import-map for kjernepakken.
4. **Utvid tester**
   - Legg til en enkel Playwright-test som laster siden, fanger konsollfeil og bekrefter at hosten er
     tilgjengelig via `window.mathVisuals`.

Følg denne sjekklisten for resten av appene for å standardisere host/oppryddings-mekanismene.
