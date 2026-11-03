import { requirePageSession } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";

export default async function ProtectedHomePage() {
  const session = await requirePageSession();

  return (
    <main className="baseline-shell">
      <section className="baseline-card" aria-labelledby="baseline-title">
        <p className="eyebrow">LIPSTICK MANAGER</p>
        <h1 id="baseline-title">登录保护已启用</h1>
        <p>当前已使用固定管理员账号登录。库存业务功能将在后续任务中实现。</p>
        <p className="session-note">当前账号：{session.user.name}</p>
        <form action={logoutAction}>
          <button type="submit">退出登录</button>
        </form>
      </section>
    </main>
  );
}
