import Link from "next/link";
import type { InventoryListResult, LipstickItem } from "@/lib/domain/item";
import { buildDisplayName } from "@/lib/domain/display-name";
import { ProductCover } from "./ProductCover";
import styles from "./InventoryView.module.css";

const colors: Record<string, string> = { nude: "裸色系", rose: "豆沙色系", orange: "橘色系", red: "红色系", plum: "梅子色系", brown: "棕色系" };
const life: Record<string, string> = { opened: "已开封", unopened: "未开封", unknown: "待补充" };

function params(query: Record<string, string | undefined>) {
  const value = new URLSearchParams(Object.entries(query).flatMap(([key, entry]) => entry ? [[key, entry]] : []));
  return value.toString();
}

export function InventoryView({ data, query }: { data: InventoryListResult; query: Record<string, string | undefined> }) {
  const filtered = Boolean(query.life || query.time || query.color || query.brand);
  const returnTo = `/inventory${params(query) ? `?${params(query)}` : ""}`;
  return <main className={styles.shell}>
    <header className={styles.header}><div><p>YOUR PERSONAL COLLECTION</p><h1>我的口红柜</h1><span>让每一抹喜欢，都被好好记得。</span></div><nav><Link href="/compare">买前查一查</Link><Link className={styles.primary} href="/inventory/new">＋ 录入口红</Link></nav></header>
    <section className={styles.stats} aria-label="库存概览">
      <Link href="/inventory"><span>当前持有</span><strong>{data.summary.current}</strong><small>支</small></Link>
      <Link href="/inventory?life=opened"><span>已开封</span><strong>{data.summary.opened}</strong><small>支</small></Link>
      <Link href="/inventory?time=days_0_30"><span>30天内到期</span><strong>{data.summary.due_0_30}</strong><small>支</small></Link>
    </section>
    <form key={params(query)} className={styles.filters} action="/inventory">
      <label>期限状态<select name="time" defaultValue={query.time ?? ""}><option value="">全部期限</option><option value="over_180">超过180天</option><option value="days_91_180">91–180天</option><option value="days_31_90">31–90天</option><option value="days_0_30">30天内到期（含今日）</option><option value="expired">已到期</option><option value="unknown">期限待补充</option></select></label>
      <label>开封状态<select name="life" defaultValue={query.life ?? ""}><option value="">全部状态</option><option value="opened">已开封</option><option value="unopened">未开封</option><option value="unknown">待补充</option></select></label>
      <label>色系<select name="color" defaultValue={query.color ?? ""}><option value="">全部色系</option>{Object.entries(colors).map(([v,l])=><option key={v} value={v}>{l}</option>)}<option value="pending">待分类</option></select></label>
      <label>品牌<select name="brand" defaultValue={query.brand ?? ""}><option value="">全部品牌</option>{data.brands.map((brand)=><option key={brand}>{brand}</option>)}</select></label>
      <label>排序<select name="sort" defaultValue={query.sort ?? "expiry"}><option value="expiry">到期日期优先</option><option value="new">最近录入</option><option value="brand">按品牌</option><option value="color">按色系</option></select></label>
      <button type="submit">应用</button>{filtered && <Link href="/inventory">清除筛选</Link>}
    </form>
    <div className={styles.count}>{filtered ? "筛选结果" : "全部口红"} · {data.items.length} 支</div>
    {data.items.length ? <section className={styles.grid}>{data.items.map((item)=><Card key={item.id} item={item} returnTo={returnTo}/>)}</section> : <section className={styles.empty}><h2>{data.summary.current ? "没有符合条件的口红" : "给喜欢的口红，一个位置"}</h2><p>{data.summary.current ? "试试调整筛选条件。" : "开始整理你的收藏。"}</p><Link className={styles.primary} href={data.summary.current ? "/inventory" : "/inventory/new"}>{data.summary.current ? "清除筛选" : "录入第一支"}</Link></section>}
  </main>;
}

function Card({ item, returnTo }: { item: LipstickItem; returnTo: string }) {
  const name = buildDisplayName(item);
  const cover = item.images.find((image) => image.id === item.cover_image_id) ?? item.images[0];
  return <Link className={styles.card} href={`/inventory/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}>
    <div className={styles.image}><ProductCover imageUrl={cover?.url} name={name} colorFamily={item.color_family} /></div>
    <div><h2>{name}</h2><div className={styles.tags}><span>{life[item.lifecycle]}</span><span>{colors[item.color_family ?? ""] ?? "待分类"}</span></div><strong>{item.deadline ? `${item.deadline} · ${item.days_left! < 0 ? "已到期" : `剩余 ${item.days_left} 天`}` : "期限待补充"}</strong></div>
  </Link>;
}
