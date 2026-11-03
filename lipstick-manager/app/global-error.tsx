"use client";

export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="baseline-shell">
          <section className="baseline-card" role="alert">
            <h1>应用暂时不可用</h1>
            <p>请稍后重新加载。</p>
            <button type="button" onClick={reset}>
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
