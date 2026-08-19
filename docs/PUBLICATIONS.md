# Compendium publication profiles

Compendium indexes a vault once and then projects it through a publication mode:

- `All` shows every valid entity and story for local inspection.
- `Preview` shows exactly what the active profile would export.

Export commands always use `Preview`.

## Files

The preferred settings file is `.everend/.compendium/settings.json`. A vault that only has `.everend/compendium.yaml` continues to work as a legacy configuration; Compendium does not migrate or remove that file automatically.

Profiles are stored in `.everend/.compendium/publications/<profile-id>.json`:

```json
{
  "profileVersion": 1,
  "id": "public-demo",
  "name": "Public Demo",
  "rules": { "statuses": ["canon"] },
  "selection": {
    "entityIds": { "include": [], "exclude": [] },
    "storyIds": { "include": [], "exclude": [] },
    "sequenceIds": { "include": [], "exclude": [] },
    "eventIds": { "include": [], "exclude": [] }
  },
  "dependencyPolicy": "include-marked"
}
```

Status matches and manual includes are unioned. Manual exclusions always win. References from included entities and story events pull in their dependencies recursively, even when their status is not allowed, unless explicitly excluded. These dependencies are marked in the manager and in `publication-manifest.json`.

Selecting a story includes its sequences and events. Selecting a sequence includes its events. Selecting an event preserves the minimum story and sequence structure needed to publish that event.

## CLI

```sh
everend-compendium dev <vault> --mode=preview --profile=<id>
everend-compendium dev <vault> --mode=all
everend-compendium preview <vault> --profile=<id>
everend-compendium build <vault> --profile=<id> --out=<directory>
everend-compendium package <vault> --profile=<id> --out=<file.zip>
```

`build` creates a static folder. `package` creates a ZIP containing the same folder, its `publication-manifest.json`, and only referenced assets. `baseUrl` is honored for root and subpath hosting.
