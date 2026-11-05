import { ManualIntakeForm } from "@/components/intake/ManualIntakeForm";
import { requirePageSession } from "@/lib/auth/session";
import { createInventoryService } from "@/lib/services/service-factory";
import { AnalyticsPageView } from "@/components/analytics/AnalyticsPageView";

export default async function NewInventoryPage() {
  await requirePageSession();
  const draft = await createInventoryService().getOrCreateNewDraft();
  return <><AnalyticsPageView pageId="intake_new" intakeId={draft.id} /><ManualIntakeForm draft={draft} /></>;
}
