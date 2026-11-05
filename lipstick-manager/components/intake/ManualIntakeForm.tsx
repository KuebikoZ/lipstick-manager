"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { Draft } from "@/lib/domain/item";
import { buildDisplayName, normalizeSeries } from "@/lib/domain/display-name";
import { colorFamilies, textures, type ColorFamily, type Lifecycle } from "@/lib/domain/inventory";
import type { ItemWriteInput } from "@/lib/domain/item-schema";
import { AIImageIntake } from "./AIImageIntake";
import styles from "./ManualIntakeForm.module.css";
import { trackEvent } from "@/lib/analytics/client";

const optionalDate = z.union([z.literal(""), z.iso.date()]);
const optionalInteger = (maximum: number) =>
  z.union([
    z.literal(""),
    z.string().regex(/^\d+$/, "请输入整数").refine((value) => Number(value) >= 1 && Number(value) <= maximum, `请输入 1–${maximum}`),
  ]);

const formSchema = z
  .object({
    brand: z.string().max(100, "最多 100 个字符"),
    series: z.string().max(50, "最多 50 个字符"),
    shade_code: z.string().max(100, "最多 100 个字符"),
    color_family: z.enum([...colorFamilies, "pending", ""]),
    color_description: z.string().max(200, "最多 200 个字符"),
    texture: z.enum(["", ...textures]),
    lifecycle: z.enum(["unopened", "opened", "unknown"]),
    opened_on: optionalDate,
    pao_months: optionalInteger(120),
    manufactured_on: optionalDate,
    shelf_life_months: optionalInteger(240),
    expires_on: optionalDate,
    note: z.string().max(500, "最多 500 个字符"),
  })
  .superRefine((value, context) => {
    if (!value.color_family) {
      context.addIssue({ code: "custom", path: ["color_family"], message: "请选择主色系或待分类" });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const colorLabels: Record<ColorFamily, { name: string; help: string }> = {
  nude: { name: "裸色系", help: "奶茶色、肉桂裸、桃色" },
  rose: { name: "豆沙色系", help: "豆沙色、玫瑰色" },
  orange: { name: "橘色系", help: "南瓜色、珊瑚色" },
  red: { name: "红色系", help: "番茄红、正红" },
  plum: { name: "梅子色系", help: "梅子色、葡萄紫" },
  brown: { name: "棕色系", help: "红棕、摩卡、巧克力棕" },
};

const blankValues: FormValues = {
  brand: "",
  series: "",
  shade_code: "",
  color_family: "",
  color_description: "",
  texture: "",
  lifecycle: "unknown",
  opened_on: "",
  pao_months: "",
  manufactured_on: "",
  shelf_life_months: "",
  expires_on: "",
  note: "",
};

function textOrNull(value: string): string | null {
  return value.trim() || null;
}

function numberOrNull(value: string): number | null {
  return value ? Number(value) : null;
}

function toItemInput(values: FormValues, imageIds: string[] = [], acceptedTaskId: string | null = null): ItemWriteInput {
  const openedOn = values.opened_on || null;
  const expiresOn = values.expires_on || null;
  return {
    display_name: buildDisplayName(values),
    brand: textOrNull(values.brand),
    series: normalizeSeries(values.brand, values.series),
    shade_code: textOrNull(values.shade_code),
    color_family: values.color_family === "pending" ? null : (values.color_family as ColorFamily),
    color_family_confirmed: Boolean(values.color_family),
    color_description: textOrNull(values.color_description),
    texture: values.texture || null,
    lifecycle: values.lifecycle,
    opened_on: openedOn,
    opening_precision: openedOn ? "exact" : "unknown",
    pao_months: numberOrNull(values.pao_months),
    manufactured_on: values.manufactured_on || null,
    shelf_life_months: numberOrNull(values.shelf_life_months),
    expires_on: expiresOn,
    expiry_source: expiresOn ? "explicit" : null,
    note: textOrNull(values.note),
    image_ids: imageIds,
    cover_image_id: imageIds[0] ?? null,
    accepted_ai_task_id: acceptedTaskId,
  };
}

function toDraftPayload(values: FormValues, imageIds: string[] = [], acceptedTaskId: string | null = null): Record<string, unknown> {
  const input = toItemInput(values, imageIds, acceptedTaskId);
  if (!values.color_family) {
    const payload: Record<string, unknown> = { ...input };
    delete payload.color_family;
    return payload;
  }
  return input;
}

function fromDraft(draft: Draft): FormValues {
  const payload = draft.payload as Partial<ItemWriteInput>;
  return {
    ...blankValues,
    brand: payload.brand ?? "",
    series: payload.series ?? "",
    shade_code: payload.shade_code ?? "",
    color_family: payload.color_family_confirmed
      ? (payload.color_family ?? "pending")
      : "",
    color_description: payload.color_description ?? "",
    texture: payload.texture ?? "",
    lifecycle:
      payload.lifecycle && payload.lifecycle !== "discarded"
        ? (payload.lifecycle as Exclude<Lifecycle, "discarded">)
        : "unknown",
    opened_on: payload.opened_on ?? "",
    pao_months: payload.pao_months?.toString() ?? "",
    manufactured_on: payload.manufactured_on ?? "",
    shelf_life_months: payload.shelf_life_months?.toString() ?? "",
    expires_on: payload.expires_on ?? "",
    note: payload.note ?? "",
  };
}

type ApiErrorBody = {
  error?: { message?: string; field_errors?: Record<string, string> };
};

export function ManualIntakeForm({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [draftStatus, setDraftStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [keepDraftPending, setKeepDraftPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<{ body: string; key: string } | null>(null);
  const initialPayload = draft.payload as Partial<ItemWriteInput>;
  const [imageIds, setImageIds] = useState<string[]>(initialPayload.image_ids ?? []);
  const [imagesTouched, setImagesTouched] = useState(false);
  const [acceptedTaskId, setAcceptedTaskId] = useState<string | null>(initialPayload.accepted_ai_task_id ?? null);
  const started = useRef(false);
  const [adoptedCount, setAdoptedCount] = useState(0);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [acceptedValues, setAcceptedValues] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: fromDraft(draft),
    mode: "onBlur",
  });
  const watchedValues = useWatch({ control });
  const lifecycle = watchedValues.lifecycle;

  useEffect(() => {
    if ((!isDirty && !imagesTouched) || started.current) return;
    started.current = true;
    trackEvent({ event_name: "intake_start", page_id: "intake_new", intake_id: draft.id, properties: { mode: acceptedTaskId ? "ai_assisted" : "manual" } });
  }, [acceptedTaskId, draft.id, imagesTouched, isDirty]);

  useEffect(() => {
    if (!isDirty && !imagesTouched) return;
    const timer = window.setTimeout(async () => {
      setDraftStatus("saving");
      try {
        const completeValues = { ...blankValues, ...watchedValues } as FormValues;
        const response = await fetch(`/api/v1/drafts/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: toDraftPayload(completeValues, imageIds, acceptedTaskId) }),
        });
        setDraftStatus(response.ok ? "saved" : "failed");
      } catch {
        setDraftStatus("failed");
      }
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [acceptedTaskId, draft.id, imageIds, imagesTouched, isDirty, watchedValues]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const correctedFields = Object.entries(acceptedValues).filter(([field, accepted]) => String(values[field as keyof FormValues] ?? "") !== accepted).map(([field]) => field);
    for (const field of correctedFields) trackEvent({ event_name: "action", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { action: "ai_suggestion_correct", field: field as never } });
    const input = toItemInput(values, imageIds, acceptedTaskId);
    const body = JSON.stringify(input);
    const currentSubmission =
      submission?.body === body ? submission : { body, key: crypto.randomUUID() };
    if (currentSubmission !== submission) setSubmission(currentSubmission);
    try {
      const draftResponse = await fetch(`/api/v1/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: toDraftPayload(values, imageIds, acceptedTaskId) }),
      });
      if (!draftResponse.ok) {
        trackEvent({ event_name: "save_result", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { outcome: "failure", mode: "create" } });
        setSubmitError("图片顺序暂时无法保存，请重试");
        return;
      }
      const response = await fetch("/api/v1/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": currentSubmission.key,
        },
        body,
      });
      const result = (await response.json()) as ApiErrorBody & { data?: { id: string } };
      if (!response.ok || !result.data) {
        trackEvent({ event_name: "save_result", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { outcome: "failure", mode: "create" } });
        for (const [field, message] of Object.entries(result.error?.field_errors ?? {})) {
          setError(field as keyof FormValues, { message });
        }
        setSubmitError(result.error?.message ?? "保存失败，请稍后重试");
        return;
      }
      trackEvent({ event_name: "save_result", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { outcome: "success", mode: "create" } });
      trackEvent({ event_name: "intake_end", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { outcome: "success", mode: acceptedTaskId ? "ai_assisted" : "manual", adopted_count: adoptedCount, ignored_count: ignoredCount, corrected_count: correctedFields.length } });
      router.push(`/inventory/${result.data.id}`);
      router.refresh();
    } catch {
      trackEvent({ event_name: "save_result", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { outcome: "failure", mode: "create" } });
      setSubmitError("网络连接失败，内容已保留，请恢复网络后重试");
    }
  });

  const keepDraftAndLeave = async () => {
    if (keepDraftPending) return;
    setKeepDraftPending(true);
    setDraftStatus("saving");
    try {
      const response = await fetch(`/api/v1/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: toDraftPayload(getValues(), imageIds, acceptedTaskId) }),
      });
      if (!response.ok) {
        setDraftStatus("failed");
        return;
      }
      setDraftStatus("saved");
      router.push("/");
      router.refresh();
    } catch {
      setDraftStatus("failed");
    } finally {
      setKeepDraftPending(false);
    }
  };

  const cancelIntake = async () => {
    if (cancelPending || !window.confirm("放弃本次录入？草稿、图片和识别结果都会永久删除。")) return;
    setCancelPending(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/v1/drafts/${draft.id}`, { method: "DELETE" });
      if (!response.ok) {
        setSubmitError("暂时无法取消录入，请稍后重试");
        return;
      }
      window.sessionStorage.removeItem(`ai-task:${draft.id}`);
      trackEvent({ event_name: "intake_end", page_id: "intake_new", intake_id: draft.id, task_id: acceptedTaskId, properties: { outcome: "cancelled", mode: acceptedTaskId ? "ai_assisted" : "manual", adopted_count: adoptedCount, ignored_count: ignoredCount, corrected_count: 0 } });
      router.push("/");
      router.refresh();
    } catch {
      setSubmitError("网络连接失败，暂时无法取消录入");
    } finally {
      setCancelPending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← 返回并保留草稿</Link>
        <div>
          <p className={styles.eyebrow}>手工录入</p>
          <h1>新增一支口红</h1>
        </div>
        <span className={styles.draftStatus} role="status">
          {draftStatus === "saving" ? "正在保存草稿…" : draftStatus === "failed" ? "草稿保存失败，将自动重试" : "草稿已保存"}
        </span>
      </header>

      <AIImageIntake
        draftId={draft.id}
        initialImageIds={imageIds}
        onImagesChange={(ids) => { setImageIds(ids); setImagesTouched(true); setAcceptedTaskId(null); }}
        onIgnore={() => setIgnoredCount((count) => count + 1)}
        confirmedIdentity={{ brand: textOrNull(watchedValues.brand ?? ""), series: normalizeSeries(watchedValues.brand, watchedValues.series), shade_code: textOrNull(watchedValues.shade_code ?? "") }}
        onApply={(field, value, taskId) => {
          const fieldName = field as keyof FormValues;
          if (!(fieldName in blankValues)) return;
          const normalized = typeof value === "number" ? String(value) : value ?? "";
          setValue(fieldName, normalized as never, { shouldDirty: true, shouldValidate: true });
          setAcceptedTaskId(taskId);
          setAdoptedCount((count) => count + 1);
          setAcceptedValues((values) => ({ ...values, [field]: String(normalized) }));
          trackEvent({ event_name: "action", page_id: "intake_new", intake_id: draft.id, task_id: taskId, properties: { action: "ai_suggestion_adopt", field: field as never } });
        }}
      />

      <section className={styles.section} aria-labelledby="lifecycle-title">
        <h2 id="lifecycle-title">持有状态</h2>
        <div className={styles.choiceGrid}>
          {(["unknown", "unopened", "opened"] as const).map((value) => (
            <label className={styles.choice} key={value}>
              <input type="radio" value={value} {...register("lifecycle")} />
              <span>{value === "unknown" ? "待补充" : value === "unopened" ? "未开封" : "已开封"}</span>
            </label>
          ))}
        </div>
        {lifecycle === "opened" ? (
          <div className={styles.twoColumns}>
            <Field label="开封日期" error={errors.opened_on?.message}>
              <input type="date" {...register("opened_on")} />
            </Field>
            <Field label="开封后使用月数" error={errors.pao_months?.message}>
              <input type="number" inputMode="numeric" min="1" max="120" {...register("pao_months")} />
            </Field>
          </div>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="product-title">
        <h2 id="product-title">产品信息</h2>
        <div className={styles.twoColumns}>
          <Field label="品牌" error={errors.brand?.message}><input maxLength={100} {...register("brand")} /></Field>
          <Field label="系列" error={errors.series?.message}><input maxLength={50} {...register("series")} /></Field>
        </div>
        <Field label="色号" error={errors.shade_code?.message}><input maxLength={100} {...register("shade_code")} /></Field>
      </section>

      <section className={styles.section} aria-labelledby="color-title">
        <h2 id="color-title">主色系</h2>
        <p className={styles.help}>请选择一个主色系，无法判断时明确选择“待分类”。</p>
        <div className={styles.colorGrid}>
          {colorFamilies.map((value) => (
            <label className={styles.colorChoice} key={value}>
              <input type="radio" value={value} {...register("color_family")} />
              <span><strong>{colorLabels[value].name}</strong><small>{colorLabels[value].help}</small></span>
            </label>
          ))}
          <label className={styles.colorChoice}>
            <input type="radio" value="pending" {...register("color_family")} />
            <span><strong>待分类</strong><small>暂时无法确认主色系</small></span>
          </label>
        </div>
        {errors.color_family ? <p className={styles.error} role="alert">{errors.color_family.message}</p> : null}
        <Field label="颜色说明" error={errors.color_description?.message}><input maxLength={200} {...register("color_description")} /></Field>
        <Field label="质地" error={errors.texture?.message}>
          <select {...register("texture")}>
            <option value="">待补充</option>
            {textures.map((texture) => <option key={texture} value={texture}>{texture}</option>)}
          </select>
        </Field>
      </section>

      <section className={styles.section} aria-labelledby="deadline-title">
        <h2 id="deadline-title">期限与备注</h2>
        <div className={styles.twoColumns}>
          <Field label="实物到期日期" error={errors.expires_on?.message}><input type="date" {...register("expires_on")} /></Field>
          <Field label="实物生产日期" error={errors.manufactured_on?.message}><input type="date" {...register("manufactured_on")} /></Field>
        </div>
        <Field label="未开封保质期（月）" error={errors.shelf_life_months?.message}>
          <input type="number" inputMode="numeric" min="1" max="240" {...register("shelf_life_months")} />
        </Field>
        <Field label="备注" error={errors.note?.message}>
          <textarea rows={4} maxLength={500} {...register("note")} />
        </Field>
      </section>

      <div className={styles.actions}>
        {submitError ? <p className={styles.submitError} role="alert">{submitError}</p> : null}
        <button type="submit" disabled={isSubmitting || keepDraftPending || cancelPending}>{isSubmitting ? "保存中…" : "保存"}</button>
        <button
          type="button"
          className={styles.cancel}
          disabled={isSubmitting || keepDraftPending || cancelPending}
          onClick={keepDraftAndLeave}
        >
          {keepDraftPending ? "暂存中…" : "暂存"}
        </button>
        <button
          type="button"
          className={styles.cancel}
          disabled={isSubmitting || keepDraftPending || cancelPending}
          onClick={() => void cancelIntake()}
        >
          {cancelPending ? "取消中…" : "取消"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {error ? <small className={styles.error} role="alert">{error}</small> : null}
    </label>
  );
}
