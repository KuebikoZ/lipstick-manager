import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getValidSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/return-to";
import styles from "./page.module.css";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getValidSession();
  const { callbackUrl } = await searchParams;
  const returnTo = safeReturnTo(callbackUrl);

  if (session) redirect(returnTo);

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-title">
        <p className={styles.eyebrow}>LIPSTICK MANAGER</p>
        <h1 id="login-title">登录口红柜</h1>
        <p className={styles.description}>仅限固定管理员使用，不提供注册入口。</p>
        <LoginForm returnTo={returnTo} />
      </section>
    </main>
  );
}
