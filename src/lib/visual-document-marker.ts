import YAML from "yaml";
/** Reader compatibility only. Diagram content remains owned by WorldNotion. */
export function isVisualDocument(source: string): boolean {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!/^---[ \t]*\n/.test(normalized)) return false;
  const header = normalized.split(/^---[ \t]*$/m)[1] || "";
  // Preserve classification when an unfinished YAML edit cannot be parsed.
  if (/^(?:forgeView|"forgeView"|'forgeView')\s*:/m.test(header)) return true;
  try {
    const data = YAML.parse(header);
    return Boolean(
      data && typeof data === "object" && Object.hasOwn(data, "forgeView"),
    );
  } catch {
    return false;
  }
}
