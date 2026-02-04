# Sortering (legacy) interaksjonsnotater

## Konfigurasjon
Legacy-versjonen av sorteringskomponenten leser fortsatt `SortingConfig` fra
`old_projects/skafos/sorting.interface.ts`. Oppsettet gjøres vanligvis i
Skafos og serialiseres til JSON, men struktur og standardverdier kommer
direkte fra kildekoden.

### Obligatoriske felt
- **`items`** – et objekt hvor hvert nøkkel-navn brukes som intern ID for
  elementet. Verdiene er `SortableItemInterface`-objekter (samme format som
  andre Eikones-elementer) med et ekstra `value`-felt som brukes til å sjekke
  sorteringsrekkefølgen.【F:old_projects/skafos/sorting.interface.ts†L1-L13】【F:old_projects/skafos/sorting.component.ts†L388-L393】
- **`order`** – en liste over ID-ene i målrekkefølgen. Listen brukes både for
  å plassere elementene initialt og for å generere en tilfeldig startrekkefølge
  når `randomized` er `true`. Hvis listen har kun ett element, beholdes den
  som er.【F:old_projects/skafos/sorting.component.ts†L301-L343】
- **`direction`** – styrer layouten og kan være `'horizontal'` eller
  `'vertical'`. Eldre data lagrer feltet som boolske verdier eller strenger, og
  komponenten konverterer derfor `true`/`'true'` til `'horizontal'` og
  `false`/`'false'` til `'vertical'`.【F:old_projects/skafos/sorting.interface.ts†L6-L10】【F:old_projects/skafos/sorting.component.ts†L319-L327】

### Valgfrie felt
- **`randomized`** – `true` som standard. Når det er aktivert, lages en
  tilfeldig startrekkefølge som sikrer at tallene ikke er sortert ved start.
  Hvis feltet er `false`, brukes rekkefølgen fra `order` direkte.【F:old_projects/skafos/sorting.component.ts†L324-L343】
- **`gap`** – avstand i piksler mellom elementene. Standardverdien er `10`
  hvis feltet utelates. Gjelder både horisontale og vertikale oppsett, og
  påvirker størrelsen som sendes inn til hvert `SortableItem`.【F:old_projects/skafos/sorting.component.ts†L317-L345】

### Eksempelkonfigurasjon
```json
{
  "direction": "horizontal",
  "randomized": false,
  "gap": 12,
  "order": ["item-1", "item-2", "item-3"],
  "items": {
    "item-1": { "type": "text", "text": "3", "value": 3 },
    "item-2": { "type": "text", "text": "5", "value": 5 },
    "item-3": { "type": "text", "text": "9", "value": 9 }
  }
}
```

### Tilgjengelige utganger
Komponenten eksponerer fem strømmer som oppdateres etter hver dra- eller
tastaturhandling. Disse er tilgjengelige via `Sorting.outputs` og brukes av
vesselen til å rapportere status videre.【F:old_projects/skafos/sorting.component.ts†L274-L395】

- `sorted` – `true` når elementene er i stigende rekkefølge etter `value`.
- `firstN` – antall elementer som står riktig fra starten av listen.
- `lastN` – antall elementer som står riktig fra slutten av listen.
- `almost` – `true` når alle elementer utenom ett er på riktig plass.
- `order` – gjeldende rekkefølge representert som en liste med `value`-tall.

## Tilgjengelighet
- Dual-lags-rendering: hvert `SortableItem` oppretter et SVG-element (`svgEl`) og et parallelt DOM-element (`skia`/`button`) for skjermleservennlig interaksjon. Se konstruktøren i `SortableItem` for opprettelsen av `svgEl`, `skia` og `button`, samt `Sorting.skia` som inneholder den semantiske `<ol>`-representasjonen. Relaterte metoder: `Sorting.initialize` og `SortableItem.placeBefore` for synkronisering av lagene.
- Fokusstyring: `registerListeners` legger til focus/blur-lyttarar på `button` for å sette klassen `focus` og spore `current`. `handleEscape` nullstiller tilstand og fjerner tastelyttarar fra alle element.
- Mål-tilstand: `button`-klikk aktiverer `EikonesItem` via `eikones.activate()` og gjør andre element til mål (`eikones.makeTarget()`), og `handleEscape` fjerner målstatus.

## Tastaturnavigasjon
- `registerListeners` knytter en `keydown`-lytter (`keyHandler`) til dokumentet når et element er aktivt, slik at piltaster bytter elementposisjon via `swapWith`. Enter tvinger `handleEscape` for å avslutte målmodus. Escape på dokumentnivå avbryter moduset for alle elementer.
- Piltastenes retning mapes i `keyHandler` til `swapWith(-1|1, true, true)` for å flytte elementet ett trinn og samtidig snappe både seg selv og naboelementet tilbake til rasteret.

## Drag-oppførsel
- `registerListeners` initialiserer `svgEl.draggable()` og `eikones.draggable()`. `beforedrag` blokkerer parallell draing ved hjelp av den globale telleren `window.dragCount`.
- Under `dragstart` aktiveres elementet (`eikones.activate()`) og en `dragmove`-lytter registreres via `produceSwapEventHandler`, som dynamisk beregner bytteboksen basert på `calculateSwapBox`.
- `dragend` deaktiverer elementet, kaller `snapInPlace` for å animere tilbake til rasteret og `vessel.emitOutputs()` for å oppdatere tilstandsstrømmer.

## Statusberegning
- `produceSwapEventHandler` kontrollerer posisjonen til elementets sentrum mot en utvidet kollisjonsboks og kaller `move(Direction.*)` for å trigge `swapWith` når et element krysser terskelen.
- `swapWith` bytter elementer i `Sorting.items`, holder begge lag synkronisert gjennom `swapItems` (DOM) og valgfri snapping (`snapInPlace`).
- `Sorting.emitOutputs` evaluerer datastrømmer (`sorted`, `firstN`, `lastN`, `almost`, `order`) basert på nåværende rekkefølge, ved hjelp av hjelpefunksjonene `firstN`, `lastN`, `sortedPairs` og `almost`.
- `snapInPlace` bruker `calculateSnapCenter` og `svg.js`-animasjon for å sikre visuell alignering etter tastatur- eller draoperasjoner.

## Relaterte API-er
- `registerListeners`, `produceSwapEventHandler`, `swapWith`, `snapInPlace`, `calculateSwapBox`, `calculateSnapCenter`, `Sorting.emitOutputs`, `Sorting.initialize` i `old_projects/skafos/sorting.component.ts`.
