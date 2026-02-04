# Math Visuals

Math Visuals er en samling interaktive matematiske visualiseringer og verktøy for undervisning. Repositoriet består primært av statiske HTML/JS/CSS-apper i rotmappen, delte UI-komponenter og hjelpebiblioteker, samt en liten serverless backend for lagring av eksempler, SVG-er og figurbibliotek.

## Innhold og struktur

**App-entrypoints i rotmappen**

* `index.html` – startside med navigasjon til appene.
* `graftegner.html`, `brøkfigurer.html`, `bibliotek.html`, `settings.html` – egne innganger for sentrale verktøy.
* `task-mode.html` – en «preview»-modus som rendrer valgt app/eksempel uten editor-UI.

**App-ressurser og data**

Appene består av JS/CSS-filer i rotmappen (for eksempel `graftegner.js`, `brøkfigurer.js`) og suppleres av mapper som `graftegner/`, `figurtall/`, `diagram/`, `arealmodell0/`, `arealmodellen1/`, `kuler/`, `kvikkbilder/`, `nkant/`, `perlesnor/` og `tenkeblokker/`, som inneholder eksempeldata, lagringsskjemaer og appspesifikk støtte.

**Delte komponenter**

Felles logikk ligger i filer som `router.js` (routing og eksempelhåndtering), `examples.js`, `description-renderer.js`, `task-mode.js` og `task-text.js`. UI- og temaarbeid er samlet i `ui/`, `theme/`, `theme-profiles.js`, `base.css`, `split.css` og `split.js`, mens `palette/` og `packages/palette` dekker farge- og palettlogikk.

## Serverless API

`api/` inneholder Node-baserte handler-filer for en enkel backend som brukes av appene:

* `api/examples` – lagring/henting av elevprodukter, med støtte for «trash».
* `api/figure-library` – delte figurer som gjenbrukes på tvers av apper.
* `api/svg` og `api/settings` – hjelpeendepunkter for SVG-lagring og innstillinger.

API-et bruker Redis via `ioredis` når miljøvariablene for backend er satt, men faller tilbake til en minnebasert lagring når det kjøres lokalt uten konfigurasjon. Se `docs/examples-storage.md` og `docs/figure-library-storage.md` for detaljer om lagring og miljøvariabler.

## Delte pakker

`packages/` inneholder gjenbrukbare moduler (`core`, `figures`, `palette`) som bygges med Rollup. Byggutdata legges i `packages/*/dist`, og `scripts/create-public.js` samler statiske filer til `public/` for distribusjon.

## Lokal utvikling

1. Installer avhengigheter:
   ```bash
   npm install
   ```
2. Start en lokal statisk server:
   ```bash
   npm run start
   ```
3. Bygg alt til `public/`:
   ```bash
   npm run build
   ```

`npm run build` materialiserer også `vendor/` fra `scripts/vendor-manifest.json` via `scripts/materialize-vendor.mjs`.

## Testing

* Kjør hele testsuiten:
  ```bash
  npm test
  ```
* Kjør kun Playwright-testene:
  ```bash
  node scripts/run-playwright.js test
  ```

Mer informasjon om testing ligger i `docs/testing.md`.

## Infrastruktur og drift

`infra/` inneholder CloudFormation-maler og støttefiler for AWS-oppsett (API Gateway/Lambda og statisk hosting). Scriptet `scripts/package-api-lambda.sh` pakker Lambda-koden, og dokumentasjon for deploy ligger i `docs/github-actions-setup.md` og `docs/manual-static-deploy.md`.

## Dokumentasjon

* `docs/examples-storage.md` – lagring av eksempler.
* `docs/figure-library-storage.md` – figurbibliotekets lagring.
* `docs/shared-packages.md` – oversikt over delte pakker.
* `docs/testing.md` – testoppsett og rutiner.
