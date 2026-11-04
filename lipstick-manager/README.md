# 口红柜

单用户、移动端优先的口红库存管理 MVP。T1 工程基线、T2 单用户登录保护、T3 数据结构/私有图片边界/领域规则，以及 T4 手工新增与草稿保存均已通过对应阶段验收。剩余开发从 T6 开始，按 T6→T7→T8、T5→T9、T10、T11 四个批次推进；批次内逐项建立 checkpoint，批次完成后统一生成一次 Preview 并进行一次人工验收，T11 才进入 Production。

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
   `ADMIN_PASSWORD_HASH`。Next.js 会展开本地 env 文件中的 `$`，因此 `.env.local`
   里的 Argon2id 哈希必须把每个 `$` 写成 `\$`；Vercel 控制台中的值保持原始
   `$argon2id$...`，不要添加反斜杠。并同时配置 `APP_URL`、`AUTH_SECRET`、
   `ADMIN_USERNAME`、`SESSION_VERSION=1`。`AUTH_SECRET` 至少 32 个随机字符。
4. 不要把密码明文、哈希或任何 secret 写入 `.env.example`、源码或 Git。

登录限流使用 Supabase 的 `auth_login_attempts` 表；第 5 次失败后锁定 15 分钟。
修改密码或需要强制全部会话失效时，递增 `SESSION_VERSION`。

## T3 开发数据库与私有 Storage

仅在开发 Supabase 项目中，按文件名顺序执行：

1. `supabase/migrations/20261103220000_create_auth_login_attempts.sql`
2. `supabase/migrations/20261104090000_create_inventory_domain.sql`
3. `supabase/migrations/20261104130000_create_item_transaction.sql`

第二个 migration 建立领域表、约束、RLS 和私有 `lipstick-images` bucket。
第三个 migration 建立 T4 手工新增使用的原子事务函数：同一幂等键和相同请求会返回
同一条库存记录；相同幂等键对应不同请求时会拒绝覆盖；保存成功后清理新建草稿。
`.env.local` 中的 `SUPABASE_STORAGE_BUCKET` 必须为 `lipstick-images`。本期浏览器不持有
Supabase key；所有数据库和对象操作必须在 Auth.js 会话校验后的服务端路径中使用
`SUPABASE_SECRET_KEY`。不要在 T1–T10 对生产项目执行 migration。

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
