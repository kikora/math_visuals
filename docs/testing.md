# Kjøre tester i Codex-miljøet

Dette prosjektet har allerede en testpakke konfigurert gjennom npm-skriptet `npm test`. Skriptet kjører først et tilpasset stil-sjekkverktøy og deretter Playwright sine ende-til-ende-tester.

## Forberedelser
1. Installer avhengigheter:
   ```bash
   npm install
   ```

2. (Valgfritt) Sørg for at du har bygget eventuelle statiske ressurser som testene forventer. De fleste testene i dette repoet bruker de rå HTML/JS-filene og trenger ikke en eksplisitt build.

## Kjøre testene
Kjør følgende kommando fra rotmappen til prosjektet:

```bash
npm test
```

Dette vil:
1. Kjør `node tests/check-shared-styles.js` for å kontrollere at delte stiler er konsistente.
2. Kjør `playwright test` for å starte Playwright-testene definert i `tests/`-mappen.

> **Tips:** Dersom Playwright ikke er installert i miljøet ennå, vil `npm install`-steget ovenfor ta seg av det.

## Feilsøking
- **Manglende nettleserbinærer:** Playwright kan be deg kjøre `npx playwright install` første gang. Det kan du trygt gjøre i Codex før du lager PR.
- **«Host system is missing dependencies»-feil:** Dersom nettleserstart feiler med denne meldingen må nødvendige systempakker installeres. `npm test` forsøker automatisk å kjøre `npx playwright install-deps` når skriptet kjøres som root (via `scripts/ensure-playwright-deps.js`), men i miljøer uten root-tilgang må kommandoen kjøres manuelt med tilstrekkelige rettigheter.
- **Treg testoppstart:** Playwright starter en lokal HTTP-server under `npm test`. I Codex skjer dette automatisk via testene.

Med dette oppsettet kan du trygt kjøre hele testpakken i Codex før du lager en PR til GitHub.

## Kjøre enkeltstående scenarier

For å verifisere nye testscenarier isolert kan du be Playwright om å kjøre enkelttester direkte:

- Minnelagringslogikk for eksempellageret: `npx playwright test tests/examples-store.spec.js`
- Viewer-siden i minnemodus (bruker backend-mocken i «memory»): `npx playwright test tests/examples-viewer.spec.js`
- Fjernoppdateringer i figurbiblioteket uten lokale fallbacks: `npx playwright test tests/figure-library-backend-sync.spec.js`

Alle kommandoene starter samme lokale testserver som `npm test`, men hopper over øvrige tester slik at det går raskere å iterere.

## Enhetstester for seeding-skriptet

Seeding-scriptet for figurbiblioteket har en egen tørrkjøringstest som bekrefter hvilke payloads som sendes til lagringslaget. Kjør testen alene med:

```bash
node tests/unit/seed-figure-library.test.mjs
```

Testen mocker `ensureCategory` og `setFigure`, så ingen eksterne tjenester berøres. I CI kjøres den automatisk som en del av `npm test`-kjeden før Playwright-suitene.
