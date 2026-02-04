# Phase 0 inventory

## App integration matrix
| App | Global binding lifecycle | Palette / colors | Alt-text handling | Export options |
| --- | --- | --- | --- | --- |
| Brøkpizza | Initializes a shared `SIMPLE` object and exposes it on `window`, then reuses it when theme or task integrations call `applyConfig`/`render`.【F:brøkpizza.js†L4-L28】【F:brøkpizza.js†L2323-L2353】 | Resolves fraction palettes through MathVisuals palette APIs, theme fallbacks, and legacy colors before drawing pizzas.【F:brøkpizza.js†L285-L375】 | Wraps the export card in the shared alt-text manager, persisting text on `SIMPLE` and wiring live announcements for the rendered grid.【F:brøkpizza.js†L2056-L2099】 | Provides single-figure SVG, interactive SVG, PNG, and bulk downloads, delegating to MathVisSvgExport when available.【F:brøkpizza.js†L1486-L1559】【F:brøkpizza.js†L1709-L1908】 |
| Tenkeblokker | Builds a mutable `CONFIG` object, assigns it to `window.CONFIG`, and exposes `draw` for external triggers after normalizing the grid.【F:tenkeblokker.js†L590-L603】【F:tenkeblokker.js†L1269-L1283】 | Resolves the `fractions` palette via group helper/settings/theme fallbacks with per-project overrides before painting blocks and braces.【F:tenkeblokker.js†L300-L333】 | Hosts the shared alt-text manager on the export card, storing text in `CONFIG` and pushing updates to the main SVG figure.【F:tenkeblokker.js†L1144-L1188】 | Supports SVG/PNG exports from a synthesized layout SVG with metadata and button hooks tied into MathVisSvgExport helpers.【F:tenkeblokker.js†L3060-L3159】【F:tenkeblokker.js†L1269-L1275】 |
| Diagram | Uses a module-level `CFG` object (no global assignment) that drives inputs and rendering while reacting to `window.mathVisuals` mode changes.【F:diagram.js†L4-L406】 | Applies series, pie, and UI colors from theme APIs with fallbacks to legacy constants whenever settings or profile events fire.【F:diagram.js†L264-L302】【F:diagram.js†L374-L393】 | Syncs manual edits with `CFG`, schedules auto-generation with abort handling, and falls back to heuristic descriptions on failure.【F:diagram.js†L490-L520】【F:diagram.js†L1914-L1974】 | Binds export buttons to SVG/PNG helpers and enriches files with metadata and sanitized SVG clones via MathVisSvgExport.【F:diagram.js†L395-L398】【F:diagram.js†L2687-L2759】 |
| Figurtall | Bootstraps `STATE` from `window.STATE`, exposes it globally, and reuses `render` for theme/app-mode listeners.【F:figurtall.js†L25-L99】【F:figurtall.js†L1920-L1944】 | Pulls palettes for the `figurtall` group (or legacy colors) through MathVisuals helpers to seed cell colors and respect manual overrides.【F:figurtall.js†L25-L96】 | Initializes the shared alt-text manager against the export anchor, keeping text/state on `STATE` and tagging the figure container for screen readers.【F:figurtall.js†L1682-L1729】 | Generates export-only SVGs, uses common PNG scaling logic, and hooks buttons to those routines with MathVisSvgExport metadata.【F:figurtall.js†L1085-L1159】【F:figurtall.js†L1871-L1877】 |

## Global data-flow snapshot
```mermaid
graph TD
  subgraph Brøkpizza (kompleks)
    htmlB[HTML defaults & saved JSON] --> simpleInit[SIMPLE built]
    simpleInit --> winSimple[window.SIMPLE]
    winSimple --> bpRender[applyExamplesConfig/render]
    winSimple --> bpAlt[Alt-text manager]
    winSimple --> bpExport[SVG/PNG export]
  end
  subgraph Tenkeblokker (kompleks)
    htmlT[Form defaults & buttons] --> cfgInit[CONFIG baseline]
    cfgInit --> winConfig[window.CONFIG]
    winConfig --> tbDraw[draw()/rebuildStructure]
    winConfig --> tbAlt[Alt-text manager]
    winConfig --> tbExport[SVG/PNG export]
  end
  subgraph Figurtall (enklere)
    htmlF[Input defaults] --> stateInit[STATE bootstrap]
    stateInit --> winState[window.STATE]
    winState --> ftRender[render()/layout]
    winState --> ftAlt[Alt-text manager]
    winState --> ftExport[SVG/PNG export]
  end
  bpRender -.-> tbDraw
  tbDraw -.-> ftRender
```

## Shared modules and duplication hotspots
- **Palette helpers (`palette/`)** – `group-palette.js` exposes `MathVisualsGroupPalette` to resolve palettes via theme/settings fallbacks, while `palette-config.js` defines per-project defaults and slot metadata (e.g., `fractions`, `diagram`, `figurtall`).【F:palette/group-palette.js†L1-L105】【F:palette/palette-config.js†L1-L100】 These modules back every palette-aware app in the table.
- **Figure catalog (`figure-library/measurement.js`)** – Supplies rich measurement metadata, derived image paths, and optional real-world size extraction for measurement figures, making it a candidate for centralized content reuse.【F:figure-library/measurement.js†L1-L120】
- **Alt-text UI (`alt-text-ui.js`)** – Provides shared DOM scaffolding, textarea/status wiring, and SVG `<title>/<desc>` enforcement for apps that integrate the `MathVisAltText` service.【F:alt-text-ui.js†L1-L84】 Each inventoried app mounts this manager with app-specific state adapters.
- **SVG export helper (`svg-export-helper.js`)** – Normalizes filenames, PNG minimum sizes, archive exports, and toast notifications used by the various export flows.【F:svg-export-helper.js†L1-L120】 Harmonizing app-level exporters around this helper will reduce duplication.

### Concrete duplication examples
- **`resolveDragHandleIcon`** is implemented verbatim (including URL fallbacks) across Brøkpizza, Tenkeblokker, and Diagram.【F:brøkpizza.js†L29-L49】【F:tenkeblokker.js†L31-L51】【F:diagram.js†L36-L52】 Centralizing it would remove three copies.
- **PNG export logic** repeats the same `ensureMinimumPngDimensions`/canvas workflow in Diagram, Tenkeblokker, and Figurtall exporters.【F:diagram.js†L2737-L2759】【F:tenkeblokker.js†L3108-L3159】【F:figurtall.js†L1112-L1160】 Extracting a shared wrapper would simplify maintenance.

## Pilot recommendation
Start the refactor pilot with **Brøkpizza** and **Tenkeblokker**. Both expose rich globals (`SIMPLE`/`CONFIG`), rely on identical drag-handle and export code paths, and already integrate palette + alt-text infrastructure, so improving their shared seams will immediately benefit other complex apps.【F:brøkpizza.js†L4-L375】【F:tenkeblokker.js†L300-L1283】 Figurtall and Diagram can follow once the shared abstractions are stabilized.
