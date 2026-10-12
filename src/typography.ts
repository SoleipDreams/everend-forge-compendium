export const PRIMARY_FONT_OPTIONS = [
  {
    id: "sans",
    label: "Sans serif",
    cssValue:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "serif",
    label: "Serif editorial",
    cssValue: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "humanist",
    label: "Humanist",
    cssValue: '"Avenir Next", Avenir, "Segoe UI", sans-serif',
  },
] as const;

export type PrimaryFontId = (typeof PRIMARY_FONT_OPTIONS)[number]["id"];

export function normalizePrimaryFont(value: unknown): PrimaryFontId {
  return PRIMARY_FONT_OPTIONS.some((option) => option.id === value)
    ? (value as PrimaryFontId)
    : "sans";
}

export function primaryFontCssValue(font: PrimaryFontId) {
  return PRIMARY_FONT_OPTIONS.find((option) => option.id === font)!.cssValue;
}
