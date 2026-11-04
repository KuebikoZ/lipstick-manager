# 口红柜库存管理 MVP 技术规格

> 文档状态：待评审  
> 编制日期：2026-11-02  
> 依据：PRD `20261102-174301-9f3b2a`、交互原型 `interactive-20261102-01` 及本轮项目约束  
> 用途：直接指导开发；本文不包含业务代码，不代表已完成实现或验收

## 0. 决策摘要与实现边界

本期实现一个部署在公网、仅供一个固定用户使用的响应式 Web 应用。前端、页面服务和数据接口统一使用 Next.js；结构化数据存入 PostgreSQL，图片存入私有对象存储。采用固定管理员账号登录，不开放注册。所有页面（登录页和健康检查除外）与所有业务接口都在服务端校验会话；数据库、对象存储和大模型 API 密钥仅存在服务端。本期不设计或验收跨设备同步/访问能力。

原型是功能、交互和视觉的最终依据，但不是可直接上线的工程：其中 `localStorage`、Data URL 图片、演示品牌、恢复演示数据、模拟 AI 下拉框和 `setTimeout` 识别替换为服务端持久化与真实大模型 API。最新 PRD 已同步公网固定账号和服务端持久化约束；不实现或验收跨设备访问能力。

开发按两条可独立验收的能力推进：

1. 完成真实的手工录入、服务端存储、原型规定的筛选排序、详情、编辑和移出/删除闭环。
2. 接入真实大模型 API 完成图片识别与资料建议；模型失败时降级为手工录入，不能用原型模拟结果冒充真实能力。

## 1. 本期范围

### 1.1 核心流程

1. 用户访问公网地址，未登录时只能进入 `/login`。
2. 使用固定管理员凭据登录；成功后在当前设备保存安全会话。
3. 在“我的口红柜”查看当前持有库存、概览、筛选和排序。
4. 新增一支口红：填写开封信息与产品字段，可上传 0–3 张图片；图片上传后可并行发起 AI 识别，AI 结果只进入建议区，不覆盖用户已填字段。
5. 用户确认字段后保存；服务端写入数据库与图片引用，跳转详情。
6. 在详情查看期限、计算依据和图片；可进入编辑、移出库存或永久删除。开封状态通过编辑表单修改。
7. 在“买前查一查”按六个固定色系查看当前持有数量与具体条目；从详情返回时保留原筛选和滚动位置。

### 1.2 页面与功能对应

| 页面 | 路由 | 本期功能 |
|---|---|---|
| 登录 | `/login` | 固定账号登录、错误与限流提示；不提供注册和找回密码 |
| P-001 我的口红柜 | `/inventory` | 当前持有统计、期限/开封/色系/品牌筛选、排序、空状态、卡片列表、新增入口 |
| P-002 口红详情 | `/inventory/[id]` | 图片、字段、期限时间轴与依据、编辑、移出库存、删除 |
| P-003 买前查一查 | `/compare` | 全部/六色系选择、分组统计、当前持有卡片、待分类提示 |
| P-004 录入 | `/inventory/new` | 图片、手填、AI 建议、日期与备注、草稿、保存 |
| P-004 编辑 | `/inventory/[id]/edit` | 编辑全部允许字段、版本冲突处理、保存失败恢复 |

根路径 `/` 在已登录时重定向 `/inventory`，未登录时重定向 `/login`。不存在或无权访问的详情统一返回 404 页面，不泄露记录是否存在。

### 1.3 本期不做

- 开放注册、多用户、角色/权限后台、协作、分享、计费。
- 社交、交易、购买跳转、回购/使用次数、推送通知、历史记录浏览和恢复。
- 精确色差查重、上唇效果预测、实物安全判断、自动购买建议。
- 全网商品库、批号推算、未经核对的日期推断、网页商品日期作为当前实物到期日。
- 离线优先/PWA、跨设备同步/访问保证、自动多端草稿合并、导入导出。
- 将原型演示数据写入真实库存，或在生产环境提供“恢复演示数据/模拟 AI 结果”控制项。

## 2. 技术架构

### 2.1 推荐技术栈

当前目录只有 HTML/CSS/JavaScript 原型，没有可复用的生产工程或依赖清单，因此采用一套单仓、低运维方案：

| 层 | 选择 | 理由 |
|---|---|---|
| Web 全栈 | Next.js（App Router）+ TypeScript | 页面、服务端渲染、接口和鉴权中间层在一个工程内，减少独立后端部署 |
| 样式 | CSS Modules + 全局设计变量 | 可直接迁移原型视觉变量；不为 MVP 引入组件库 |
| 表单/校验 | React Hook Form + Zod | 前后端复用字段约束；处理条件字段和就近错误 |
| 服务端数据访问 | Supabase JS Server Client | 连接托管 PostgreSQL 与私有 Storage；不在浏览器暴露 secret key |
| 数据库 | Supabase PostgreSQL（Free） | 初期开发无需维护数据库主机，可验证服务端持久化；不承诺长期在线或生产级备份 |
| 图片 | Supabase Storage 私有 bucket | 不把图片塞入数据库或 localStorage；通过短期签名 URL 展示 |
| 登录 | Auth.js Credentials + JWT 会话 | 单固定用户，无注册流程和用户表也可工作；页面/API 共用服务端会话校验 |
| AI | DeepSeek API 服务端 Adapter | `deepseek-flash`（V4.1 Flash）负责图片识别和结构化输出；DeepSeek Search/Fetch API 负责资料检索；密钥只留在服务端 |
| 部署 | Vercel + Supabase | 自动 HTTPS、部署步骤少、适合个人低流量 MVP；Supabase 选新加坡区域 |
| 测试 | Vitest + Testing Library + Playwright | 覆盖日期规则、接口、关键页面与手机视口端到端流程 |

不选择纯静态站点加 `localStorage`，因为无法满足服务端密钥、可靠持久化和受保护数据接口；不拆微服务、消息队列或独立搜索服务，因为单用户 MVP 没有对应复杂度。

### 2.2 部署拓扑与访问保护

```text
手机/桌面浏览器
  └─ HTTPS → Vercel / Next.js
       ├─ Auth.js：验证固定账号，签发 HttpOnly 会话 Cookie
       ├─ Server Components / Route Handlers：每次读取或写入前校验会话
       ├─ AI Adapter：仅服务端读取 AI_API_KEY
       └─ Supabase（服务端凭据）
            ├─ PostgreSQL：记录、草稿、任务、证据
            └─ Private Storage：原始/处理后的口红图片
```

安全要求：

- `middleware` 负责快速重定向，但不是唯一防线。每个业务 Server Action/Route Handler 必须再次调用 `requireSession()`；未授权统一返回 `401`，无 CSRF/来源校验的状态变更返回 `403`。
- 固定登录名由 `ADMIN_USERNAME` 配置；密码只保存 Argon2id 哈希 `ADMIN_PASSWORD_HASH`，不保存明文。登录失败按 IP 与用户名组合限流（例如 15 分钟 5 次），响应不区分用户名或密码错误。
- 登录限流使用现有 PostgreSQL 中的最小 `auth_login_attempts` 表持久化计数，不引入 Redis 或独立限流服务。表只保存 IP HMAC、用户名 HMAC、窗口、失败次数和锁定时间，不保存明文 IP、用户名或密码。
- 会话 Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`，建议 30 天失效；修改密码/密钥后通过递增 `SESSION_VERSION` 使旧会话失效。
- 所有变更接口只接受同源请求；校验 `Origin`，使用 Auth.js 自带 CSRF 保护处理登录。设置 CSP、`X-Content-Type-Options: nosniff`、`Referrer-Policy: same-origin`、`frame-ancestors 'none'`。
- Storage bucket 为 private。客户端不获得 Supabase secret key；图片读取由服务端生成 5–10 分钟签名 URL，上传采用服务端校验后的短期签名上传或小文件直传 Route Handler。
- AI 请求、数据库、Storage 和错误日志均不得记录登录密码、原图、备注或完整模型提示。外部网页/图片文字一律作为不可信数据，不可改变工具权限。
- `/api/health` 只返回应用是否存活，不检查或泄露数据库、密钥和版本细节。其余 `/api/**` 全部要求会话。

### 2.3 持久化与备份

- PostgreSQL 是真实数据唯一来源；Storage 保存图片二进制，表中只保存 bucket/path/元数据。
- 浏览器 `sessionStorage` 只保存列表筛选、来源页和滚动位置；`localStorage` 不保存真实库存、令牌或图片。未保存草稿写服务端 `drafts` 表，仅要求当前使用环境刷新后可恢复，不实现跨设备草稿合并。
- 本期只考虑初期开发与验证，使用 Supabase Free，不开通 Pro，也不把长期在线、生产 SLA 或自动备份作为本期承诺。Free 项目可能因一周不活跃暂停；恢复后继续使用。项目选择新加坡 `ap-southeast-1`，并在真实手机网络下验证可访问性。
- 开发期间按需手工导出 PostgreSQL 数据；Storage 图片不包含在数据库备份中，如需保留测试样本应单独下载。本期至少验证一次数据库导出和图片下载，不要求生产级灾备恢复演练。
- 删除记录使用硬删除：事务内删除业务记录及关联元数据，事务提交后幂等删除 Storage 图片；用户界面明确提示不可恢复，MVP 不提供回收站。
- 图片上传成功但记录保存失败时标记为临时对象；定时清理超过 24 小时且未被记录或草稿引用的对象。记录提交成功后再将对象状态改为 attached。

## 3. 页面与交互

### 3.1 路由与渲染策略

| 路由 | 渲染/数据策略 | 关键异常 |
|---|---|---|
| `/login` | 服务端检查已有会话；客户端表单提交 | 凭据错误、限流、网络错误 |
| `/inventory` | 服务端首屏查询；筛选/排序写入 URL query | 加载、空库存、无筛选结果、读取失败 |
| `/inventory/new` | 服务端加载未完成新增草稿 | 草稿恢复、上传失败、AI 失败、保存失败 |
| `/inventory/[id]` | 服务端按 id 查询 | 404、图片加载失败、写操作失败 |
| `/inventory/[id]/edit` | 服务端查询记录和对应编辑草稿 | revision 冲突、原记录已删除 |
| `/compare` | 服务端查询当前持有记录并聚合 | 空分组、全部为空、待分类提示 |

筛选 query 命名固定为 `life`、`time`、`color`、`brand`、`sort`。返回详情时把来源 URL 编码为受控的内部 `returnTo`，只允许 `/inventory` 或 `/compare` 开头，防止开放重定向。滚动位置使用 `sessionStorage`，key 包含完整列表 URL。

### 3.2 组件划分

- `AppHeader`：品牌、两项主导航、退出登录；移动端转为底部固定导航，避免挤压标题。
- `InventorySummary`：当前持有、已开封、30 天内到期三个可点击统计。
- `InventoryFilters`：期限状态、开封状态、色系、品牌四项筛选，以及最近录入/到期日期优先/按品牌/按色系四项排序；交互和排列以最新原型为准。
- `LipstickCard`：封面、名称、品牌/色号、色系、质地、生命周期、期限标签。
- `ColorFamilySelector` / `ColorFamilyGroup`：全部与六色系固定顺序；待分类单独入口。
- `ImageUploader`：文件选择/拍照、预览、删除、封面排序、上传进度与错误。
- `LipstickForm`：开封信息、身份、色系、质地、日期、备注；新增和编辑复用。
- `AISuggestionPanel`：任务阶段、候选、证据、逐字段采用/忽略、取消/重试。
- `DeadlinePanel`：截止日、剩余天数、依据和三节点时间轴；详情页始终显示“录入—开封—到期”，缺值显示“尚未开封／未记录／待补充”。
- `EvidenceList`：字段、来源类型、摘录、来源链接/图片索引和检索时间。
- `ConfirmDialog`、`InlineError`、`Toast`、`EmptyState`、`Skeleton`：共享反馈。

### 3.3 状态管理

- 服务端状态以数据库为准；Server Components 负责首屏读取，写操作成功后 `revalidatePath` 对应页面。
- 表单局部状态由 React Hook Form 管理；用户修改字段后记录 `dirtyFields`，AI 返回时仅填充仍为空且未 dirty 的字段。所有 AI 值保存在 suggestion 中，必须由用户采用后才进入 confirmed fields。
- 列表筛选、排序放 URL，刷新后仍可复现；四个筛选维度取交集。默认按有效到期日期升序，已到期最前、今日及未来由近到远、期限未知置后；`new` 才按最近录入降序；品牌按中文 locale；色系按固定枚举顺序。
- 录入/编辑草稿每次字段停止输入 800–1200ms 后防抖保存；导航离开前若最后一次保存未完成，显示保留/放弃确认。刷新只恢复草稿，不自动恢复付费 AI 调用。
- 图片上传完成后只进入“图片就绪”，不自动调用外部 API。用户点击“开始识别”后，首次先显示外传说明并取得同意，再创建 AI 任务；后续仍由用户点击触发。重新识别使用明确的“重新获取/重试”操作。AI 任务以 `task_id + suggestion_version` 识别；取消后任务置 `cancelled`，迟到响应不得写入草稿建议。
- 保存使用 `Idempotency-Key` 防双击重复新增；编辑提交携带 `revision` 做乐观锁。

### 3.4 移动端、触控与键盘

- 以 375px 作为首要验收宽度，同时覆盖 320、390、430、768、1024、1440px；页面不出现横向滚动。
- 小于 750px：严格沿用最新原型响应式布局——底部固定两项主导航、单列卡片/表单、四项筛选面板改为单列、详情改为单列，表单底部操作栏固定在导航上方。大于等于 750px：顶部导航、两列卡片和详情双列；筛选面板在 751–850px 为两列、850px 以上为四列。
- 所有可点击区域最小 44×44px；按钮间留至少 8px；上传支持 `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment">`，仍允许从相册选图。
- 日期字段在移动端使用原生日期输入；数值键盘设置 `inputMode="numeric"`。输入聚焦时 sticky 操作栏不得遮挡字段，页面随虚拟键盘滚动。
- 完整键盘路径：导航→筛选→卡片→表单→对话框；焦点环清晰可见。弹窗打开后焦点锁定，关闭后回到触发按钮。错误使用文本和图标，不只依赖颜色，并用 `aria-describedby`/`role="alert"` 关联。
- 图片提供有意义的替代文本；装饰插画使用空 `alt`。加载骨架不向读屏重复播报；长任务阶段通过 `aria-live="polite"` 更新。

### 3.5 必要状态与恢复

- 初次空库存与“筛选无结果”必须使用不同文案和动作。
- 网络断开：已渲染页面可继续查看，但任何写入明确失败；草稿保留在页面内并重试，不显示虚假成功。
- 上传：逐文件显示等待、上传中、成功、失败；一个文件失败不移除其他成功文件。
- AI：`queued / recognizing / needs_confirmation / researching / partial / complete / failed / cancelled / timed_out`；失败和超时始终保留手填入口。
- 保存中禁用重复提交；失败保留表单和图片引用；成功后再跳转。
- 版本冲突返回最新 `revision` 与通用提示，不自动覆盖；页面提供“保留当前草稿并重新载入”。
- 图片签名 URL 过期时重新请求；对象不存在时显示占位，不影响其余详情。
- 会话过期：读取跳转登录；写操作返回 401 后保留当前客户端表单，登录成功再由用户重试，不能自动重复提交。

## 4. 数据与接口

### 4.1 枚举与通用约定

- `color_family`: `nude | rose | orange | red | plum | brown | null`；`null` 表示待分类，不新增第七色系。
- `lifecycle`: `unopened | opened | unknown | discarded`；前三项计入当前持有。最新版原型没有“已用完”独立操作，因此不定义 `finished`。
- `opening_precision`: `exact | unknown`。
- `expiry_source`: `explicit | calculated | null`。
- 日期字段为 ISO `YYYY-MM-DD`，按用户时区 `Asia/Shanghai` 的日历日解释；时间戳为 UTC ISO 8601。
- 主键用 UUID；API JSON 使用 `snake_case`，前端领域对象也保持同名，避免双重映射。
- 所有字符串保存前 trim；展示时 React 默认转义。色号作为字符串保存，保留前导零。

### 4.2 表结构

#### `lipstick_items`

| 字段 | 类型/约束 | 说明 |
|---|---|---|
| `id` | uuid PK | 单支实物 |
| `revision` | int not null default 1 | 乐观锁，每次成功更新 +1 |
| `display_name` | varchar(100) not null | 1–100 字符 |
| `brand`,`series`,`shade_code` | varchar(100) null | 产品身份 |
| `color_family` | enum null | 六色系；null=待分类 |
| `color_description`,`texture` | varchar(200) null | 描述与质地 |
| `lifecycle` | enum not null | 默认 `unknown` |
| `opened_on` | date null | 仅 exact 参与计算 |
| `opening_precision` | enum not null | 默认 `unknown` |
| `pao_months` | smallint null check 1..120 | 开封后使用月数 |
| `manufactured_on` | date null | 不晚于用户本地今天 |
| `shelf_life_months` | smallint null check 1..240 | 未开封保质期 |
| `expires_on` | date null | 当前实物明确/确认到期日 |
| `expiry_source` | enum null | explicit/calculated |
| `note` | varchar(500) null | 用户备注 |
| `cover_image_id` | uuid null | 引用当前条目的图片 |
| `created_at`,`updated_at` | timestamptz not null | 服务端生成 |

`deadline`、`days_left`、`deadline_basis` 不持久化，统一在服务端领域函数中派生，避免跨午夜或规则升级导致脏数据。查询排序时可由 SQL expression/view 计算截止日。

#### `lipstick_images`

`id`, `item_id null`, `draft_id null`, `storage_path unique`, `mime_type`, `byte_size`, `width`, `height`, `sha256`, `position 0..2`, `status(temp|attached)`, `created_at`。图片必须属于 item 或 draft 之一；单个 item/draft 最多三张。允许类型 JPG/PNG/WebP，单张原始文件不超过 10MB；服务端通过文件头检测 MIME，不能只信客户端扩展名。

#### `drafts`

`id`, `kind(new|edit)`, `item_id null`, `base_revision null`, `payload jsonb`, `suggestion_version int`, `updated_at`, `expires_at`。单用户最多保留一个新增草稿；每个 item 最多一个编辑草稿。`payload` 仍需通过同一 Zod schema 校验，不接受任意 JSON 直写。90 天未更新草稿可清理，清理前不需要产品内提醒。

#### `ai_tasks`

`id`, `draft_id`, `item_id null`, `status`, `workflow_version`, `schema_version`, `provider`, `model`, `input_image_ids`, `result jsonb`, `error_code`, `duration_ms`, `usage_json`, `estimated_cost_cny`, `cancelled_at`, `created_at`, `updated_at`。保存 item 时在同一事务中把被采用建议对应的 task 绑定到 `item_id`，Evidence 由 task 间接关联 item；不在此表保存原图、完整提示词或用户备注。

#### `evidence`

`id`, `ai_task_id`, `field_name`, `kind(image|official|authorized_store|user)`, `url null`, `image_id null`, `excerpt varchar(500) null`, `retrieved_at null`。网页来源必须有真实 URL；图片证据必须引用本次上传图片。详情只展示与已确认字段关联且仍有效的证据。硬删除 item 时删除关联的 AI task/evidence 元数据和图片对象。

#### `auth_login_attempts`

`key_hash`（IP HMAC＋用户名 HMAC 的不可逆组合键）、`window_started_at`、`failure_count`、`locked_until`、`updated_at`。只用于固定账号登录限流；成功登录后清除对应记录，过期窗口定期清理。不建立用户、角色或组织表。

### 4.3 核心校验与期限规则

- 保存最低要求：`display_name` 非空、`lifecycle` 合法；`color_family=null` 是用户显式确认的“待分类”，接口用 `color_family_confirmed: true` 区分遗漏与确认。
- `opened` 可不提供 `opened_on`，此时 `opening_precision=unknown`；若提供则必须 `exact` 且不得晚于今天。非 `opened` 状态不参与 PAO 截止计算。
- `manufactured_on` 不得晚于今天；月数字段必须为正整数并在表约束范围内。
- `calculated_expires_on = add_calendar_months(manufactured_on, shelf_life_months)`；目标月无同日时取月末。
- 明确 `expires_on` 与推算值冲突时不采用推算值，并返回字段级冲突要求用户清除或确认；不得静默选较晚日期。
- `pao_deadline = add_calendar_months(opened_on, pao_months)`（仅 `opened + exact`）。`effective_expiry` 优先明确 `expires_on`，否则仅在生产日期和已确认未开封保质期齐全时使用推算值。
- `deadline = min(pao_deadline, effective_expiry)`；只有一项时用该项；均无则 null。若 `opened_on > effective_expiry`，拒绝保存并提示核对。
- `days_left = deadline - local_today`。区间严格按 PRD：`>180`、`91..180`、`31..90`、`1..30`、`0`、`<0`；统计“30 天内到期”包含 `0..30`，不含已到期。
- 当前库存只含 `unopened/opened/unknown`；`discarded` 不出现在列表和买前页。详情“移出库存”统一将状态改为 `discarded`，本期不提供历史入口或恢复。永久删除不是 lifecycle 状态，确认后硬删除业务记录、关联元数据和图片。

上述日期函数只能实现一份服务端领域逻辑；客户端可做即时预览，但最终保存结果和列表统计必须以服务端计算为准。

### 4.4 HTTP 接口

接口前缀 `/api/v1`。所有成功响应为 `{ "data": ... }`，失败为 `{ "error": { "code": "...", "message": "用户可读文案", "field_errors": {} } }`，并带 `request_id` 响应头。除登录和健康检查外全部需要有效会话。

| 方法与路径 | 输入 | 输出/说明 |
|---|---|---|
| `GET /items` | query: `life,time,color,brand,sort,cursor,limit<=50` | 当前持有列表、品牌选项、聚合统计、next_cursor |
| `POST /items` | `LipstickWriteInput`；header `Idempotency-Key` | 201，完整 item 与派生期限 |
| `GET /items/:id` | id | item、images 签名 URL、evidence、派生期限 |
| `PATCH /items/:id` | 写入字段 + `revision` | 200；冲突返回 409 |
| `POST /items/:id/discard` | `revision` | 幂等移出库存；状态变为 discarded |
| `DELETE /items/:id` | `revision` | 204；硬删除业务数据并调度 Storage 对象清理 |
| `GET /compare` | 可选 `color` | 六色系统计、当前持有条目、待分类数 |
| `GET /drafts/current?kind=&item_id=` | 草稿定位 | 200 或 404 |
| `PUT /drafts/:id` | draft payload + `base_revision` | 保存草稿，返回 `updated_at` |
| `DELETE /drafts/:id` | id | 放弃草稿及未绑定临时图 |
| `POST /uploads` | 文件元数据 | 创建 temp image 和短期上传信息 |
| `POST /uploads/:id/complete` | sha256/尺寸 | 服务端验证对象后确认上传 |
| `DELETE /uploads/:id` | image id | 仅删除当前草稿的临时图 |
| `POST /ai/tasks` | `draft_id`, `image_ids`, `consent_version` | 用户点击识别后调用；202 返回 task_id；依赖不可用时 503 |
| `GET /ai/tasks/:id` | task id | 状态、候选、suggestions、evidence |
| `POST /ai/tasks/:id/cancel` | 空 | 202；晚到结果作废 |

`LipstickWriteInput` 包含 3.2 中的可编辑业务字段、`image_ids`、`cover_image_id`、`color_family_confirmed`，不接受 `id/created_at/deadline/days_left/evidence` 等服务端字段。

### 4.5 大模型 API 数据流

1. 用户选择图片；客户端校验数量/大小后上传私有 Storage，服务端再次检查文件头和尺寸并移除 EXIF 元数据（尤其定位信息）。
2. 图片就绪后由用户点击“开始识别”。首次点击先展示图片将发送给 DeepSeek 的说明；用户同意后创建任务。同意版本随请求保存；拒绝时不调用 API，仍可手填。
3. 服务端创建 task，只向 DeepSeek 发送该草稿选中的 1–3 张图片和已确认的产品身份，不发送全量库存或备注。
4. Adapter 调用 DeepSeek Responses API 的 `deepseek-flash`（当前对应 DeepSeek-V4.1-Flash）完成视觉身份提取和 JSON Schema 结构化输出；多候选时返回 `needs_confirmation`，不继续查询错误产品期限。
5. 身份确认后调用 DeepSeek 官方 Search/Fetch API 做受限资料检索。DeepSeek 的 Responses API 内置 `web_search` 当前只支持不具备视觉输入的 `deepseek-v4-pro`，因此本期不使用 Pro 承担图片识别，也不把“内置搜索”与 V4.1 Flash 混写为同一调用。结果遵循 PRD schema v1；类型或证据校验失败时最多修复一次，之后返回 partial/failed。
6. 页面把结果显示为建议。用户逐项采用后才写入草稿 confirmed fields；用户已修改字段永不被迟到结果覆盖。
7. 用户保存 item；task/evidence 作为依据关联保存。AI 失败、取消或超时不影响手工保存。

单任务费用上限为人民币 2 元。服务端在每次模型/搜索/抓取调用前，根据官方单价、输入规模、`max_output_tokens` 和配置汇率计算最坏情况预算；预计会超过剩余预算时不再调用并返回 partial。记录实际 token、Search/Fetch 成功次数和估算人民币费用。模型 API 配置缺失时入口显示“识别暂不可用”并保留手工录入，不得返回模拟结果。

### 4.6 错误处理

| HTTP | code | 处理 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 字段就近展示；保留草稿 |
| 401 | `UNAUTHORIZED` | 跳登录，保留当前客户端输入 |
| 403 | `FORBIDDEN` / `ORIGIN_MISMATCH` | 不重试写入，记录 request_id |
| 404 | `NOT_FOUND` | 详情显示记录不存在并返回列表 |
| 409 | `REVISION_CONFLICT` / `DATE_CONFLICT` | 保留草稿，要求重载/核对 |
| 413 | `FILE_TOO_LARGE` | 指明具体文件，其他文件不丢失 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 提示转换 JPG/PNG/WebP |
| 422 | `AI_OUTPUT_INVALID` | 显示部分可信字段，其余未知 |
| 429 | `RATE_LIMITED` | 登录/AI 显示稍后再试，不自动密集重试 |
| 500 | `INTERNAL_ERROR` | 通用提示 + request_id，不暴露堆栈 |
| 503 | `DEPENDENCY_UNAVAILABLE` | DeepSeek、数据库或 Storage 不可用；保留手工录入路径 |

数据库写入与 item/image/accepted AI task 绑定在同一事务中。硬删除时事务内删除 item、草稿、task/evidence 和图片元数据，提交后幂等删除 Storage 对象；对象删除失败进入最小清理任务，不让记录重新可见。客户端只对幂等 GET、草稿 PUT 和带相同 Idempotency-Key 的新增进行有限重试。

## 5. 工程组织

### 5.1 目录结构

```text
lipstick-manager/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (protected)/layout.tsx
│  ├─ (protected)/inventory/page.tsx
│  ├─ (protected)/inventory/new/page.tsx
│  ├─ (protected)/inventory/[id]/page.tsx
│  ├─ (protected)/inventory/[id]/edit/page.tsx
│  ├─ (protected)/compare/page.tsx
│  └─ api/v1/.../route.ts
├─ components/
│  ├─ inventory/
│  ├─ intake/
│  └─ ui/
├─ lib/
│  ├─ auth/
│  ├─ db/
│  ├─ storage/
│  ├─ ai/providers/
│  ├─ domain/deadline.ts
│  ├─ domain/schemas.ts
│  └─ http/
├─ supabase/
│  └─ migrations/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ public/
├─ middleware.ts
├─ .env.example
└─ README.md
```

现有 `inventory/prototype/versions/**` 继续作为只读设计依据，不移动到生产 `app/`，避免演示脚本和模拟数据被打包上线。

### 5.2 环境变量

| 变量 | 客户端可见 | 用途 |
|---|---:|---|
| `APP_URL` | 否 | 正式 HTTPS 地址、同源校验 |
| `AUTH_SECRET` | 否 | Auth.js 会话签名，至少 32 随机字节 |
| `ADMIN_USERNAME` | 否 | 固定登录名 |
| `ADMIN_PASSWORD_HASH` | 否 | Argon2id 哈希 |
| `SESSION_VERSION` | 否 | 主动失效旧会话 |
| `SUPABASE_URL` | 否 | 服务端 Supabase 地址 |
| `SUPABASE_SECRET_KEY` | 否 | 数据库/Storage 服务端访问；不使用旧名 `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_STORAGE_BUCKET` | 否 | 私有图片 bucket |
| `AI_PROVIDER` | 否 | 固定 `deepseek` |
| `AI_MODEL` | 否 | 固定 `deepseek-flash`，当前对应 DeepSeek-V4.1-Flash |
| `AI_API_KEY` | 否 | DeepSeek 模型与 Search/Fetch API Key，仅服务端读取 |
| `AI_MAX_COST_CNY` | 否 | 固定 `2`，单任务人民币预算上限 |
| `AI_USD_CNY_RATE` | 否 | 成本预估汇率；部署时人工设置并定期核对 |
| `LOG_LEVEL` | 否 | 生产默认 info，不记录敏感正文 |

不得创建 `NEXT_PUBLIC_*` 密钥变量。`.env.example` 只放变量名和非敏感示例；`.env*`（除 example）加入 `.gitignore`。生产、预览、本地使用不同 Supabase 项目或至少不同数据库 schema/bucket，不把真实图片复制到预览环境。

### 5.3 开发约定

- TypeScript strict；禁止 `any` 穿过领域/API 边界。数据库输入、AI 输出、query 和环境变量全部经 Zod 校验。
- 领域规则（颜色枚举、当前库存、日历月、截止日区间）集中在 `lib/domain`，页面不得复制判断。
- Route Handler 只做鉴权、解析、调用 service、映射响应；数据库与外部服务调用不写在 React 组件中。
- 所有写操作记录结构化日志：`request_id`、操作名、item/task id、结果、耗时、错误类型；不记录密码、Cookie、原图、备注、完整外部 URL 或提示词。
- 数据库变更只通过有序 migration；禁止在生产控制台手改后不回填 migration。
- PR 必须通过 typecheck、lint、unit、integration 和核心 e2e；视觉改动至少附 375px 与 1440px 截图。
- 模拟数据只存在测试 fixture，明确 `mock`；开发 seed 不能在生产构建或启动时自动执行。

## 6. 开发计划

每个任务都形成可运行、可验证的纵向功能，不按“先把所有页面画完、最后再接数据”拆分。

| 阶段 | 完整功能任务 | 依赖 | 完成标准 |
|---|---|---|---|
| T1 | 工程基线与部署骨架 | 无 | 本地和 Vercel 预览可运行，环境变量校验、错误页、健康检查、CI 基线可用 |
| T2 | 单用户登录与全站保护 | T1 | 固定账号可登录和退出，页面与业务 API 均受保护，Cookie、安全头和基础限流通过验证 |
| T3 | 数据库、私有图片与领域规则 | T1、T2 | migration 可从空库建立，数据归属明确，私有图片不可匿名访问，期限规则通过边界测试 |
| T4 | 手工新增与草稿保存 | T3 | 无图也能完整录入，字段校验、草稿、幂等保存、详情跳转和刷新后持久化可用 |
| T5 | AI 图片识别基础闭环 | T4、DeepSeek API | 支持 0–3 张图、触发识别、展示候选、人工确认后填入表单，失败后可继续手填 |
| T6 | 库存列表、筛选排序与详情 | T4 | 概览、四维组合筛选、四种排序、空态、404、期限时间轴、私有图片和返回上下文符合原型 |
| T7 | 编辑与库存生命周期 | T4、T6 | 可编辑全部字段，revision 冲突不覆盖，可改变开封状态、移出库存和删除，统计同步更新 |
| T8 | 买前查一查 | T6、T7 | 六色系顺序、分组统计、到期提示、待分类入口、跳转和零记录文案正确 |
| T9 | AI 识别与检索质量收口 | T5 | 完成结构化协议、证据、候选、搜索、超时、取消、预算和字段保护，至少 20 个标注样本完成评测 |
| T10 | 移动端、预览环境与发布前验收 | T2–T9 | 真实手机和桌面核心流程通过，数据导出、未授权访问、密钥扫描和错误日志检查完成 |
| T11 | 生产部署与上线验证 | T10 | 生产域名、环境变量、数据库、私有存储、登录保护、备份或导出、监控和核心冒烟流程均验证通过 |

建议按 T1→T11 逐步完成；每阶段以当期可运行、可验证的完整功能为交付单位。任何模型异常都必须能回退到同一表单手工保存。T10/T11 中的数据导出指运维备份/恢复验证，不新增产品内导出功能。

**当前进度（2026-11-04）**：

- T1 工程基线与部署骨架已完成本地、CI、Vercel 和人工验收。
- T2 单用户登录与全站保护已完成，稳定版本为 `d7c446d6dbd697fb87bca5127b5ccf35eee3a41a`。
- T3 数据库、私有图片与领域规则已完成自动检查、开发 Supabase 验证，以及真实手机和桌面端 Vercel Preview 人工验收。
  - 稳定版本：`3935bfe13c89cd9203417aa7056bc73a33e285de`
  - Preview：`https://lipstick-manager-git-feature-t3-database-domain-kbk10.vercel.app`
  - 验收日期：`2026-11-04`
  - 环境边界：使用 Vercel Preview 与开发 Supabase；未合并 `main`、未执行生产 migration、未触发 Production 部署。

T3 状态为 **已完成**，下一阶段可开始 T4 手工新增与草稿保存。

## 7. 测试与验收

### 7.1 自动化测试

**单元测试**

- 六色系枚举、当前持有口径、筛选区间。
- 日历月：`2026-01-31 + 1 月 = 2026-02-28`。
- PRD 样例：O=`2026-03-01`、M=12、E=`2026-12-01`，D=`2026-12-01`；无 E 时 D=`2027-03-01`。
- D 为今天、昨天、+30、+31、+90、+91、+180、+181 的互斥状态。
- 未来开封/生产日期、O>E、明确日期与推算日期冲突、非法月数均被拦截。
- 受控 `returnTo` 拒绝外部 URL，HTML 文本正确转义。

**集成测试**

- 未登录对每个业务接口均为 401；错误 Origin 的写请求为 403。
- 新增 Idempotency-Key 重放只产生一个 item；旧 revision 更新返回 409。
- 图片类型用文件头校验；超量、超大、跨草稿 image id 均拒绝。
- item 保存、图片绑定、移出/删除后的查询与统计一致。
- 草稿刷新恢复；AI 迟到结果不覆盖 dirty 字段；任务取消后结果无效。
- Storage 匿名 URL 不能读取，签名 URL 过期后不能继续读取。

**端到端测试**

- 登录→空库存→手工新增→详情→列表→筛选→买前查看。
- 上传整体/底标图后不自动外传；点击“开始识别”并同意后才调用 DeepSeek。API 失败后仍能手填保存，且不得出现模拟品牌或模拟期限。
- 已开封 + 30 天内 + 豆沙色系交集准确。
- 编辑未开封记录为已开封并填写日期；“移出库存”后列表和买前计数同步减少；删除取消不变、确认才删除。页面不得出现最新版原型没有的“已用完”独立操作。
- 同一浏览器两个标签页同时编辑，后保存者看到冲突且输入保留。

### 7.2 人工验收步骤

1. **核心流程**：清空测试账号数据；登录；不上传图片手工新增一支“待分类”；再新增一支豆沙色系且带三图和日期；检查列表、详情、买前页字段及统计。模型 API 未配置或请求失败时不得出现可误认为真实识别的结果。
2. **持久化**：保存记录并完全关闭浏览器，重新打开并登录后确认记录和私有图片存在；清 Cookie 后重新登录仍可访问，证明数据不依赖浏览器 `localStorage`。本项不验证跨设备同步或访问。
3. **未授权访问**：无 Cookie、伪造 Cookie、过期 Cookie 分别请求所有页面、`/api/v1/items` 和图片；除 `/login`、静态资源、健康检查外都不得返回业务内容。直接猜测 item UUID 不得泄露记录。
4. **密钥检查**：查看浏览器 Network、页面源码和构建产物，确认没有 Supabase secret key、AI key、密码哈希；Storage bucket 匿名访问失败。
5. **移动端**：在真实 iOS Safari 与 Android Chrome（至少各一台，或一台真机加可靠模拟）以 375/390/430px 完成登录、上传、日期输入、保存、筛选、详情、对话框；确认无横向溢出、键盘不遮按钮、44px 触控区和安全区正常。
6. **桌面与键盘**：1440px 下只用 Tab/Shift+Tab/Enter/Escape 完成筛选、新增和确认；焦点始终可见，弹窗焦点不逃逸。
7. **失败恢复**：在上传、草稿、保存和 AI 阶段分别断网；确认错误明确且字段不丢。恢复网络后由用户触发重试，不能出现重复记录。
8. **期限边界**：用固定测试时钟执行 AC-006/007 全部样例；跨上海时区午夜刷新后剩余天数更新，数据库原始日期不变。
9. **开发数据导出**：创建含图片的测试记录，完成一次 PostgreSQL 手工导出和 Storage 图片下载，确认两者可独立保留；本期不要求生产级恢复演练。

发布阻断条件：任一未授权访问可读取数据、密钥出现在客户端、重复提交产生重复条目、持久化失败、日期边界错误、375px 核心流程不可完成，或真实 AI 失败时无法手工保存。

## 8. 假设、冲突与已确认决策

### 8.1 已采用的最简假设

- 仅一个固定管理员，无注册；不实现或承诺跨设备访问。仍使用 revision 防同一浏览器多标签页覆盖。
- 用户主要时区为 `Asia/Shanghai`；服务器统一存 UTC 时间戳，日历日期按上海时区计算。若未来常驻其他时区再增加用户时区设置。
- 页面内期限提醒即满足 MVP，不做邮件、短信、系统推送。
- 图片最多 3 张、每张 10MB，JPG/PNG/WebP；允许无图手工保存。
- 数据量按约 100 支设计，GET 列表仍支持 cursor/limit，UI 首版可一次加载前 100 支。
- 无产品工程可复用，原型的颜色、排版与交互作为设计基线，但不复用其单文件脚本结构。

### 8.2 PRD、原型与本轮约束冲突

| 主题 | PRD/原型 | 本规格决策 |
|---|---|---|
| 身份与持久化 | 可交互原型为便于演示使用 `localStorage`，且不实作登录 | 产品与工程基线为公网固定账号保护和服务端数据库/私有图片；原型本地存储仅是演示机制，不把跨设备访问列入范围或验收 |
| 草稿 | 原型只存浏览器 | 服务端草稿为准；页面局部状态只作未完成请求缓存 |
| AI | 原型使用模拟识别/模拟品牌 | 交互阶段沿用原型，生产替换为真实服务端大模型 API；不保留模拟结果选择器，失败时允许手填 |
| 历史/恢复 | 旧版文档曾包含历史记录恢复，最新 PRD 与原型已移除 | 只保留 `discarded` 内部状态，不提供历史入口和恢复 |
| 详情操作 | PRD 早期包含标记开封、已用完、丢弃；最新版 `overrides.js` 最终只呈现编辑、移出库存、删除 | 以最终原型为准；开封通过编辑完成，不提供“已用完”独立按钮 |
| 筛选排序 | PRD/基础原型为三维筛选、三种排序 | 以最新版 `overrides.js` 为准：增加品牌筛选和按品牌排序，共四维筛选、四种排序 |
| 录入触发 AI | 原型上传后自动调用模拟 `runAI()`；最新版 PRD 明确用户发起识别 | 真实实现以 PRD 和本轮确认为准：上传不调用外部 API，用户点击“开始识别”，首次点击先完成外传同意 |
| 永久删除 | spec 初稿使用软删除；PRD 要求彻底移除且无恢复 | 本轮确认采用硬删除：事务内删除业务数据，事务后清理私有图片；本期 Free 环境不依赖托管备份恢复 |
| `expires_on` 来源 | 原型允许用户直接填；PRD 区分 explicit/calculated | 表单可填明确实物日期；推算值由服务端计算并标记来源，不混为同一证据 |

### 8.3 已确认的开发输入

以下决策已确认并作为开发输入：

1. **登录方式**：固定用户名 + 密码输入登录；不接邮箱、短信或第三方登录，不开放注册。
2. **托管区域与套餐**：本期只做初期开发，使用 Supabase Free，在新加坡 `ap-southeast-1` 建项目；不购买 Pro，不设计长期使用方案。接受 Free 项目可能因不活跃暂停以及没有生产级自动备份保障。
3. **大模型 API**：DeepSeek `deepseek-flash`（V4.1 Flash）负责图片和结构化输出；DeepSeek Search/Fetch API 负责检索；单任务费用上限人民币 2 元。正式试用前仍需在 DeepSeek 控制台创建 API Key，并确认账户图片保留/训练政策。
4. **登录限流**：使用 Supabase PostgreSQL 最小限流表实现，不引入 Redis、Cloudflare Access 或其他外部服务。
5. **删除**：硬删除业务记录及关联元数据，随后清理 Storage 图片；不提供回收站。

价格和产品能力核对日期为 2026-11-03；开发启动前应再次核对官方页面：`https://supabase.com/pricing`、`https://supabase.com/docs/guides/platform/regions`、`https://api-docs.deepseek.com/quick_start/pricing/`。

不需要在开始开发前确认产品正式名称、质地枚举或卡片图片比例；它们可保持自由文本/原型默认值，不应扩大本期功能。
