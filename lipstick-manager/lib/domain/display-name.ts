export function buildDisplayName(identity: {
  brand?: string | null;
  series?: string | null;
  shade_code?: string | null;
}): string {
  const parts = [identity.brand, normalizeSeries(identity.brand, identity.series), identity.shade_code]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.join("-") || "信息待补充";
}

export function normalizeSeries(brand?: string | null, series?: string | null): string | null {
  const normalizedBrand = brand?.trim() ?? "";
  let normalizedSeries = series?.trim() ?? "";
  if (normalizedBrand && normalizedSeries) {
    const escapedBrand = normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalizedSeries = normalizedSeries.replace(new RegExp(`^${escapedBrand}(?:\\s*[-–—·:]?\\s*)`, "i"), "").trim();
  }
  return normalizedSeries.slice(0, 50) || null;
}
