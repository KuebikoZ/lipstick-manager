"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("Page rendering failed", { digest: error.digest });
  }, [error]);

  return (
    <main className="baseline-shell">
      <section className="baseline-card" role="alert">
        <p className="eyebrow">ERROR</p>
        <h1>页面暂时无法加载</h1>
        <p>请稍后重试。如果问题持续，请检查服务状态。</p>
        <button type="button" onClick={reset}>
          重新加载
        </button>
      </section>
    </main>
  );
}
