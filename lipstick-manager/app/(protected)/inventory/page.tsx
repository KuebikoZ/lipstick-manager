import { requirePageSession } from "@/lib/auth/session";
import { createInventoryService } from "@/lib/services/service-factory";
import { InventoryView } from "@/components/inventory/InventoryView";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageSession();
  const raw = await searchParams;
  const query = Object.fromEntries(Object.entries(raw).map(([key,value]) => [key, typeof value === "string" ? value : undefined]));
  const data = await createInventoryService().listItems(query);
  return <InventoryView data={data} query={query}/>;
}
