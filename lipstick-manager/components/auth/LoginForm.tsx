"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/auth/actions";
import { initialLoginState } from "@/lib/auth/login-state";
import styles from "./LoginForm.module.css";

type LoginFormProps = {
  returnTo: string;
};

export function LoginForm({ returnTo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className={styles.field}>
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={100}
          aria-describedby={state.fieldErrors.username ? "username-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.username)}
        />
        {state.fieldErrors.username ? (
          <span id="username-error" className={styles.fieldError}>
            {state.fieldErrors.username}
          </span>
        ) : null}
      </div>

      <div className={styles.field}>
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1_000}
          aria-describedby={state.fieldErrors.password ? "password-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors.password)}
        />
        {state.fieldErrors.password ? (
          <span id="password-error" className={styles.fieldError}>
            {state.fieldErrors.password}
          </span>
        ) : null}
      </div>

      {state.message ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
