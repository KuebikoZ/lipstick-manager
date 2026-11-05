"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildDisplayName, normalizeSeries } from "@/lib/domain/display-name";
import type { LipstickItem } from "@/lib/domain/item";
import { textures } from "@/lib/domain/inventory";
import styles from "./EditInventoryForm.module.css";

const fields = [["brand","品牌"],["series","系列"],["shade_code","色号"],["manufactured_on","实物生产日期"],["expires_on","实物到期日期"]] as const;
export function EditInventoryForm({ item }: { item: LipstickItem }) {
  const router = useRouter(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [lifecycle,setLifecycle]=useState(item.lifecycle);
  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const text=(key:string)=>String(formData.get(key)??"").trim()||null;
    const number=(key:string)=>{const value=text(key);return value?Number(value):null};
    const openedOn=lifecycle==="opened"?text("opened_on"):null; const expiresOn=text("expires_on");
    const brand=text("brand"); const identity={brand,series:normalizeSeries(brand,text("series")),shade_code:text("shade_code")};
    const payload={revision:item.revision,display_name:buildDisplayName(identity),...identity,color_family:text("color_family"),color_family_confirmed:true,color_description:item.color_description,texture:text("texture"),lifecycle,opened_on:openedOn,opening_precision:openedOn?"exact":"unknown",pao_months:lifecycle==="opened"?number("pao_months"):null,manufactured_on:text("manufactured_on"),shelf_life_months:item.shelf_life_months,expires_on:expiresOn,expiry_source:expiresOn?"explicit":null,note:text("note"),image_ids:item.images.map(x=>x.id),cover_image_id:item.cover_image_id,accepted_ai_task_id:null};
    const response=await fetch(`/api/v1/items/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const body=response.status===204?null:await response.json().catch(()=>null);
    if(!response.ok){setError(body?.error?.message??"保存失败，请稍后重试");setBusy(false);return}
    router.push(`/inventory/${item.id}`);router.refresh();
  }
  return <form className={styles.form} action={submit}>
    <header><a href={`/inventory/${item.id}`}>← 返回详情</a><p>EDIT YOUR COLLECTION</p><h1>编辑口红</h1></header>
    <fieldset><legend>持有状态</legend>{[["unknown","待补充"],["unopened","未开封"],["opened","已开封"]].map(([value,label])=><label className={styles.radio} key={value}><input type="radio" name="lifecycle" value={value} checked={lifecycle===value} onChange={()=>setLifecycle(value as LipstickItem["lifecycle"])}/>{label}</label>)}</fieldset>
    <section className={styles.grid}>{fields.map(([name,label])=><label key={name}>{label}<input name={name} type={name.includes("_on")?"date":"text"} maxLength={name==="series"?50:100} defaultValue={String(name==="series"?normalizeSeries(item.brand,item.series)??"":item[name]??"")}/></label>)}
      {lifecycle==="opened"&&<><label>开封日期<input name="opened_on" type="date" defaultValue={item.opened_on??""}/></label><label>开封后期限（月）<input name="pao_months" type="number" min="1" max="120" defaultValue={item.pao_months??""}/></label></>}
      <label>质地<select name="texture" defaultValue={item.texture??""}><option value="">待补充</option>{textures.map((texture)=><option key={texture}>{texture}</option>)}</select></label>
      <label>主色系<select name="color_family" defaultValue={item.color_family??""}><option value="">待分类</option><option value="nude">裸色系</option><option value="rose">豆沙色系</option><option value="orange">橘色系</option><option value="red">红色系</option><option value="plum">梅子色系</option><option value="brown">棕色系</option></select></label>
      <label className={styles.full}>备注<textarea name="note" defaultValue={item.note??""} maxLength={500}/></label></section>
    {error&&<p className={styles.error} role="alert">{error}</p>}<button disabled={busy}>{busy?"正在保存…":"保存修改"}</button>
  </form>;
}
