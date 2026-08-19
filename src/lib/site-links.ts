function configuredBasePath(baseUrl?: string) {
  if (!baseUrl) return "";
  try {
    const pathname = new URL(baseUrl).pathname;
    return pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return baseUrl.replace(/^\/+|\/+$/g, "");
  }
}

export function sitePath(route: string, baseUrl?: string) {
  if (/^(?:[a-z]+:)?\/\//i.test(route)) return route;
  const base = configuredBasePath(baseUrl);
  const normalized = route.startsWith("/") ? route : `/${route}`;
  return base ? `/${base}${normalized}` : normalized;
}

export function siteAssetPath(asset: string, baseUrl?: string) {
  return sitePath(`/assets/${asset.replace(/^\/+/, "")}`, baseUrl);
}
