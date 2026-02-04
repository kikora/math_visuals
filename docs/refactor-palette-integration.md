# Refactor palette integration and add settings listeners

## Summary

This pull request rebuilds the palette migration work after a merge conflict. The previous branch refactor is re-applied with clearer documentation and automatic refresh hooks so the UI always stays in sync with palette updates.

## Key changes

- **Palette migration checklist.** Document every file that still needs to be ported to the new palette API so we can track progress through the migration.
- **Updated helpers and apps.** Switch the palette lookups in affected apps and shared helpers to the new `getGroupPalette` options signature, including `project` scoping.
- **Live settings listeners.** Listen for palette changes emitted from settings and refresh the visuals immediately so color changes are reflected without a reload.

## Testing

- Manually verified that apps using the new helpers refresh their colors when settings are updated.
- Spot-checked legacy views to confirm they fall back to the expected project palette when no overrides are present.
