import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { InventoryNotFoundError } from "@/lib/services/inventory-service";
import { createInventoryService } from "@/lib/services/service-factory";
import styles from "./page.module.css";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageSession();
  const item = await loadItem((await params).id);
  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <p className={styles.success}>已保存</p>
        <h1>{item.display_name}</h1>
        <dl>
          <div><dt>品牌</dt><dd>{item.brand ?? "未记录"}</dd></div>
          <div><dt>系列</dt><dd>{item.series ?? "未记录"}</dd></div>
          <div><dt>色号</dt><dd>{item.shade_code ?? "未记录"}</dd></div>
          <div><dt>持有状态</dt><dd>{item.lifecycle === "opened" ? "已开封" : item.lifecycle === "unopened" ? "未开封" : "待补充"}</dd></div>
          <div><dt>期限</dt><dd>{item.deadline ? `${item.deadline}（${item.days_left} 天）` : "期限待补充"}</dd></div>
          <div><dt>备注</dt><dd>{item.note ?? "未记录"}</dd></div>
        </dl>
        <div className={styles.actions}>
          <Link href="/inventory/new">继续新增</Link>
          <Link href="/">返回首页</Link>
        </div>
        <p className={styles.note}>完整详情、图片和期限时间轴将在后续阶段实现。</p>
      </article>
    </main>
  );
}

async function loadItem(id: string) {
  try {
    return await createInventoryService().getItem(id);
  } catch (error) {
    if (error instanceof InventoryNotFoundError) notFound();
    throw error;
  }
}
