import Image from "next/image";
import type { CSSProperties } from "react";
import type { ColorFamily } from "@/lib/domain/inventory";
import styles from "./ProductCover.module.css";

const lipstickColors: Record<ColorFamily, string> = {
  nude: "#b27a73",
  rose: "#a75d6d",
  orange: "#bd6f4f",
  red: "#b9444b",
  plum: "#744b66",
  brown: "#82594d",
};

type Props = {
  imageUrl?: string | null;
  name: string;
  colorFamily: ColorFamily | null;
  variant?: "card" | "detail";
};

export function ProductCover({ imageUrl, name, colorFamily, variant = "card" }: Props) {
  return (
    <div className={`${styles.cover} ${variant === "detail" ? styles.detail : styles.card}`} style={{ "--lipstick-color": lipstickColors[colorFamily ?? "rose"] } as CSSProperties}>
      {imageUrl ? (
        <Image src={imageUrl} alt={`${name}产品封面`} fill priority={variant === "detail"} sizes={variant === "detail" ? "(max-width: 720px) 100vw, 632px" : "(max-width: 767px) 96px, 128px"} unoptimized />
      ) : (
        <div className={styles.illustration} role="img" aria-label="默认口红封面插画">
          <span className={styles.lipstick} />
        </div>
      )}
    </div>
  );
}
