"use client";

import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";
import styles from "./SortableImageList.module.css";

export type SortableImage = { id: string; name: string; preview: string };

type Props = {
  images: SortableImage[];
  onOrderChange(images: SortableImage[]): void;
  onRemove?(id: string): void;
  removeDisabled?: boolean;
};

export function SortableImageList({ images, onOrderChange, onRemove, removeDisabled = false }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const pointerId = useRef<number | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  const move = (sourceId: string, targetId: string) => {
    const from = images.findIndex((image) => image.id === sourceId);
    const to = images.findIndex((image) => image.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onOrderChange(next);
  };

  const moveBy = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= images.length) return;
    move(images[index].id, images[target].id);
  };

  const startPointerDrag = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    pointerId.current = event.pointerId;
    draggingIdRef.current = id;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(id);
  };

  const continuePointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const activeId = draggingIdRef.current;
    if (!activeId || pointerId.current !== event.pointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-image-id]");
    if (target?.dataset.imageId) move(activeId, target.dataset.imageId);
  };

  const stopPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
    draggingIdRef.current = null;
    setDraggingId(null);
  };

  return (
    <ol className={styles.list} aria-label="图片顺序，第一张为封面">
      {images.map((image, index) => (
        <li
          className={draggingId === image.id ? styles.dragging : undefined}
          data-image-id={image.id}
          key={image.id}
          onDragOver={(event) => { event.preventDefault(); if (draggingId) move(draggingId, image.id); }}
        >
          <div className={styles.preview}>
            <Image src={image.preview} alt={`已上传图片 ${index + 1}`} fill sizes="64px" unoptimized />
            {index === 0 ? <span>封面</span> : null}
          </div>
          <div className={styles.meta}><strong>{image.name}</strong><small>{index === 0 ? "当前封面" : `第 ${index + 1} 张`}</small></div>
          <button
            className={styles.handle}
            type="button"
            aria-label={`拖动${image.name}调整顺序`}
            onPointerDown={(event) => startPointerDrag(event, image.id)}
            onPointerMove={continuePointerDrag}
            onPointerUp={stopPointerDrag}
            onPointerCancel={stopPointerDrag}
            draggable
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; draggingIdRef.current = image.id; setDraggingId(image.id); }}
            onDragEnd={() => { draggingIdRef.current = null; setDraggingId(null); }}
          >拖动</button>
          <div className={styles.keyboardActions}>
            <button type="button" onClick={() => moveBy(index, -1)} disabled={index === 0} aria-label={`${image.name}前移`}>↑</button>
            <button type="button" onClick={() => moveBy(index, 1)} disabled={index === images.length - 1} aria-label={`${image.name}后移`}>↓</button>
            {onRemove ? <button type="button" onClick={() => onRemove(image.id)} disabled={removeDisabled}>移除</button> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
