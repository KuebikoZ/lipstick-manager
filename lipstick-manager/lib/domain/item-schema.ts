import { z } from "zod";
import {
  colorFamilySchema,
  expirySourceSchema,
  lifecycleSchema,
  openingPrecisionSchema,
} from "@/lib/domain/inventory";
import { localDateSchema, type LocalDate } from "@/lib/domain/local-date";
import { validateDeadlineDates } from "@/lib/domain/validation";

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable();
const nullableDate = localDateSchema.nullable();
const nullableUuid = z.uuid().nullable();

export const itemWriteObjectSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100),
    brand: nullableText(100),
    series: nullableText(100),
    shade_code: nullableText(100),
    color_family: colorFamilySchema.nullable(),
    color_family_confirmed: z.boolean(),
    color_description: nullableText(200),
    texture: nullableText(200),
    lifecycle: lifecycleSchema,
    opened_on: nullableDate,
    opening_precision: openingPrecisionSchema,
    pao_months: z.number().int().min(1).max(120).nullable(),
    manufactured_on: nullableDate,
    shelf_life_months: z.number().int().min(1).max(240).nullable(),
    expires_on: nullableDate,
    expiry_source: expirySourceSchema.nullable(),
    note: nullableText(500),
    image_ids: z.array(z.uuid()).max(3),
    cover_image_id: nullableUuid,
    accepted_ai_task_id: nullableUuid,
  })
  .strict();

export const draftPayloadSchema = itemWriteObjectSchema
  .partial()
  .extend({ display_name: z.string().trim().max(100).optional() })
  .strict();

export function createItemWriteSchema(today: LocalDate) {
  return itemWriteObjectSchema.superRefine((value, context) => {
    if (!value.color_family_confirmed) {
      context.addIssue({
        code: "custom",
        path: ["color_family_confirmed"],
        message: "请确认主色系或明确选择待分类",
      });
    }
    if (value.opened_on && value.opening_precision !== "exact") {
      context.addIssue({
        code: "custom",
        path: ["opening_precision"],
        message: "填写开封日期时精度必须为准确日期",
      });
    }
    if (value.expires_on && !value.expiry_source) {
      context.addIssue({
        code: "custom",
        path: ["expiry_source"],
        message: "请标明到期日期来源",
      });
    }
    if (!value.expires_on && value.expiry_source) {
      context.addIssue({
        code: "custom",
        path: ["expiry_source"],
        message: "没有到期日期时不能设置来源",
      });
    }
    if (value.cover_image_id && !value.image_ids.includes(value.cover_image_id)) {
      context.addIssue({
        code: "custom",
        path: ["cover_image_id"],
        message: "封面图片必须属于本次保存的图片",
      });
    }

    for (const error of validateDeadlineDates(value, today)) {
      if (error === "OPENED_ON_IN_FUTURE") {
        context.addIssue({ code: "custom", path: ["opened_on"], message: "开封日期不能晚于今天" });
      } else if (error === "MANUFACTURED_ON_IN_FUTURE") {
        context.addIssue({
          code: "custom",
          path: ["manufactured_on"],
          message: "生产日期不能晚于今天",
        });
      } else if (error === "MANUFACTURED_AFTER_EXPIRY") {
        context.addIssue({
          code: "custom",
          path: ["manufactured_on"],
          message: "生产日期不能晚于实物到期日",
        });
      } else {
        context.addIssue({
          code: "custom",
          path: ["opened_on"],
          message: "开封日期不能晚于有效到期日期",
        });
      }
    }
  });
}

export type ItemWriteInput = z.infer<typeof itemWriteObjectSchema>;
export type DraftPayload = z.infer<typeof draftPayloadSchema>;
