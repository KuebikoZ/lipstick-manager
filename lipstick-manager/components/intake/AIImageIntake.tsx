"use client";

import { useEffect, useRef, useState } from "react";
import { aiConsentVersion, type AIModelResult } from "@/lib/domain/ai-intake";
import { prepareImageForUpload } from "./image-preparation";
import { SortableImageList, type SortableImage } from "./SortableImageList";
import styles from "./AIImageIntake.module.css";

type AIResult = AIModelResult & { task_id: string; status: string };
type Props = {
  draftId: string;
  initialImageIds: string[];
  onImagesChange(ids: string[]): void;
  onApply(field: string, value: string | number | null, taskId: string): void;
  confirmedIdentity: { brand: string | null; series: string | null; shade_code: string | null };
};

export function AIImageIntake({ draftId, initialImageIds, onImagesChange, onApply, confirmedIdentity }: Props) {
  const [images, setImages] = useState<SortableImage[]>(
    initialImageIds.map((id, index) => ({ id, name: `已上传图片 ${index + 1}`, preview: `/api/v1/uploads/${id}` })),
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<AIResult | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [ignored, setIgnored] = useState<string[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const savedTask = window.sessionStorage.getItem(`ai-task:${draftId}`);
    const restoreTimer = savedTask ? window.setTimeout(() => { setTaskId(savedTask); void poll(savedTask); }, 0) : null;
    return () => { if (restoreTimer) window.clearTimeout(restoreTimer); if (pollRef.current) window.clearTimeout(pollRef.current); };
    // Restoring one persisted task is intentional; poll is stable for this mounted draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);
  const updateImages = (next: typeof images) => {
    setImages(next); setResult(null); setTaskId(null); setStatus(null); setIgnored([]);
    window.sessionStorage.removeItem(`ai-task:${draftId}`);
    onImagesChange(next.map((image) => image.id));
  };

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 3) { setError("最多上传 3 张图片"); return; }
    setUploading(true); setError(null);
    const next = [...images];
    const reservations: Array<{ originalFile: File; file: File; imageId: string; uploadUrl: string }> = [];
    try {
      for (const originalFile of Array.from(files)) {
        const file = await prepareImageForUpload(originalFile);
        const created = await fetch("/api/v1/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_name: file.name, mime_type: file.type, byte_size: file.size, draft_id: draftId }) });
        const createdBody = await created.json();
        if (!created.ok) throw new Error(createdBody.error?.field_errors?.image ?? createdBody.error?.message ?? "无法准备图片上传");
        reservations.push({ originalFile, file, imageId: String(createdBody.data.image_id), uploadUrl: String(createdBody.data.upload_url) });
      }
      const results = await Promise.allSettled(reservations.map(async ({ originalFile, file, imageId, uploadUrl }) => {
        try {
          const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, "x-upsert": "false" }, body: file });
          if (!upload.ok) throw new Error("图片上传失败，请重试");
          const completed = await fetch(`/api/v1/uploads/${imageId}/complete`, { method: "POST" });
          if (!completed.ok) { const body = await completed.json(); throw new Error(body.error?.message ?? "图片校验失败"); }
          return { id: imageId, name: originalFile.name, preview: URL.createObjectURL(file) };
        } catch (cause) { await fetch(`/api/v1/uploads/${imageId}`, { method: "DELETE" }); throw cause; }
      }));
      for (const result of results) if (result.status === "fulfilled") next.push(result.value);
      if (next.length > images.length) updateImages(next);
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) setError(`${failed.length} 张图片上传失败，其他图片已保留，请重试`);
    } catch (cause) {
      await Promise.allSettled(reservations.map(({ imageId }) => fetch(`/api/v1/uploads/${imageId}`, { method: "DELETE" })));
      setError(cause instanceof Error ? cause.message : "图片上传失败，请重试");
    }
    finally { setUploading(false); }
  }

  async function removeImage(id: string) {
    const response = await fetch(`/api/v1/uploads/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("暂时无法移除图片"); return; }
    updateImages(images.filter((image) => image.id !== id));
  }

  async function poll(id: string) {
    const response = await fetch(`/api/v1/ai/tasks/${id}`);
    if (!response.ok) { setError("识别状态读取失败，可继续手工填写"); return; }
    const body = await response.json(); const data = body.data as AIResult;
    setStatus(data.status);
    if (["queued", "recognizing", "needs_confirmation", "researching"].includes(data.status)) {
      pollRef.current = window.setTimeout(() => void poll(id), 1200); return;
    }
    if (data.status === "complete" || data.status === "partial") setResult(data);
    else setError(data.status === "cancelled" ? "已取消识别，手工录入不受影响" : "识别未完成，可继续手工填写或重试");
  }

  async function startRecognition(confirmed = false) {
    if (!images.length) { setError("请先上传至少 1 张图片；也可以直接手工录入"); return; }
    const consented = window.localStorage.getItem("ai-image-consent") === aiConsentVersion;
    if (!consented && !confirmed) { setShowConsent(true); return; }
    if (confirmed) window.localStorage.setItem("ai-image-consent", aiConsentVersion);
    setShowConsent(false); setError(null); setResult(null); setStatus("queued");
    const response = await fetch("/api/v1/ai/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft_id: draftId, image_ids: images.map((image) => image.id), consent_version: aiConsentVersion, confirmed_identity: confirmedIdentity }) });
    const body = await response.json();
    if (!response.ok) { setStatus(null); setError(body.error?.field_errors?.ai ?? body.error?.message ?? "无法开始识别"); return; }
    setTaskId(body.data.task_id); window.sessionStorage.setItem(`ai-task:${draftId}`, body.data.task_id); void poll(body.data.task_id);
  }

  async function cancel() {
    if (!taskId) return;
    await fetch(`/api/v1/ai/tasks/${taskId}/cancel`, { method: "POST" });
    setStatus("cancelled"); if (pollRef.current) window.clearTimeout(pollRef.current);
  }

  const applying = result ? { ...result.identity, ...result.suggestions } : null;
  return (
    <section className={styles.root} aria-labelledby="ai-intake-title">
      <div className={styles.heading}><div><h2 id="ai-intake-title">图片辅助识别</h2><p>可选 0–3 张。只有点击开始识别后图片才会发送给 DeepSeek。</p></div><span>{images.length}/3</span></div>
      <label className={styles.picker}><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || images.length >= 3} onChange={(event) => void addFiles(event.target.files)} /><span>{uploading ? "正在上传并校验…" : images.length ? "继续添加图片" : "选择口红包装图片"}</span></label>
      {images.length ? <SortableImageList images={images} onOrderChange={updateImages} onRemove={(id) => void removeImage(id)} removeDisabled={Boolean(status && !["failed", "cancelled", "timed_out", "complete", "partial"].includes(status))} /> : null}
      {showConsent ? <div className={styles.consent} role="alert"><strong>首次图片外传确认</strong><p>点击同意后，本次所选图片会发送至 DeepSeek 用于识别包装文字和产品信息。图片不会公开；你可以忽略全部建议并继续手填。</p><div><button type="button" onClick={() => void startRecognition(true)}>同意并开始识别</button><button type="button" className={styles.secondary} onClick={() => setShowConsent(false)}>暂不识别</button></div></div> : null}
      <div className={styles.controls}><button type="button" onClick={() => void startRecognition()} disabled={uploading || Boolean(status && ["queued", "recognizing", "researching"].includes(status))}>{status && ["queued", "recognizing", "researching"].includes(status) ? "正在识别…" : "开始识别"}</button>{status && ["queued", "recognizing", "researching"].includes(status) ? <button type="button" className={styles.secondary} onClick={() => void cancel()}>取消</button> : null}</div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {result && applying ? <div className={styles.suggestions}><h3>识别建议</h3><p>逐项采用或忽略；点击采用会覆盖该字段当前的选择。</p>{result.candidates.length > 1 ? <div className={styles.candidates}><strong>可能的产品</strong>{result.candidates.map((candidate) => <button type="button" key={candidate.label} onClick={() => { for (const field of ["brand", "series", "shade_code"] as const) if (candidate[field]) onApply(field, candidate[field], result.task_id); }}>{candidate.label}<small>{Math.round(candidate.confidence * 100)}%</small></button>)}</div> : null}{Object.entries(applying).filter(([field, value]) => value !== null && !ignored.includes(field)).map(([field, value]) => <div className={styles.suggestion} key={field}><span><strong>{fieldLabel(field)}</strong><small>{suggestionValue(field, value)}</small></span><span className={styles.suggestionActions}><button type="button" onClick={() => onApply(field, value, result.task_id)}>采用</button><button type="button" onClick={() => setIgnored((current) => [...current, field])}>忽略</button></span></div>)}</div> : null}
    </section>
  );
}

function fieldLabel(field: string) { return ({ brand: "品牌", series: "系列", shade_code: "色号", color_family: "主色系", color_description: "颜色说明", texture: "质地", pao_months: "开封后月数", manufactured_on: "生产日期", shelf_life_months: "未开封保质期", expires_on: "到期日期" } as Record<string, string>)[field] ?? field; }
function suggestionValue(field: string, value: unknown) {
  if (field === "color_family") return ({ nude: "裸色系", rose: "豆沙色系", orange: "橘色系", red: "红色系", plum: "梅子色系", brown: "棕色系" } as Record<string, string>)[String(value)] ?? String(value);
  return String(value);
}
