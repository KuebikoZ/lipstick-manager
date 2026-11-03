"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { messageForLoginCode, type LoginActionState } from "@/lib/auth/login-state";
import { safeReturnTo } from "@/lib/auth/return-to";

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const username = formData.get("username");
  const password = formData.get("password");
  const fieldErrors: LoginActionState["fieldErrors"] = {};

  if (typeof username !== "string" || !username.trim()) {
    fieldErrors.username = "请输入用户名";
  }
  if (typeof password !== "string" || !password) {
    fieldErrors.password = "请输入密码";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { message: "请检查填写内容", fieldErrors };
  }

  const returnTo = safeReturnTo(formData.get("returnTo"));

  try {
    const responseUrl = await signIn("credentials", {
      username,
      password,
      redirect: false,
      redirectTo: returnTo,
    });
    const resultUrl = new URL(responseUrl, process.env.APP_URL);
    if (resultUrl.searchParams.has("error")) {
      return {
        message: messageForLoginCode(resultUrl.searchParams.get("code")),
        fieldErrors: {},
      };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      if (error instanceof CredentialsSignin) {
        return { message: messageForLoginCode(error.code), fieldErrors: {} };
      }

      return { message: messageForLoginCode(null), fieldErrors: {} };
    }
    throw error;
  }

  redirect(returnTo);
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
