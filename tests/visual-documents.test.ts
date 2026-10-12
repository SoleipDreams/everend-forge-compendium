import { describe, expect, it } from "vitest";
import { discoverEntityStatuses, indexEntities } from "../src/lib/vault.js";
import { isVisualDocument } from "../src/lib/visual-document-marker.js";
import { sanitizeNode } from "../src/lib/node/render.js";
describe("WorldNotion visual document reader compatibility", () => {
  it("excludes current, future and incomplete diagrams from canon without changing source files", () => {
    const files = [
      {
        relativePath: "timeline.md",
        content:
          "---\nid: tree\nname: Timeline\nforgeView:\n  version: 1\n  kind: timeline\n---\nNotes",
      },
      {
        relativePath: "future.md",
        content:
          "---\nforgeView:\n  version: 40\n  kind: new-tool\n---\nDescription",
      },
      {
        relativePath: "unfinished.md",
        content: "---\nforgeView:\n  nodes: [\n---\nNotes",
      },
      {
        relativePath: "quoted.md",
        content: '---\n"forgeView": [unfinished\n---\nNotes',
      },
      {
        relativePath: "A.md",
        content: "---\nid: a\nname: A\ntype: character\nstatus: canon\n---\n",
      },
    ];
    const before = JSON.stringify(files),
      warnings: string[] = [];
    expect(
      indexEntities(files, warnings, sanitizeNode).map((entity) => entity.id),
    ).toEqual(["a"]);
    expect(discoverEntityStatuses(files)).toEqual(["canon"]);
    expect(warnings).toEqual([]);
    expect(JSON.stringify(files)).toBe(before);
  });
  it("does not classify body examples or nested entity properties as diagrams", () => {
    expect(isVisualDocument("# forgeView:\n")).toBe(false);
    expect(
      isVisualDocument("---\nid: a\nproperties:\n  forgeView: example\n---\n"),
    ).toBe(false);
    expect(isVisualDocument("---\nid: a\n---\nforgeView:\n")).toBe(false);
  });
});
