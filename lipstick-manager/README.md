# 口红柜

单用户、移动端优先的口红库存管理 MVP。T1 的本地工程基线已通过，Vercel 预览部署尚待验证；当前不包含业务功能或业务数据。

## 本地环境

- Node.js 22 或更高版本
- pnpm 11.25.0

复制 `.env.example` 为 `.env.local` 并填写服务端变量。任何密钥都不得使用 `NEXT_PUBLIC_` 前缀。

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
