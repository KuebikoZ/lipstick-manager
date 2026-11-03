# 口红柜项目编码规则

本文件适用于 `product-workspace/` 全部内容。应用实现根目录是 `lipstick-manager/`；功能文档位于 `lipstick-manager/inventory/`。

## 1. 编码前必读

1. 开始任何编码任务前，先完整读取本文件，再阅读 `lipstick-manager/inventory/spec.md`、`lipstick-manager/inventory/contract.md` 中与任务相关的章节，并检查准备修改的现有代码。
2. 涉及页面、交互或业务流程时，同时核对当前 PRD 指针 `inventory/prd/current.yaml`、当前原型指针 `inventory/prototype/current.yaml` 及其指向的文件。原型最终行为以 `app/app.js` 后加载的 `app/overrides.js` 为准。
3. 优先级为：用户本轮明确要求 > `contract.md` 的数据、接口和模块契约 > `spec.md` 的技术方案 > 当前 PRD > 当前原型。原型决定页面、排序、筛选、详情和编辑交互；原型中的模拟实现不是生产契约。
4. 发现影响本次实现的冲突或缺失时，必须指出具体文件与章节/代码位置；停止受影响部分，其他无冲突工作可以继续。不得自行扩大产品范围。
5. `inventory/prototype/versions/**` 是只读设计与演示资料。不得直接改造成生产页面，也不得把其中的 `localStorage`、Data URL、模拟品牌、模拟 AI、演示状态选择器或定时器复制进生产实现。

## 2. 技术栈与真实状态

已确定的方案：

- Web：Next.js App Router + TypeScript，单体全栈应用。
- 样式与组件：CSS Modules + `app/globals.css` 设计变量；业务组件自行实现，不引入大型组件库。
- 表单与校验：React Hook Form + Zod。
- 服务端：Next.js Server Components、Route Handlers 和服务端应用服务。
- 数据：Supabase PostgreSQL Free；服务端 Supabase JS Client；图片存 Supabase 私有 Storage。
- 身份验证：Auth.js Credentials + JWT 会话；固定管理员账号，不开放注册。
- 状态：服务端数据以数据库为准；筛选/排序放 URL query；表单局部状态用 React Hook Form；仅滚动位置等页面上下文可放 `sessionStorage`。
- AI：服务端 DeepSeek Adapter；`deepseek-flash` 负责视觉与结构化输出，Search/Fetch 负责检索。
- 测试与部署：Vitest 已用于单元测试；Testing Library 和 Playwright 留到对应功能任务安装。部署目标为 Vercel，Supabase 开发项目使用新加坡区域。

真实工程状态：T1 工程基线和 T2 单用户登录与全站保护已于 2026-11-03 通过本地、CI、Preview 和人工验收。T3 数据库结构、私有图片边界和期限/生命周期规则已于 2026-11-04 通过自动检查及开发 Supabase 人工验收；生产 migration 仍只允许在 T11 执行。当前使用 Node.js 22+、pnpm 11.25.0、Next.js 16、React 19、TypeScript 5.9、Zod 4、ESLint 9 和 Vitest 5，实际版本以 `package.json` 和 `pnpm-lock.yaml` 为准。React Hook Form、Testing Library 和 Playwright 尚未安装。新增依赖前说明用途，并确认现有依赖不能合理完成任务。不得为了未来需求增加 ORM、状态库、微服务、队列、Redis、角色系统或组件库。

## 3. 目录与模块规则

当前真实结构（空实现目录以 `.gitkeep` 保留）：

```text
product-workspace/
├─ AGENTS.md
├─ catalog.md
├─ registry.yaml
└─ lipstick-manager/                 # 应用实现根目录
   ├─ app/                           # App Router 页面、layout、Route Handlers
   ├─ components/
   │  ├─ ui/                         # 无业务含义的通用展示/反馈组件
   │  ├─ inventory/                  # 列表、详情、比较组件
   │  └─ intake/                     # 上传、表单、AI 建议与证据组件
   ├─ lib/
   │  ├─ auth/                       # 会话、固定账号验证、服务端守卫
   │  ├─ config/                     # 服务端环境变量解析与运行配置
   │  ├─ domain/                     # 纯领域类型、Zod schema、期限与状态规则
   │  ├─ services/                   # 用例编排与事务边界
   │  ├─ db/                         # Repository、Supabase 数据访问、事务映射
   │  ├─ storage/                    # 私有对象、签名 URL、文件验证和清理
   │  ├─ ai/providers/               # DeepSeek 模型/Search/Fetch 供应商适配
   │  └─ http/                       # 请求解析、响应 envelope、错误映射
   ├─ public/                        # 无敏感信息的静态资源
   ├─ supabase/migrations/           # 有序数据库 migration
   ├─ tests/
   │  ├─ unit/                       # 纯领域和组件单元测试
   │  ├─ integration/                # API、数据库、Storage、鉴权边界测试
   │  └─ e2e/                        # 真实用户流程与未授权访问测试
   └─ inventory/                     # 产品文档；不是生产源码目录
      ├─ prd/
      ├─ prototype/
      ├─ spec.md
      └─ contract.md
```

预定路由必须按 spec 放入：`app/(auth)/login`、`app/(protected)/inventory`、`app/(protected)/inventory/new`、`app/(protected)/inventory/[id]`、`app/(protected)/inventory/[id]/edit`、`app/(protected)/compare`；业务接口统一位于 `app/api/v1/**/route.ts`。未实现路由前不要创建空 `page.tsx` 或假响应。

依赖方向固定为：Page/Route Handler -> Auth guard -> `lib/services` -> `lib/domain`、`lib/db`、`lib/storage`、`lib/ai/providers`。Route Handler 只负责鉴权、解析、调用 service 和映射响应。React 组件不得访问数据库、Supabase secret key、模型 SDK 或服务端环境变量；`lib/auth`、`lib/config`、`lib/services`、`lib/db`、`lib/storage`、`lib/ai/providers` 和 `lib/http` 视为服务端模块，不得导入 Client Component。`lib/domain` 保持纯净，不依赖 React、HTTP 或供应商 SDK。

通用组件不得包含 `LipstickItem` 等业务概念；一旦组件理解库存、录入、期限或 AI 任务，就放入对应业务组件目录。CSS Module 与组件同目录，全局变量和 reset 放 `app/globals.css`。`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`tsconfig.json`、Next/Test 配置、`.env.example` 和 `.gitignore` 已位于应用根目录。

`lipstick-manager/AGENTS.md` 由 Next.js 16 在 `next dev` 时生成，用于提醒开发者查阅当前版本的 Next.js 本地文档；不要手工删除或改写其生成区块。

`.next/`、`node_modules/`、`coverage/`、`playwright-report/`、`test-results/` 及工具生成的数据库类型不得手工修改。数据库结构只通过 `supabase/migrations/` 变更。

## 4. 命名规则

- 文件和目录：路由及普通目录用 `kebab-case`；React 组件文件用 `PascalCase.tsx`，如 `LipstickCard.tsx`；领域工具文件用 `kebab-case.ts`，如 `deadline.ts`。
- 页面和组件：组件/类型 `PascalCase`；路由页面遵循 Next.js 固定名 `page.tsx`、`layout.tsx`、`route.ts`。
- 函数与变量：`camelCase`，如 `requireSession`、`calculateDeadline`；React Hook 以 `use` 开头。
- 类型和模型：`PascalCase`，如 `LipstickItem`、`ApiError`。不得另造与契约同义但不同名的模型。
- 接口：路径小写复数且放在 `/api/v1` 下，如 `/api/v1/items/:id`；Next.js 动态段写 `[id]`。
- JSON、query 和数据库领域字段：严格 `snake_case`，如 `opened_on`、`color_family`、`sort=expiry`。
- 状态值和错误码：完全复用 `contract.md`；枚举值使用小写 `snake_case`，错误码使用 `SCREAMING_SNAKE_CASE`。
- 环境变量：`SCREAMING_SNAKE_CASE`，只使用 spec 已列出的名字；敏感变量不得加 `NEXT_PUBLIC_`。
- 测试：单元/集成测试为 `*.test.ts` 或 `*.test.tsx`；Playwright 为 `*.spec.ts`。

除上述已确认规则外的新命名约定仅能作为建议；接口字段、状态值、错误码和数据模型以 `contract.md` 为唯一契约，不得自行改名。

## 5. 项目约束

- 当前是单用户 MVP，部署到公网且仅供本人使用；不开放注册。
- 移动端网页优先，同时保证桌面端基本可用。
- 除登录页和明确的健康检查外，受保护页面和全部业务接口必须在服务端校验身份。middleware 仅用于快速重定向，不能替代 Route Handler/Application Service 的会话校验。
- 服务端确定身份、权限和数据访问范围；前端输入不得决定数据归属。本期不设置 `owner_id` 或用户管理表。
- API Key、Supabase secret key、密码哈希、Auth secret 等只能存服务端环境变量；不得进入浏览器、源码、日志或 `NEXT_PUBLIC_*`。
- 结构化数据和草稿持久化到 PostgreSQL，图片持久化到私有 Storage；浏览器不得作为真实库存数据源。
- 不增加多用户、角色、组织、协作、计费、分享、历史浏览、恢复、推送、交易或精确色差功能；不把跨设备访问作为本期能力或验收项。
- 业务范围以当前 PRD、`spec.md` 和 `contract.md` 为准；接口、数据与模块冲突时以 `contract.md` 为准，页面交互以最新原型为准。

## 6. 编码规则

- TypeScript 开启 `strict`；禁止 `any` 穿过领域、服务和 API 边界。数据库输入、query、环境变量、文件元数据和 AI 输出必须在服务端用 Zod 校验。
- 组件和函数保持单一职责。期限、生命周期、当前持有、筛选/排序枚举等规则集中在 `lib/domain`，页面和组件不得复制业务判断。
- 前端校验只改善体验；鉴权、字段约束、日期规则、revision、幂等、文件头/大小/数量、Origin 和预算限制必须由服务端再次执行。
- API 使用 `contract.md` 的统一成功/错误 envelope 和状态码。错误必须可操作；不得吞错或在失败后显示成功。
- 页面必须显式处理 loading、初始空数据、筛选无结果、成功、读取/写入失败、会话过期和 revision 冲突。保存中禁重复提交；失败保留表单；成功后再跳转或刷新数据。
- AI 只能由用户点击触发；上传完成不得自动调用。AI 建议不得直接覆盖用户 dirty 字段或写入已确认库存；失败/超时始终保留手填路径。
- 移动端以 375px 为首要验收宽度，并覆盖 320/390/430px；触控目标至少 44x44px，间距至少 8px，适配 `env(safe-area-inset-bottom)`。虚拟键盘不得遮挡当前字段或提交操作；日期/数字使用合适的原生输入和 `inputMode`。键盘焦点可见，弹窗需锁定并归还焦点，错误不能只依赖颜色。
- 服务端日志只记录 `request_id`、操作名、item/task id、结果、耗时和错误类型。不得记录密码、Cookie、Auth secret、API Key、Supabase secret key、原图/签名 URL、备注、完整来源 URL、提示词或模型原始敏感正文。
- 优先复用现有实现，修改范围保持与任务一致，不增加功能或做无关重构。模拟数据只能进入测试 fixture，不得随生产启动自动写入。
- 修改数据结构、接口、枚举、状态值或错误码时，必须同步核对并按需更新 `contract.md`、`spec.md`、migration、客户端调用、fixture 和相关测试；页面/流程变化同时核对 PRD 与原型。不得让实现与契约静默分叉。

## 7. 验证要求

当前真实命令如下：

| 目的 | 命令 |
|---|---|
| 安装依赖 | `pnpm install --frozen-lockfile` |
| 本地启动 | `pnpm dev` |
| 代码检查 | `pnpm lint` |
| 类型检查 | `pnpm typecheck` |
| 单元/集成测试 | `pnpm test` |
| E2E 测试 | 待配置 |
| 环境变量校验 | `pnpm validate:env` |
| 构建 | `pnpm build` |
| 完整检查 | `pnpm check` |

工程初始化后，必须从真实 `package.json` scripts 和锁文件更新本节，不得凭习惯虚构 `npm`/`pnpm` 命令。每次代码修改后运行与改动相关的 lint、typecheck、测试和构建并报告实际命令、结果及未运行原因；涉及接口、数据模型或状态值时同时核对 `contract.md`。视觉改动至少检查 375px 与 1440px；鉴权改动同时验证未登录页面跳转和 API `401`。
