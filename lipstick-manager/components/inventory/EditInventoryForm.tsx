"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LipstickItem } from "@/lib/domain/item";
import styles from "./EditInventoryForm.module.css";

const fields = [["display_name","识别名称 *"],["brand","品牌"],["series","系列"],["shade_code","色号"],["color_description","颜色说明"],["texture","质地"],["opened_on","开封日期"],["pao_months","开封后期限（月）"],["manufactured_on","实物生产日期"],["shelf_life_months","未开封保质期（月）"],["expires_on","实物到期日期"]] as const;
export function EditInventoryForm({ item }: { item: LipstickItem }) {
  const router = useRouter(); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const text=(key:string)=>String(formData.get(key)??"").trim()||null;
    const number=(key:string)=>{const value=text(key);return value?Number(value):null};
    const openedOn=text("opened_on"); const expiresOn=text("expires_on");
    const payload={revision:item.revision,display_name:text("display_name"),brand:text("brand"),series:text("series"),shade_code:text("shade_code"),color_family:text("color_family"),color_family_confirmed:true,color_description:text("color_description"),texture:text("texture"),lifecycle:text("lifecycle"),opened_on:openedOn,opening_precision:openedOn?"exact":"unknown",pao_months:number("pao_months"),manufactured_on:text("manufactured_on"),shelf_life_months:number("shelf_life_months"),expires_on:expiresOn,expiry_source:expiresOn?"explicit":null,note:text("note"),image_ids:item.images.map(x=>x.id),cover_image_id:item.cover_image_id,accepted_ai_task_id:null};
    const response=await fetch(`/api/v1/items/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const body=response.status===204?null:await response.json().catch(()=>null);
    if(!response.ok){setError(body?.error?.message??"保存失败，请稍后重试");setBusy(false);return}
    router.push(`/inventory/${item.id}`);router.refresh();
  }
  return <form className={styles.form} action={submit}>
    <header><a href={`/inventory/${item.id}`}>← 返回详情</a><p>EDIT YOUR COLLECTION</p><h1>编辑口红</h1></header>
    <fieldset><legend>持有状态</legend>{[["unknown","待补充"],["unopened","未开封"],["opened","已开封"]].map(([value,label])=><label className={styles.radio} key={value}><input type="radio" name="lifecycle" value={value} defaultChecked={item.lifecycle===value}/>{label}</label>)}</fieldset>
    <section className={styles.grid}>{fields.map(([name,label])=><label key={name}>{label}<input name={name} type={name.includes("_on")?"date":name.includes("months")?"number":"text"} defaultValue={String(item[name]??"")} required={name==="display_name"}/></label>)}
      <label>主色系<select name="color_family" defaultValue={item.color_family??""}><option value="">待分类</option><option value="nude">裸色系</option><option value="rose">豆沙色系</option><option value="orange">橘色系</option><option value="red">红色系</option><option value="plum">梅子色系</option><option value="brown">棕色系</option></select></label>
      <label className={styles.full}>备注<textarea name="note" defaultValue={item.note??""} maxLength={500}/></label></section>
    {error&&<p className={styles.error} role="alert">{error}</p>}<button disabled={busy}>{busy?"正在保存…":"保存修改"}</button>
  </form>;
}
