import { ManualIntakeForm } from "@/components/intake/ManualIntakeForm";
import { requirePageSession } from "@/lib/auth/session";
import { createInventoryService } from "@/lib/services/service-factory";

export default async function NewInventoryPage() {
  await requirePageSession();
  const draft = await createInventoryService().getOrCreateNewDraft();
  return <ManualIntakeForm draft={draft} />;
}
