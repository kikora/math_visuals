# Phase 2 – Palette service extraction

## Oversikt

Andre steg i palettrefaktoreringen flytter all fargemetadatas til en dedikert pakke, `@math-visuals/palette`. Pakken samler prosjektfallbacks, slot-grupper og hjelpetjenester som tidligere lå spredt i `palette/`. Appene kan nå hente paletter gjennom et konsistent API fremfor å forholde seg til globale hjelpere.

Hovedpunkter:

- `packages/palette/src/index.js` er ny kilde til sannhet for `PROJECT_FALLBACKS`, slot-grupper, graftegner-aksene og `ensure/resolve`-logikken.
- `createPaletteService()` gir et eksplisitt API for å hente paletter basert på gruppe, profil og legacy-id-er.
- `palette/palette-config.js` og `palette/group-palette.js` er beholdt som tynne wrappers som laster pakken og eksponerer de gamle `window.MathVisualsPalette*`-feltene for bakoverkompatibilitet.
- Pakken leverer CommonJS, ESM og global (IIFE) build slik at eksisterende `<script>`-referanser fortsatt virker.
- Enhets-tester i `packages/palette/__tests__/` sikrer fallback- og profilvalg.
- Nye slot-grupper legges til når appene får palettstøtte. Denne fasen inkluderer nå `fortegnsskjema` (akse, hjelpelinjer, positiv/negativ, tekst) og `sortering` (kortbakgrunn, ramme, tekst) slik at innstillingene eksponerer fargene brukerne kan tilpasse.

## Bruk av createPaletteService

```js
import { createPaletteService } from '@math-visuals/palette';

const service = createPaletteService({
  defaultProfile: 'campus',
  profiles: {
    campus: {
      groups: {
        graftegner: ['#111111', '#222222']
      },
      palettes: {
        fractions: ['#DBE3FF', '#2C395B']
      }
    }
  },
  groupFallbacks: {
    graftegner: ['fractions']
  },
  legacyPalettes: {
    figures: ['#B25FE3', '#6C1BA2']
  }
});

const colors = service.resolveGroupPalette({
  groupId: 'graftegner',
  profile: 'campus',
  legacyPaletteId: 'figures',
  count: 4
});
```

### Viktige opsjoner

- `profiles`: Kart over profiler med gruppe- og kategoripaletter (`palettes`), samt egne `fallbacks` for gruppene.
- `groupFallbacks`: Globale fallback-kategorier når en gruppe mangler spesifikk palett.
- `legacyPalettes`: Statisk map eller funksjon som returnerer fargelister for gamle palette-id-er.
- `getPaletteApi` / `getThemeApi`: Tillater tilpassing av hvordan tjenesten snakker med eksisterende helpers.

`PaletteService` eksponerer også `getProjectFallbackPalette` og `getProfilePalette` for apper som trenger direkte tilgang.

## Migrasjonsguide for apper

1. **Importer pakken**: Bytt fra globale `MathVisualsGroupPalette`-kall til eksplisitte imports der det er mulig.
   ```js
   import { createPaletteService } from '@math-visuals/palette';
   const paletteService = createPaletteService();
   ```
2. **Bytt `resolve`-kall**: erstatt `MathVisualsGroupPalette.resolve(opts)` med `paletteService.resolveGroupPalette(opts)`.
3. **Bruk `ensurePalette`**: der apper tidligere kopierte sanitiseringslogikk, kan de nå bruke `ensurePalette(base, fallback, count)` direkte fra pakken.
4. **Profiler og legacy**: send aktiv profil (`profile`) og eventuelle `legacyPaletteId`-er via `resolveGroupPalette` for å få samme fallbackbane som tidligere.
5. **Global kompatibilitet**: Apper som fortsatt lastes via `<script>` uten bundler trenger ingen endring – wrapperne sørger for at `window.MathVisualsPaletteConfig` og `window.MathVisualsGroupPalette` fortsetter å fungere ved å delegere til den nye pakken.

### Tester og bygg

- `npm run build:packages` bygger alle pakkene (inkl. global IIFE) før deployment.
- `npm run test:packages` kjører enhetstestene for pakkene. Dette inkluderer fallback-, profil- og legacy-scenarier.

## Videre arbeid

- Når alle apper er flyttet til å bruke `@math-visuals/palette` direkte, kan wrapperne og synkron opplasting fjernes.
- Utvid `legacyPalettes`-støtten med fargeprofiler fra `theme-profiles.js` når de flyttes til en delt pakke.
- Planlegg en tredje fase hvor tema-/profilsettings bruker samme tjeneste internt i stedet for globale avhengigheter.
