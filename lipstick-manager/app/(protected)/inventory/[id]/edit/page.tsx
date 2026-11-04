import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { createInventoryService } from "@/lib/services/service-factory";
import { InventoryNotFoundError } from "@/lib/services/inventory-service";
import { EditInventoryForm } from "@/components/inventory/EditInventoryForm";
export default async function EditPage({params}:{params:Promise<{id:string}>}) {
  await requirePageSession();
  const item = await loadItem((await params).id);
  return <EditInventoryForm item={item}/>;
}
async function loadItem(id:string){try{return await createInventoryService().getItem(id)}catch(error){if(error instanceof InventoryNotFoundError)notFound();throw error}}
