import { z } from "zod";
import { colorFamilySchema, textureSchema } from "@/lib/domain/inventory";
import { localDateSchema } from "@/lib/domain/local-date";

export const aiConsentVersion = "2026-11-03-v1";
export const aiWorkflowVersion = "2";
export const aiSchemaVersion = "2";

const nullableShortText = z.string().trim().max(200).nullable();
export const aiIdentitySchema = z.object({
  brand: z.string().trim().max(100).nullable(),
  series: z.string().trim().max(50).nullable(),
  shade_code: z.string().trim().max(100).nullable(),
});
export const aiSuggestionsSchema = z.object({
  color_family: colorFamilySchema,
  color_description: nullableShortText,
  texture: textureSchema.nullable(),
  pao_months: z.number().int().min(1).max(120).nullable(),
  manufactured_on: localDateSchema.nullable(),
  shelf_life_months: z.number().int().min(1).max(240).nullable(),
  expires_on: localDateSchema.nullable(),
});
export const aiCandidateSchema = aiIdentitySchema.extend({
  label: z.string().trim().min(1).max(200),
  confidence: z.number().min(0).max(1),
});
export const aiModelResultSchema = z.object({
  identity: aiIdentitySchema,
  candidates: z.array(aiCandidateSchema).max(5),
  suggestions: aiSuggestionsSchema,
  image_evidence: z.array(z.object({
    field: z.string().trim().min(1).max(100),
    image_index: z.number().int().min(0).max(2),
    excerpt: z.string().trim().max(500).nullable(),
  })).max(20),
  unresolved_fields: z.array(z.string().max(100)).max(20),
  warnings: z.array(z.string().max(300)).max(20),
});

export type AIModelResult = z.infer<typeof aiModelResultSchema>;
export type AIIdentity = z.infer<typeof aiIdentitySchema>;
