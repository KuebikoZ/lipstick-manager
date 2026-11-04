import type { DeadlineResult } from "@/lib/domain/deadline";
import type {
  ColorFamily,
  ExpirySource,
  Lifecycle,
  OpeningPrecision,
} from "@/lib/domain/inventory";
import type { LocalDate } from "@/lib/domain/local-date";

export type LipstickItem = {
  id: string;
  revision: number;
  display_name: string;
  brand: string | null;
  series: string | null;
  shade_code: string | null;
  color_family: ColorFamily | null;
  color_description: string | null;
  texture: string | null;
  lifecycle: Lifecycle;
  opened_on: LocalDate | null;
  opening_precision: OpeningPrecision;
  pao_months: number | null;
  manufactured_on: LocalDate | null;
  shelf_life_months: number | null;
  expires_on: LocalDate | null;
  expiry_source: ExpirySource | null;
  note: string | null;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
} & DeadlineResult;

export type Draft = {
  id: string;
  kind: "new" | "edit";
  item_id: string | null;
  base_revision: number | null;
  payload: Record<string, unknown>;
  suggestion_version: number;
  updated_at: string;
  expires_at: string;
};
