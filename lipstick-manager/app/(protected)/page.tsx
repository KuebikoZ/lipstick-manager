import { requirePageSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import Link from "next/link";

export default async function ProtectedHomePage() {
  const session = await requirePageSession();

  return (
    <main className="baseline-shell">
      <section className="baseline-card" aria-labelledby="baseline-title">
        <p className="eyebrow">LIPSTICK MANAGER</p>
        <h1 id="baseline-title">我的口红柜</h1>
        <p>现在可以先用手工方式记录口红；无需上传图片也能保存。</p>
        <p className="session-note">当前账号：{session.user.name}</p>
        <Link className="primary-link" href="/inventory/new">新增一支口红</Link>
        <form action={logoutAction}>
          <button type="submit">退出登录</button>
        </form>
      </section>
    </main>
  );
}
