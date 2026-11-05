import { z } from "zod";

export const colorFamilies = ["nude", "rose", "orange", "red", "plum", "brown"] as const;
export const lifecycles = ["unopened", "opened", "unknown", "discarded"] as const;
export const openingPrecisions = ["exact", "unknown"] as const;
export const expirySources = ["explicit", "calculated"] as const;
export const textures = ["哑光", "丝绒", "缎光", "水光", "镜面", "其他"] as const;

export const colorFamilySchema = z.enum(colorFamilies);
export const lifecycleSchema = z.enum(lifecycles);
export const openingPrecisionSchema = z.enum(openingPrecisions);
export const expirySourceSchema = z.enum(expirySources);
export const textureSchema = z.enum(textures);

export type ColorFamily = z.infer<typeof colorFamilySchema>;
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export type OpeningPrecision = z.infer<typeof openingPrecisionSchema>;
export type ExpirySource = z.infer<typeof expirySourceSchema>;
export type Texture = z.infer<typeof textureSchema>;

export const currentInventoryLifecycles = ["unopened", "opened", "unknown"] as const;

export function isCurrentInventory(lifecycle: Lifecycle): boolean {
  return lifecycle !== "discarded";
}

const lifecycleTransitions: Record<Lifecycle, readonly Lifecycle[]> = {
  unknown: ["unopened", "opened", "discarded"],
  unopened: ["opened", "unknown", "discarded"],
  opened: ["unopened", "unknown", "discarded"],
  discarded: [],
};

export function canTransitionLifecycle(from: Lifecycle, to: Lifecycle): boolean {
  return from === to || lifecycleTransitions[from].includes(to);
}
