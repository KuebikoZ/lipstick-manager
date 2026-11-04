import { after } from "next/server";
import { getValidSession } from "@/lib/auth/session";
import { errorResponse, dataResponse } from "@/lib/http/api-response";
import { invalidOriginResponse, inventoryErrorResponse, readJson } from "@/lib/http/inventory-api";
import { createAITaskService } from "@/lib/services/ai-service-factory";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!(await getValidSession())) return errorResponse(401, "UNAUTHORIZED", "请先登录");
  const originError = invalidOriginResponse(request); if (originError) return originError;
  try {
    const task = await createAITaskService().create(await readJson(request));
    after(async () => { await createAITaskService().run(task.task_id); });
    return dataResponse(task, 202);
  } catch (error) { return inventoryErrorResponse(error); }
}
