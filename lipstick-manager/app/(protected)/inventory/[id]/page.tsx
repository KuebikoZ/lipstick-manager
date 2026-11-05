import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { InventoryNotFoundError } from "@/lib/services/inventory-service";
import { createInventoryService } from "@/lib/services/service-factory";
import styles from "./page.module.css";
import { ItemActions } from "@/components/inventory/ItemActions";
import { ProductCover } from "@/components/inventory/ProductCover";
import { buildDisplayName } from "@/lib/domain/display-name";

export default async function InventoryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  await requirePageSession();
  const item = await loadItem((await params).id);
  const displayName = buildDisplayName(item);
  const cover = item.images.find((image) => image.id === item.cover_image_id) ?? item.images[0];
  const requestedReturn = (await searchParams).returnTo;
  const returnTo = requestedReturn?.startsWith("/inventory") || requestedReturn?.startsWith("/compare") ? requestedReturn : "/inventory";
  return (
    <main className={styles.shell}>
      <article className={styles.card}>
        <Link className={styles.back} href={returnTo}>← 返回{returnTo.startsWith("/compare") ? "买前查一查" : "口红柜"}</Link>
        <h1>{displayName}</h1>
        <ProductCover imageUrl={cover?.url} name={displayName} colorFamily={item.color_family} variant="detail" />
        <dl>
          <div><dt>品牌</dt><dd>{item.brand ?? "未记录"}</dd></div>
          <div><dt>系列</dt><dd>{item.series ?? "未记录"}</dd></div>
          <div><dt>色号</dt><dd>{item.shade_code ?? "未记录"}</dd></div>
          <div><dt>持有状态</dt><dd>{item.lifecycle === "opened" ? "已开封" : item.lifecycle === "unopened" ? "未开封" : "待补充"}</dd></div>
          <div><dt>期限</dt><dd>{item.deadline ? `${item.deadline}（${item.days_left} 天）` : "期限待补充"}</dd></div>
          <div><dt>备注</dt><dd>{item.note ?? "未记录"}</dd></div>
        </dl>
        <section className={styles.timeline} aria-label="产品时间轴">
          {timeline(item).map((node,index)=><div key={node.label}><i>{index+1}</i><strong>{node.label}</strong><span>{node.text}</span></div>)}
        </section>
        <div className={styles.actions}>
          <Link href="/inventory/new">新增</Link>
          <Link href={returnTo}>列表</Link>
          <ItemActions id={item.id} revision={item.revision}/>
        </div>
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

function timeline(item: Awaited<ReturnType<typeof loadItem>>) {
  return [
    { label: "录入日期", date: item.created_at.slice(0,10), text: item.created_at.slice(0,10) },
    { label: "开封日期", date: item.opened_on, text: item.lifecycle === "unopened" ? "尚未开封" : item.opened_on ?? "未记录" },
    { label: "到期日期", date: item.deadline, text: item.deadline ?? "待补充" },
  ].sort((left,right)=>left.date&&right.date?left.date.localeCompare(right.date):left.date?-1:right.date?1:0);
}
