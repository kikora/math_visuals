# Vendor Asset Migration Task Breakdown

This document breaks the monolithic "Servér eksterne biblioteker lokalt i eksempel-sidene" task into a set of smaller, sequential tasks that can be completed (and code-reviewed) independently. Each task keeps the repository in a working state and limits the amount of vendored code that needs to be reviewed at once. The individual task descriptions are provided as `task-stub` blocks so they can be copied directly into Codex without triggering the "Binary files not suported" error.

> **Status update (materialize-vendor pipeline)**
>
> Alle KaTeX-, JSXGraph- og MathLive-ressurser genereres nå lokalt via `npm run materialize-vendor`, som kopierer filene direkte fra `node_modules` til `vendor/cdn/` uten at binære artefakter sjekkes inn i git. Playwright- og `npm start`-kommandoene kjører skriptet automatisk gjennom `pretest`/`prestart`, og `npm run verify-vendor` kan brukes i CI for å sikre at manifestet er synkronisert. Oppgavene under beskriver hvordan migreringen opprinnelig var planlagt før automatiseringen kom på plass, men de kan fortsatt brukes som inspirasjon dersom nye biblioteker skal vendoreres senere.

> **Tips:** `npm run materialize-vendor` kjøres automatisk før `npm test`, `npm run test:e2e` og `npm start` gjennom `pre*`-skript. Dersom `npm run verify-vendor` likevel rapporterer `Out of date`-filer (f.eks. etter `npm install` eller når du bare har kjørt `npm run verify-vendor` direkte), kan du manuelt synkronisere ved å kjøre `npm run materialize-vendor` for å kopiere siste versjon fra `node_modules` før du prøver testen igjen.

## Task 1 – Establish local vendor structure

:::task-stub{title="Task 1 – Etabler vendorkatalog og synk-skript"}
1. Opprett `vendor/` med undermapper `katex/` og `jsxgraph/` (MathLive lastes fra CDN i dagens oppsett).
2. Lag `vendor/README.md` som beskriver versjonskilde, oppdateringsrutine og lisensreferanser.
3. Implementer et skript (f.eks. `scripts/sync-vendor.js`) og npm-kommando `npm run sync-vendor` som kopierer de minifiserte bundlene fra `node_modules` inn i `vendor/`.
4. Oppdater `.gitignore` slik at vendorfiler sjekkes inn, men midlertidige arkiver/utpakkede tarballer ignoreres.
5. Kjør `npm run lint` og `npm test` for å bekrefte at repoet fortsatt er grønt etter strukturendringen.
:::

## Task 2 – Vendoring KaTeX and updating diagram-related pages

:::task-stub{title="Task 2 – Vendore KaTeX for diagramvisninger"}
1. Kjør `npm run sync-vendor` for å fylle `vendor/katex/` med nødvendige `*.min.js`- og `*.min.css`-filer.
2. Oppdater KaTeX-importene i `diagram/index.html`, `diagram.js`, `fortegnsskjema.html` og delte komponenter (f.eks. `description-renderer.js`) til å peke på `/vendor/katex/...`.
3. Sørg for at eventuell dynamisk lastelogikk i `diagram.js` fungerer med de nye banene.
4. Kjør Playwright-scenarier som dekker diagram-/fortegnsskjema-funksjonalitet for å sikre at gjengivelse fungerer uten nettverkstilgang.
:::

## Task 3 – Vendoring MathLive for algebra/interactive examples

:::task-stub{title="Task 3 – Vendore MathLive for interaktive oppgaver"}
1. Synk `vendor/mathlive/` via `npm run materialize-vendor` (kjøres automatisk av `pretest`/`prestart`).
2. Oppdater MathLive-referanser i `prikktilprikk.html`, `tallinje.html`, `graftegner.html`, `brøkfigurer.html`, `tallinje.js` og tilknyttede komponenter til å bruke de vendorede filene.
3. Verifiser hvert delsteg ved å laste sidene lokalt og sikre at MathLive initialiseres uten CDN-kall.
4. Legg til en enkel enhetstest eller Playwright-sjekk som bekrefter at MathLive-editoren starter med lokale assets.
:::

## Task 4 – Vendoring JSXGraph for geometry demos

:::task-stub{title="Task 4 – Vendore JSXGraph for geometri"}
1. Synk `vendor/jsxgraph/` med nødvendige `jsxgraphcore.js`- og `jsxgraph.css`-filer.
2. Oppdater `arealmodell*.html`, `kuler.html`, `trefigurer.html`, `arealmodell0.js`, `kuler.js` osv. til å referere til `vendor/jsxgraph/`.
3. Test geometri-sidene manuelt eller via Playwright for å bekrefte at tavlene rendres og at det ikke gjøres CDN-kall.
:::

## Task 5 – Remove CDN fallbacks and tidy build pipeline

:::task-stub{title="Task 5 – Fjern CDN-fallback og oppdater prosess"}
1. Søk etter kode som fortsatt refererer til CDN-URL-er (inkludert betingede fallbacks) og erstatt/fjern dem.
2. Oppdater `docs/testing.md`, `docs/test-plan.md` eller relevante deploy-notater med instruksjon om `npm run sync-vendor`.
3. Legg til en CI-jobb eller npm-kommando (`npm run verify-vendor`) som sjekker at vendorfiler er synkronisert mot `node_modules`.
4. Gjennomfør en siste Playwright-/røyk-test for å bekrefte at alle sider fungerer uten eksterne forespørsler.
:::

Each task is sized to keep the diff under a few hundred lines, making it feasible to review and merge iteratively while gradually eliminating CDN dependencies.
