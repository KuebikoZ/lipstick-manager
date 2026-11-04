import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { InventoryNotFoundError } from "@/lib/services/inventory-service";
import { createInventoryService } from "@/lib/services/service-factory";
import styles from "./page.module.css";
import { ItemActions } from "@/components/inventory/ItemActions";

export default async function InventoryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  await requirePageSession();
  const item = await loadItem((await params).id);
  const requestedReturn = (await searchParams).returnTo;
  const returnTo = requestedReturn?.startsWith("/inventory") || requestedReturn?.startsWith("/compare") ? requestedReturn : "/inventory";
  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <Link className={styles.back} href={returnTo}>← 返回{returnTo.startsWith("/compare") ? "买前查一查" : "口红柜"}</Link>
        {item.images[0] && (
          <Image unoptimized className={styles.cover} width={632} height={480} src={item.images[0].url} alt={`${item.display_name}实拍`}/>
        )}
        <h1>{item.display_name}</h1>
        <dl>
          <div><dt>品牌</dt><dd>{item.brand ?? "未记录"}</dd></div>
          <div><dt>系列</dt><dd>{item.series ?? "未记录"}</dd></div>
          <div><dt>色号</dt><dd>{item.shade_code ?? "未记录"}</dd></div>
          <div><dt>持有状态</dt><dd>{item.lifecycle === "opened" ? "已开封" : item.lifecycle === "unopened" ? "未开封" : "待补充"}</dd></div>
          <div><dt>期限</dt><dd>{item.deadline ? `${item.deadline}（${item.days_left} 天）` : "期限待补充"}</dd></div>
          <div><dt>备注</dt><dd>{item.note ?? "未记录"}</dd></div>
        </dl>
        <section className={styles.timeline} aria-label="产品时间轴">
          <div><i>1</i><strong>录入日期</strong><span>{item.created_at.slice(0,10)}</span></div>
          <div><i>2</i><strong>开封日期</strong><span>{item.lifecycle === "unopened" ? "尚未开封" : item.opened_on ?? "未记录"}</span></div>
          <div><i>3</i><strong>到期日期</strong><span>{item.deadline ?? "待补充"}</span></div>
        </section>
        <div className={styles.actions}>
          <Link href="/inventory/new">继续新增</Link>
          <Link href={returnTo}>返回列表</Link>
        </div>
        <ItemActions id={item.id} revision={item.revision}/>
        <p className={styles.note}>日期仅用于管理提醒，不代表实物品质检测。</p>
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
