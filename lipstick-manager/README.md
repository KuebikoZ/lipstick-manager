# 口红柜

单用户、移动端优先的口红库存管理 MVP。T1 工程基线已通过本地检查、GitHub Actions、Vercel 部署和人工验收；当前不包含业务功能或业务数据。

## 本地环境

- Node.js 22 或更高版本
- pnpm 11.25.0

复制 `.env.example` 为 `.env.local` 并填写服务端变量。任何密钥都不得使用 `NEXT_PUBLIC_` 前缀。

## T2 固定账号配置

1. 在 Supabase SQL Editor 执行
   `supabase/migrations/20261103220000_create_auth_login_attempts.sql`。
2. 使用至少 12 位密码生成 Argon2id 哈希；命令只输出哈希，不会把明文写入文件：

   ```bash
   read -s "ADMIN_PASSWORD?Password: " && echo && \
     ADMIN_PASSWORD="$ADMIN_PASSWORD" pnpm auth:hash && unset ADMIN_PASSWORD
   ```

3. 将输出写入本地 `.env.local` 和 Vercel 服务端环境变量
   `ADMIN_PASSWORD_HASH`，并同时配置 `APP_URL`、`AUTH_SECRET`、
   `ADMIN_USERNAME`、`SESSION_VERSION=1`。`AUTH_SECRET` 至少 32 个随机字符。
4. 不要把密码明文、哈希或任何 secret 写入 `.env.example`、源码或 Git。

登录限流使用 Supabase 的 `auth_login_attempts` 表；第 5 次失败后锁定 15 分钟。
修改密码或需要强制全部会话失效时，递增 `SESSION_VERSION`。

## 命令

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

健康检查：`GET /api/health`。
