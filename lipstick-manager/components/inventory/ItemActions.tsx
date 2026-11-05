"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ItemActions.module.css";
import { trackEvent } from "@/lib/analytics/client";
export function ItemActions({id,revision}:{id:string;revision:number}) {
  const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function discard(){if(!confirm("将这支口红移出当前库存？移出后不再计入库存和买前统计。"))return;setBusy(true);const response=await fetch(`/api/v1/items/${id}/discard`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision})});if(!response.ok){trackEvent({event_name:"save_result",page_id:"detail",properties:{outcome:"failure",mode:"discard"}});const body=await response.json().catch(()=>null);setError(body?.error?.message??"操作失败");setBusy(false);return}trackEvent({event_name:"save_result",page_id:"detail",properties:{outcome:"success",mode:"discard"}});router.push("/inventory");router.refresh()}
  return <div className={styles.wrap}>{error&&<p role="alert">{error}</p>}<div><a href={`/inventory/${id}/edit`}>编辑</a><button disabled={busy} onClick={discard}>移出</button></div></div>;
}
