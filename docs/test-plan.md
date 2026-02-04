# Forslag til automatiserte test-rutiner

Dette dokumentet skisserer flere nivåer av automatisert testing som kan hjelpe til med å sikre kvaliteten på de interaktive mattevisualiseringene i prosjektet.

## 1. Statisk analyse

1. **Linting av JavaScript**
   - Verktøy: ESLint med en regelsett som passer for moderne nettlesere (f.eks. `eslint:recommended` kombinert med `plugin:import/recommended`).
   - Innhold: Sjekk for ubrukte variabler, potensielle scope-feil og konsistente importstier.
   - Integrasjon: Legg til en `npm run lint`-kommando og kjør den i CI.

2. **Formatkontroll**
   - Verktøy: Prettier for HTML, CSS og JavaScript.
   - Innhold: Sikrer konsistent formattering og gjør git-diff enklere å lese.
   - Integrasjon: Kjør `npm run format:check` i CI; tilby en `format`-kommando lokalt.

3. **Felles stylingkonvensjoner**
   - Verktøy: Node-skriptet `tests/check-shared-styles.js`.
   - Innhold: Verifiserer at visualiseringenes HTML-filer inkluderer viewport-metaen, lenken til `base.css` og de forventede `.wrap`/`.grid`-layoutbeholderne.
   - Integrasjon: Kjøres automatisk via `npm test` både lokalt og i CI.

## 2. Enhetstester

1. **Funksjonelle moduler**
   - Verktøy: Vitest eller Jest (Vitest er raskt og fungerer godt med ESM/DOM-simulering via jsdom).
   - Testmål: Rene hjelpefunksjoner som beregner koordinater, transformasjoner og matematiske operasjoner.
   - Eksempel: Sikre at beregning av polygon-arealer i `nkant.js` returnerer riktige verdier for ulike inndata.

2. **DOM-manipulasjon**
   - Verktøy: Testing Library (`@testing-library/dom`) sammen med Vitest/Jest.
   - Testmål: Verifisere at viktige DOM-elementer opprettes, oppdateres og fjernes som forventet når brukeren interagerer med komponenter.
   - Eksempel: Test at "trefigurer"-visualiseringen oppretter riktig antall SVG-elementer når inngangsparametere endres.

## 3. Integrasjonstester

1. **Samspill mellom komponenter**
   - Verktøy: Playwright eller Cypress i "component"-modus.
   - Testmål: Valider at kontroller, skjemaer og grafiske elementer fungerer sammen i en headless-nettleser.
   - Eksempel: I "fortegnsskjema" sjekke at når eleven endrer verdier i input-feltene, oppdateres tabellen og grafen konsekvent.

2. **Dataflyt mot API**
   - Verktøy: Mock Service Worker (MSW) eller Playwright med nettverksintersepsjon.
   - Testmål: Simulere kall mot `api/`-endepunkter og verifisere at UI reagerer korrekt på suksess, tomme svar og feil.

## 4. Ende-til-ende-tester (E2E)

1. **Brukerscenarioer**
   - Verktøy: Playwright eller Cypress i full nettlesermodus.
   - Testmål: Dekke kritiske elev/scenario-flyt, f.eks. "juster en parameter og se visualiseringen oppdatere seg".
   - Eksempel: I "kvikkbilder"-appene bekrefte at tastatursnarveier og museinteraksjoner gir forventet respons.

2. **Tilgjengelighetstesting**
   - Verktøy: `axe-core` integrert i Playwright eller Cypress.
   - Testmål: Fange WCAG-problemer (f.eks. manglende aria-attributter) og sikre god tilgjengelighet.

## 5. Visuelle regresjonstester

- Verktøy: Playwright med `@playwright/test` sitt skjermbildesammenligningsverktøy eller Loki.
- Testmål: Oppdag utilsiktede endringer i grafikk ved å sammenligne nye skjermbilder mot godkjente referanser.
- Eksempel: Overvåk at layout og farger i "brøkvegg"-visualiseringen ikke endres uten bevisst designbeslutning.

## 6. Kontinuerlig integrasjon

- Plattform: GitHub Actions eller annen CI.
- Oppsett: Konfigurer jobber for linting, enhetstester, integrasjonstester og valgfritt visuelle tester.
- Cache: Bruk `actions/setup-node` med caching av `node_modules` for raskere bygg.
- Artefakter: Lagre skjermbilder fra mislykkede Playwright-/Cypress-kjøringer for enkel feilsøking.

## 7. Lokal utvikleropplevelse

- **Pre-commit-hooks**: Bruk Husky + lint-staged for å kjøre formattering/lint på endrede filer.
- **Testdata**: Opprett små json-fixtures for vanlige scenarier slik at tester blir deterministiske.
- **Dokumentasjon**: Legg til en "Testing"-seksjon i README med kommandoer og tips.

## 8. Prioritering for oppstart

1. Sett opp linting og formattering.
2. Identifiser 2-3 kritiske funksjoner og dekk dem med enhetstester.
3. Legg til minst én Playwright E2E-test for et sentralt scenario.
4. Etabler CI-workflow som kjører stegene over ved hver pull request.

Med disse forslagene kan teamet bygge opp et testregime gradvis, samtidig som de får rask tilbakemelding på potensielle feil i visualiseringene.
