# Lagringsformat for eksempler (v2)

Dette dokumentet beskriver den nye v2-strukturen for eksport og import av eksempeldata. Målet er å gjøre formatet selvforklarende, beholde kompatibilitet med eksisterende saniteringslogikk og sikre at klientene kan regenerere avledet state når de leser lagrede poster.

## Eksempel på v2 JSON

```json
{
  "version": 2,
  "storage": "kv",
  "entries": [
    {
      "path": "/diagram",
      "updatedAt": "2025-02-12T12:00:00.000Z",
      "deletedProvided": ["legacy-demo"],
      "examples": [
        {
          "description": "Søylediagram med dynamiske akser",
          "exampleNumber": "1",
          "config": {
            "STATE": {
              "axes": {
                "__mathVisualsType__": "map",
                "__mathVisualsValue__": [
                  ["x", { "min": 0, "max": 12 }],
                  ["y", { "min": 0, "max": 20 }]
                ]
              },
              "ticks": {
                "__mathVisualsType__": "set",
                "__mathVisualsValue__": [2, 4, 6, 8, 10]
              },
              "lastEdited": {
                "__mathVisualsType__": "date",
                "__mathVisualsValue__": "2025-02-12T11:58:19.201Z"
              }
            }
          }
        }
      ]
    }
  ],
  "trash": [
    {
      "id": "z1abc-123",
      "sourcePath": "/diagram",
      "deletedAt": "2025-02-12T12:05:00.000Z",
      "example": {
        "description": "Forkastet kladd",
        "config": {
          "STATE": {
            "filter": {
              "__mathVisualsType__": "regexp",
              "pattern": "^demo-",
              "flags": "i"
            }
          }
        }
      }
    }
  ]
}
```

## Felt i formatet

* `version` markerer skjemaet og settes til `2` for nye eksporter. Tidligere eksporter manglet feltet og kan tolkes som v1.
* `entries` er en liste over lagrede stier. Hver post inneholder `path`, `examples`, valgfri `deletedProvided` og `updatedAt`, slik de saniteres og tidsstemples i back-end før skriving.【F:api/_lib/examples-store.js†L382-L391】
* `trash` speiler `examples/__trash__`-nøkkelen og bruker samme serialisering for eksemplene, inkludert metadata om kilden og slettetidspunkt.【F:api/_lib/examples-store.js†L326-L354】
* `storage` kan brukes i eksporten for å signalisere lagringsmodus (`kv` eller `memory`). Feltet gjenskapes fra `mode`/`storage` i API-responsene slik at importerte dumpene dokumenterer om dataene ble lagret varig eller midlertidig.【F:api/_lib/examples-store.js†L177-L186】

## Regenerering av avledet state

Map-, Set-, Date- og RegExp-verdier serialiseres med markører (`__mathVisualsType__` og `__mathVisualsValue__`) slik at de kan sendes som JSON, men samtidig rekonstrueres til sanne objekter når de lastes. Back-end bruker markørene når data skrives, og klientene kan hydrere dem tilbake med `deserializeExampleValue` når de åpner eksporten eller henter data fra API-et.【F:api/_lib/examples-store.js†L20-L161】【F:examples.js†L5000-L5059】

## Versjonering og migrering

* V2 behandles som det kanoniske eksportformatet fremover. Manglende `version` tolkes som v1 og kan skrives ut på nytt som v2 ved neste lagring (ingen felt kastes bort fordi uforutsette egenskaper ignoreres av saniteringslagene).
* Migrationer bør implementeres som rene transformasjoner: les inn JSON, sjekk `version`, og oppgrader strukturen før `setEntry`/`setTrashEntries` kalles. Markørfeltene trenger ikke spesialhåndtering fordi `serializeExampleValue`/`deserializeExampleValue` tar vare på dem.【F:api/_lib/examples-store.js†L23-L161】
* `version`-feltet reserveres for fremtidige brytende endringer (f.eks. nye felt i `trash` eller alternative serialiseringsnøkler). Klienter skal derfor bevare feltet urørt gjennom roundtrips slik at videre migreringer kan oppdage hvilket skjema de starter fra.
