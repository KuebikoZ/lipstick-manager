export type LoginActionState = {
  message: string | null;
  fieldErrors: {
    username?: string;
    password?: string;
  };
};

export const initialLoginState: LoginActionState = {
  message: null,
  fieldErrors: {},
};

export function messageForLoginCode(code: string | null): string {
  if (code === "rate_limited") return "尝试次数过多，请 15 分钟后再试";
  if (code === "dependency_unavailable") return "登录服务暂时不可用，请稍后重试";
  return "用户名或密码不正确";
}
