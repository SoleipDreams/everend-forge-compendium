# Forge reader and publication workspace

Compendium owns its standalone visual implementation. `.forge-compendium` scopes
the semantic `--ef-*` contract, legacy palette aliases and component styles;
embedded theme changes do not rewrite another app's document theme. Interface
text uses the Forge sans stack, while configured reading fonts remain available
for authored content.

Mounted hidden sessions suspend their global Escape handlers and native menu
actions. Keyboard handlers read the current activity state and resume when the
app becomes visible; standalone sessions retain their normal shortcuts.

Settings, corrections and feedback own initial focus, Tab/Shift+Tab containment,
Escape and return to their opening control. Hidden or inactive dialogs release
keyboard/focus ownership without dropping their drafts. Corrections cannot close
while a save is running.

Reading navigation keeps Universe, Stories, Graphs and search together. Publication
has a dedicated workspace for profiles, selection, diagnostics and preview. Its
export action continues to copy the existing ZIP command. Direct desktop ZIP
generation is not introduced by this redesign.

Publication and universe-profile editors remain mounted when hidden. Their guards
retain manual input and block a universe change until the user explicitly saves
or resolves it. Pending profile/correction writes disable conflicting actions;
failed saves restore controls and keep the draft. Appearance writes use a drained
debounced queue before the app allows a universe change. `SuiteChrome` exposes
these optional hooks without a dependency on private Suite code.

The static site shares the visual hierarchy and obtains its theme from published
configuration. Primary navigation remains available on narrow screens, and Home's
category cards link to actual directory sections. Routes, search, images, canonical
Markdown/YAML and publication configuration retain their existing contracts.

Verification on 2026-10-08: `npm run build` (including typecheck), all 40 tests
in eight files,
and a nine-route fixture ZIP passed. The unpacked static site was checked with
Playwright/system Edge at 1440, 900 and 390 px. Native reader checks were performed
in Suite's real WebView2 at 1440×900, 1280×720, 1100×720 and 900×700, including hidden
publication drafts and blocked universe changes/close/reload. Local evidence is
under ignored `output/playwright/`; Suite's `docs/UI_REDESIGN_ACCEPTANCE.md` records
the cross-app checks and remaining manual acceptance.
