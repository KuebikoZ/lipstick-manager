export function buildDisplayName(identity: {
  brand?: string | null;
  series?: string | null;
  shade_code?: string | null;
}): string {
  const parts = [identity.brand, identity.series, identity.shade_code]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.join("-") || "信息待补充";
}
