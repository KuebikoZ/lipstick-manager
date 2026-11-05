import Link from "next/link";
import { AnalyticsPageView } from "@/components/analytics/AnalyticsPageView";
import { TrackedCompareLink } from "@/components/analytics/TrackedCompareLink";
import { ProductCover } from "@/components/inventory/ProductCover";
import { requirePageSession } from "@/lib/auth/session";
import { buildDisplayName } from "@/lib/domain/display-name";
import type { LipstickItem } from "@/lib/domain/item";
import { createInventoryService } from "@/lib/services/service-factory";
import styles from "./page.module.css";

const families = [
  { value: "nude", label: "裸色系" },
  { value: "rose", label: "豆沙色系" },
  { value: "orange", label: "橘色系" },
  { value: "red", label: "红色系" },
  { value: "plum", label: "梅子色系" },
  { value: "brown", label: "棕色系" },
  { value: "pending", label: "待分类" },
] as const;
const lifeLabels = { opened: "已开封", unopened: "未开封", unknown: "待补充", discarded: "已移出" } as const;

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ color?: string }> }) {
  await requirePageSession();
  const color = (await searchParams).color;
  const all = await createInventoryService().listItems({ sort: "new" });
  const selected = families.some((family) => family.value === color) ? color : undefined;
  const items = selected ? all.items.filter((item) => selected === "pending" ? !item.color_family : item.color_family === selected) : all.items;
  const selectedLabel = selected ? families.find((family) => family.value === selected)?.label : "全部库存";
  return <main className={styles.shell}>
    <AnalyticsPageView pageId="compare" />
    <Link href="/inventory">← 返回口红柜</Link>
    <header><p>CHECK BEFORE YOU BUY</p><h1>买前查一查</h1><span>先看看已经拥有的颜色，再决定要不要带回家。</span></header>
    <nav>{families.map((family) => <TrackedCompareLink
      active={selected === family.value}
      key={family.value}
      value={family.value}
      label={family.label}
      count={all.items.filter((item) => family.value === "pending" ? !item.color_family : item.color_family === family.value).length}
    />)}</nav>
    <section className={styles.summary}><strong>{selectedLabel}</strong><span>{items.length} 支</span><em>{items.some((item) => item.days_left !== null && item.days_left <= 30) ? "其中有临近或已经到期的记录，请先核对期限。" : "当前分组暂无临近到期提示。"}</em></section>
    {items.length ? <section className={styles.grid}>{items.map((item) => <CompareCard key={item.id} item={item} selected={selected} />)}</section> : <section className={styles.empty}><h2>这个分组还没有记录</h2><p>{selected === "pending" ? "所有口红都已完成色系分类。" : "可以从口红柜中查看其他色系。"}</p></section>}
  </main>;
}

function CompareCard({ item, selected }: { item: LipstickItem; selected?: string }) {
  const name = buildDisplayName(item);
  const cover = item.images.find((image) => image.id === item.cover_image_id) ?? item.images[0];
  const colorLabel = families.find((family) => family.value === (item.color_family ?? "pending"))?.label ?? "待分类";
  const returnTo = `/compare${selected ? `?color=${selected}` : ""}`;
  return <Link className={styles.card} href={`/inventory/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}>
    <div className={styles.image}><ProductCover imageUrl={cover?.url} name={name} colorFamily={item.color_family} /></div>
    <div className={styles.cardBody}>
      <h2>{name}</h2>
      <div className={styles.tags}><span>{lifeLabels[item.lifecycle]}</span><span>{colorLabel}</span></div>
      <strong>{item.deadline ? `${item.deadline} · ${item.days_left! < 0 ? "已到期" : `剩余 ${item.days_left} 天`}` : "期限待补充"}</strong>
    </div>
  </Link>;
}
