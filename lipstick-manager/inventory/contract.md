# 口红柜库存管理 MVP 开发契约

> 状态：**Ready for development / 已定稿**  
> 审查日期：2026-11-03  
> 审查对象：PRD `20261102-174301-9f3b2a`、原型 `interactive-20261102-01`、`spec.md`  
> 适用范围：单用户、公网部署、固定账号登录、移动端优先 MVP  
> 本文只定义开发契约，不包含业务代码、依赖安装或工程配置修改

## 0. 审核结论

### 0.1 总体结论

`spec.md` 的技术方向可行：Next.js 单体 Web 应用、服务端鉴权、PostgreSQL 持久化、私有图片存储、服务端调用大模型 API，能够满足本轮公网部署、单用户、无开放注册、页面/API 受保护和密钥不下发客户端的约束。核心数据对象、期限计算、幂等保存、版本冲突和 AI 降级路径也已基本覆盖。

审核通过。原 2 个阻塞项已由用户确认：真实 AI 由点击触发；删除采用硬删除。N-01 至 N-05 已同步修正到 `spec.md`。本文件与修订后的 spec 共同作为开发基线。

### 0.2 已解决的阻塞项

| ID | 原问题 | 最终决策 | 已同步位置 |
|---|---|---|---|
| B-01 | PRD 要求点击识别，原型模拟代码上传后自动调用 | **点击触发**：上传只保存图片；用户点击并完成首次外传同意后创建任务 | spec §3.3、§4.4、§4.5、§6、§7 |
| B-02 | PRD 要求彻底删除，spec 初稿为软删除 | **硬删除**：事务内删除业务数据及元数据，提交后幂等清理 Storage；无回收站 | spec §2.3、§4.2–4.6、§8 |

### 0.3 已完成的 spec 修订

以下问题已按最新版 PRD 修正，不再留给开发选择。

| ID | 原问题 | 已采用修正 |
|---|---|---|---|
| N-01 | spec 引用旧 PRD | 更新为 `20261102-174301-9f3b2a` |
| N-02 | 默认排序错误 | 默认 `expiry`；已到期最前、未知最后；`new` 为最近录入 |
| N-03 | 时间轴条件展示 | 详情始终显示录入/开封/到期三节点 |
| N-04 | AI task 无 item 关联 | `ai_tasks.item_id` 可空；保存时绑定被采用任务，Evidence 间接关联 |
| N-05 | AI 关闭与 AI 录入任务冲突 | T4 先完成无 AI 手工录入；T5/T9 接入与收口 AI。依赖不可用时返回 503，AI 失败不阻断手填 |

### 0.4 非阻塞建议

- spec 的 `POST /items/:id/lifecycle` 过于宽泛。最新版原型只有“移出库存”，建议收窄为 `POST /items/:id/discard`；开封状态通过编辑 `PATCH /items/:id` 修改，避免两个接口都能改变同一字段。
- `confirm_name` 不属于 PRD 要求，且会给移动端删除增加输入负担。删除只需二次确认弹窗与 `revision`，不需要再次输入名称。
- 单用户 MVP 不需要 `owner_id`、用户表、组织或角色表。数据归属由服务端固定主体决定；不要为了“未来多用户”提前扩展。
- 登录限流使用现有 PostgreSQL 的最小登录尝试表，不引入 Redis、独立服务或额外网关。
- 最新 PRD 已同步公网固定登录和服务端持久化约束。实现以服务端数据库和私有 Storage 为准，但不将跨设备访问列为产品能力或验收项。

## 1. 契约适用规则

1. 本契约以本轮用户约束优先，其次为最新版 PRD，再次为最终加载的原型行为（`app.js` 后加载 `overrides.js`），最后为 spec 的技术实现细节。
2. 原型中的 `localStorage`、Data URL、模拟品牌、模拟 AI 结果选择器和定时器仅用于演示，不是生产数据/API 契约。
3. 本契约未定义的功能不进入本期；不得增加注册、多用户、角色、组织、分享、历史浏览、恢复、推送、交易或精确色差功能。
4. B-01、B-02 和 N-01 至 N-05 均已解决；本文不存在需要开发自行判断的未决契约。

## 2. 范围与模块边界

### 2.1 模块职责

| 模块 | 负责 | 不负责 | 依赖 |
|---|---|---|---|
| Auth | 固定管理员登录/退出、服务端会话校验、Cookie、安全头、登录限流 | 注册、找回密码、用户资料、角色/组织 | Auth.js、服务端环境变量 |
| Inventory | 当前库存列表、概览、四维筛选、四种排序、详情聚合 | 历史库存、恢复、分享、导出 | Item Repository、Deadline Domain、Image Access |
| Intake/Edit | 新增/编辑草稿、图片选择、字段确认、保存、版本冲突 | 自动替用户确认 AI 建议 | Draft、Upload、AI、Item Service |
| Lifecycle | `unopened/opened/unknown/discarded` 转换、移出库存、删除 | “已用完”独立状态、历史页、恢复 | Item Service |
| Deadline Domain | 日历月计算、有效到期日、截止日、剩余天数和分段 | 实物安全判断、模糊日期推断 | 纯领域函数、Asia/Shanghai 日期 |
| Compare | 六色系分组、当前持有统计、待分类提示、详情入口 | 新品录入、实时 AI 比色、购买建议 | Inventory Query、Deadline Domain |
| Upload/Image | 0–3 图上传、文件头校验、EXIF 清理、私有对象、封面顺序、签名读取 | 公开图片 URL、网页图片自动抓取 | Private Storage、Draft/Item |
| AI Intake | 视觉身份、候选、六色系/期限建议、证据、取消/超时/降级 | 直接写已确认库存、获取全量库存、猜批号日期 | Upload、Draft、Provider Adapter |
| Evidence | 字段来源、图片索引或网页来源、采用关系 | 虚构来源、无依据置信度 | AI Task、Item |
| Persistence | 数据事务、幂等、revision、草稿和任务持久化 | 浏览器作为真实数据源 | PostgreSQL、Private Storage |
| Observability | request_id、结果、耗时、错误类型、AI 用量/费用 | 原图、备注、Cookie、密码、完整提示词日志 | 服务端日志 |

### 2.2 依赖方向

```text
Page / Route Handler
  → Auth guard
  → Application Service
      → Domain rules (deadline, lifecycle, validation)
      → Repository (PostgreSQL)
      → Storage Service
      → AI Provider Adapter
```

页面不得直接调用数据库、Supabase secret key 或模型 SDK。领域模块不得依赖 React、HTTP 或供应商 SDK。

## 3. 数据契约

### 3.1 统一约定

- ID：服务端生成 UUID 字符串；客户端不得指定正式 item/task/evidence ID。
- API 命名：JSON、query、数据库领域字段统一 `snake_case`。
- 日期：业务日期使用 `YYYY-MM-DD`，按 `Asia/Shanghai` 日历日解释；不得用 UTC 零点替代日历日期。
- 时间戳：UTC RFC 3339，例如 `2026-11-03T02:30:00.000Z`；展示时转换为用户本地时间。
- 空值：未知字段使用 JSON `null`；不得用空字符串、`0`、`"unknown"` 代替。服务端接收字符串时先 trim，空字符串归一为 `null`，必填字段除外。
- ID/时间/派生值/证据由服务端确定。客户端提交这些字段时应拒绝或忽略并记录开发错误。
- 单用户不设置 `owner_id`。所有仓储调用必须位于通过 `requireSession()` 后的服务端路径；`SUPABASE_SECRET_KEY` 不暴露给客户端。
- `revision` 从 1 开始，每次成功业务修改 +1；草稿自动保存不增加 item revision。

### 3.2 枚举

```text
ColorFamily = nude | rose | orange | red | plum | brown
Lifecycle = unopened | opened | unknown | discarded
OpeningPrecision = exact | unknown
ExpirySource = explicit | calculated
SortType = expiry | new | brand | color
ExpiryFilter = over_180 | days_91_180 | days_31_90 | days_0_30 | expired | unknown
AITaskStatus = queued | recognizing | needs_confirmation | researching |
               partial | complete | failed | cancelled | timed_out
EvidenceKind = image | official | authorized_store | user
```

数据库迁移若遇到旧 `finished`，一次性映射为 `discarded`；新 API 不接受 `finished`。

### 3.3 `LipstickItem`

| 字段 | 类型 | 必填/默认 | 约束与语义 |
|---|---|---|---|
| `id` | UUID | 服务端必填 | 不可修改 |
| `revision` | integer | `1` | `>=1`，乐观锁 |
| `display_name` | string | 服务端/客户端提交适配层生成 | 品牌、系列、色号的非空值以 `-` 连接；均为空时为“信息待补充”；页面不提供独立输入框 |
| `brand` | string/null | `null` | 最多 100 字符 |
| `series` | string/null | `null` | 最多 50 字符；保存与展示时去掉开头重复品牌名及相邻分隔符 |
| `shade_code` | string/null | `null` | 最多 100 字符，保留前导零 |
| `color_family` | ColorFamily/null | `null` | null=待分类，不是第七色系 |
| `color_description` | string/null | `null` | 最多 200 字符 |
| `texture` | string/null | `null` | `哑光 | 丝绒 | 缎光 | 水光 | 镜面 | 其他` |
| `lifecycle` | Lifecycle | `unknown` | discarded 不出现在列表/买前页 |
| `opened_on` | LocalDate/null | `null` | 仅用户确认；不得晚于 today |
| `opening_precision` | OpeningPrecision | `unknown` | `opened_on!=null` 时必须为 exact |
| `pao_months` | integer/null | `null` | 1–120；只在 opened 状态参与截止计算 |
| `manufactured_on` | LocalDate/null | `null` | 不得晚于 today 或 expires_on；不可由批号猜测 |
| `shelf_life_months` | integer/null | `null` | 1–240；不等同 PAO |
| `expires_on` | LocalDate/null | `null` | 当前实物明确日期或经用户确认的推算日期 |
| `expiry_source` | ExpirySource/null | `null` | expires_on 非空时必填；为空时必须 null |
| `note` | string/null | `null` | 最多 500 字符 |
| `cover_image_id` | UUID/null | `null` | 有图时必须等于排序后 `image_ids[0]` 且属于当前 item；无图时为 `null` |
| `created_at` | Instant | 服务端必填 | 录入时间，不随编辑改变 |
| `updated_at` | Instant | 服务端必填 | 每次成功业务修改更新 |

写入请求另含 `color_family_confirmed:boolean`。当 `color_family=null` 时该值必须为 true，表示用户显式选择待分类；该确认标记只用于写入校验，不必持久化。

`deadline`、`days_left`、`deadline_basis`、`deadline_status` 为响应派生字段，不作为客户端可写字段：

```text
pao_deadline = lifecycle=opened 且 opening_precision=exact
               ? add_calendar_months(opened_on, pao_months) : null
calculated_expiry = add_calendar_months(manufactured_on, shelf_life_months)
effective_expiry = 已确认 expires_on，或字段齐全时的已确认 calculated_expiry
deadline = min(non-null(pao_deadline, effective_expiry))
days_left = deadline - today(Asia/Shanghai)
```

目标月没有同日时取月末。日期状态严格互斥：`>180`、`91..180`、`31..90`、`1..30`、`0`、`<0`、`null`。顶部“30天内到期”使用 `0..30`，不含已到期。

### 3.4 图片、草稿、AI 与证据

**LipstickImage**

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | UUID | 服务端生成 |
| `item_id` / `draft_id` | UUID/null | 恰有一个非空 |
| `storage_path` | string | 唯一、不可由客户端任意指定 |
| `mime_type` | enum | image/jpeg、image/png、image/webp |
| `byte_size` | integer | 1..10 MiB |
| `width`,`height` | integer | 正整数，由服务端读取 |
| `sha256` | hex string | 服务端计算/核对 |
| `position` | integer | 0..2，同一 owner 唯一 |
| `status` | temp/attached | 保存 item 后 attached |

单个 draft/item 最多 3 张。MIME 必须按文件头验证；浏览器将大图压缩至最长边 1600px、JPEG 质量约 0.80，并移除 EXIF；服务端仍须下载压缩图复核文件头、尺寸和哈希。多图先顺序预留 position，再并行上传和完成校验，不能并发争抢 position。

**Draft**：`id`、`kind(new|edit)`、`item_id`、`base_revision`、经 schema 校验的 `payload`、`suggestion_version`、`updated_at`、`expires_at`。新增草稿最多一个；每个 item 最多一个编辑草稿。

**AITask**：`id`、`draft_id`、`item_id null`、`status`、`workflow_version`、`schema_version`、`provider`、`model`、`input_image_ids`、`result`、`error_code`、`duration_ms`、`usage_json`、`cancelled_at`、时间戳。保存 item 时，只将本次采用建议对应的 task 绑定 `item_id`。这是对 spec N-04 的必要修订。

**Evidence**：`id`、`ai_task_id`、`field_name`、`kind`、`url`、`image_id`、`excerpt`、`retrieved_at`。`image` 证据必须有 image_id；网页证据必须有真实 URL 和 retrieved_at；`excerpt` 最多 500 字符。证据用于服务端质量校验与评测，不在录入页展示。

**AuthLoginAttempt**：`key_hash`、`window_started_at`、`failure_count`、`locked_until`、`updated_at`。`key_hash` 由 IP HMAC 与用户名 HMAC 组合，不保存明文 IP、用户名或密码；成功登录清除对应记录，过期窗口定期清理。该表只用于固定账号限流，不构成用户管理系统。

### 3.5 生命周期转换

| 当前状态 | 允许目标 | 入口/条件 |
|---|---|---|
| `unknown` | `unopened`, `opened`, `discarded` | 编辑；opened 可不记得日期 |
| `unopened` | `opened`, `unknown`, `discarded` | 编辑；opened_on 可填或未知 |
| `opened` | `unopened`, `unknown`, `discarded` | 编辑或移出；改回未开封时不删除历史字段，但 PAO 不参与计算 |
| `discarded` | 无 | 首版无历史入口、无恢复 |

永久删除不是 lifecycle 状态。`discarded` 与删除的差异：前者保留内部记录但不展示；后者硬删除业务记录和关联元数据，并在事务提交后清理私有图片。

## 4. 接口契约

### 4.1 通用 HTTP 约定

- 前缀：`/api/v1`。
- 鉴权：除 `/login`、静态资源、`/api/health` 外全部要求有效 HttpOnly 会话。
- 数据归属：服务端从会话固定为唯一管理员主体；不得接受 `user_id`、`owner_id` 或客户端权限声明。
- 写请求：校验同源 `Origin`；JSON 使用 `Content-Type: application/json`。
- 成功包络：`{"data": ...}`；204 无响应体。
- 错误包络：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请检查填写内容",
    "field_errors": {"opened_on": "开封日期不能晚于今天"}
  }
}
```

每个响应带 `X-Request-Id`。错误不得包含堆栈、SQL、密钥、供应商原始响应或模型原始 JSON。

### 4.2 查询库存

`GET /api/v1/items`

鉴权：必须。Query：

| 参数 | 可选值/默认 |
|---|---|
| `life` | `opened|unopened|unknown`；默认空 |
| `time` | ExpiryFilter；默认空 |
| `color` | ColorFamily 或 `pending`；默认空 |
| `brand` | 当前库存中的精确品牌字符串；默认空 |
| `sort` | `expiry|new|brand|color`；**默认 `expiry`** |
| `cursor` | opaque string；默认空 |
| `limit` | 1..50；默认 50 |

排序稳定规则：

- `expiry`：deadline 非空升序（负数即已到期最前），null 最后；相同 deadline 按 created_at 降序、id 升序。
- `new`：created_at 降序、id 升序。
- `brand`：brand 按 `zh-CN` 排序，null 最后；再按 created_at 降序。
- `color`：按 nude、rose、orange、red、plum、brown、null 顺序；组内 created_at 降序。

响应示例：

```json
{
  "data": {
    "items": [{
      "id": "4cf43d3d-f005-49cc-b03a-32f05dcaa735",
      "revision": 1,
      "display_name": "玫瑰色口红",
      "brand": "示例品牌",
      "series": null,
      "shade_code": "03",
      "color_family": "rose",
      "texture": "哑光",
      "lifecycle": "opened",
      "cover_image_url": null,
      "deadline": "2027-01-31",
      "days_left": 89,
      "deadline_status": "days_31_90"
    }],
    "summary": {"current": 1, "opened": 1, "due_0_30": 0},
    "brands": ["示例品牌"],
    "next_cursor": null
  }
}
```

空库存返回 200 和空数组；筛选无结果同样返回 200，但 summary 仍按未筛选当前库存计算，供页面区分两种空状态。

### 4.3 详情、新增与编辑

`GET /api/v1/items/:id`：返回完整 `LipstickItem`、派生期限、最多 3 个短期签名图片 URL、有效 Evidence。不存在、discarded 或已删除统一 404。

`POST /api/v1/items`：鉴权必须；请求头必须含稳定的 `Idempotency-Key` UUID。同一主体和相同 key 重放返回首次成功结果，不新增第二条。

`PATCH /api/v1/items/:id`：鉴权必须；请求包含当前 `revision`。更新成功后 revision +1；旧 revision 返回 409 `REVISION_CONFLICT`，不覆盖记录。

写入示例：

```json
{
  "revision": 3,
  "display_name": "玫瑰色口红",
  "brand": "示例品牌",
  "series": null,
  "shade_code": "03",
  "color_family": "rose",
  "color_family_confirmed": true,
  "color_description": null,
  "texture": "哑光",
  "lifecycle": "opened",
  "opened_on": "2026-10-01",
  "opening_precision": "exact",
  "pao_months": 12,
  "manufactured_on": null,
  "shelf_life_months": null,
  "expires_on": null,
  "expiry_source": null,
  "note": null,
  "image_ids": [],
  "cover_image_id": null,
  "accepted_ai_task_id": null
}
```

POST 不包含 revision；PATCH 必须包含。服务端忽略/拒绝 `id`、时间戳、deadline、days_left、evidence 和图片 URL。

### 4.4 移出库存与删除

`POST /api/v1/items/:id/discard`

```json
{"revision": 3}
```

成功返回更新后的 item，`lifecycle="discarded"`、revision +1；随后列表、概览和买前统计必须同步排除。重复对 discarded 调用可返回 200 当前结果，保证重试幂等。该接口替代 spec 中宽泛的 `/lifecycle`。

`DELETE /api/v1/items/:id`

请求：`{"revision":3}`。旧 revision 返回 409。用户取消确认时前端不得发请求。

成功为 204；事务内删除 item、draft、task/evidence 关联和图片元数据，事务提交后幂等删除 Storage 对象。若对象删除暂时失败，记录内部清理任务，但业务接口仍不可再读取该 item。无回收站；本期 Free 开发环境不依赖托管备份恢复。

### 4.5 草稿与图片

- `GET /api/v1/drafts/current?kind=new|edit&item_id=...`：200 返回草稿；没有返回 404。
- `PUT /api/v1/drafts/:id`：防抖自动保存；edit 草稿必须带 `base_revision`；返回 `updated_at`。
- `DELETE /api/v1/drafts/:id`：放弃草稿并清理无引用临时图；成功 204。
- `POST /api/v1/uploads`：提交文件名、声明 MIME、byte_size 和 draft_id，创建 temp image 并返回短期上传信息。
- `POST /api/v1/uploads/:id/complete`：服务端读取对象，验证文件头/大小/尺寸并完成 EXIF 清理；验证失败删除对象并返回 413/415/422。
- `DELETE /api/v1/uploads/:id`：仅允许删除当前草稿的 temp 图；成功 204。

上传接口不得接受任意 storage_path 或 item_id。只有 item 保存事务能把 draft 图片绑定为 attached。

### 4.6 AI 任务

`POST /api/v1/ai/tasks`

```json
{
  "draft_id": "c085b980-b24d-4d85-884d-42acf1bf7652",
  "image_ids": ["7bb11a3e-a2a0-4f71-8294-2c2472604579"],
  "consent_version": "2026-11-03-v1",
  "confirmed_identity": {
    "brand": null,
    "series": null,
    "shade_code": null
  }
}
```

服务端验证图片均属于该 draft、数量 1–3、同意版本有效。成功返回 202：

```json
{"data":{"task_id":"cf2a61c1-b8d6-4dbd-a5f8-bf7e20116a74","status":"queued"}}
```

该请求只由用户点击“开始识别”触发；上传完成不得自动调用外部模型。首次未同意不得调用 DeepSeek。

`GET /api/v1/ai/tasks/:id` 返回：

```json
{
  "data": {
    "schema_version": "1",
    "task_id": "cf2a61c1-b8d6-4dbd-a5f8-bf7e20116a74",
    "status": "partial",
    "identity": {"brand":"示例品牌","series":null,"shade_code":"03"},
    "candidates": [],
    "suggestions": {
      "color_family":"rose",
      "color_description":null,
      "texture":"哑光",
      "pao_months":12,
      "manufactured_on":null,
      "shelf_life_months":null,
      "expires_on":null
    },
    "evidence": [{
      "id":"03aa1160-f95b-421d-a64a-287a44086f57",
      "field":"pao_months",
      "kind":"image",
      "url":null,
      "image_id":"7bb11a3e-a2a0-4f71-8294-2c2472604579",
      "excerpt":"12M",
      "retrieved_at":null
    }],
    "unresolved_fields":["series"],
    "warnings":[]
  }
}
```

`POST /api/v1/ai/tasks/:id/cancel` 返回 202。任务置 cancelled；供应商调用即使无法物理中止，迟到结果也不得改变 task 的用户可见结果或草稿。

AI 约束：`deepseek-flash`（DeepSeek V4.1 Flash）负责图片识别与 JSON Schema 输出；DeepSeek Search/Fetch API 负责官方/授权来源检索。单工具 15 秒、总任务 45 秒、最多 2 次模型调用（含修复）、2 次 Search/Fetch、3 个候选页面；仅暂时错误重试一次。单任务预计费用上限人民币 2 元，调用前按官方单价、token 上限、成功检索次数和配置汇率做预算门禁；预算不足返回 partial/failed。API 配置缺失或依赖不可用返回 503 `DEPENDENCY_UNAVAILABLE`，手填保存仍可用。

### 4.7 状态码与错误码

| HTTP | code | 使用场景 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | JSON/query/字段组合错误 |
| 401 | `UNAUTHORIZED` | 无会话、会话过期 |
| 403 | `FORBIDDEN` / `ORIGIN_MISMATCH` | 非同源写请求、资源不属于当前草稿 |
| 404 | `NOT_FOUND` | item/draft/task 不存在或不可见 |
| 409 | `REVISION_CONFLICT` | 旧 revision 更新/移出/删除 |
| 409 | `DATE_CONFLICT` | opened_on 晚于有效到期日、明确与推算日期冲突未确认 |
| 413 | `FILE_TOO_LARGE` | 单图超过 10 MiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 非 JPG/PNG/WebP 或文件头不匹配 |
| 422 | `AI_OUTPUT_INVALID` | 模型输出校验失败，可信部分可保留在任务结果 |
| 422 | `IMAGE_VALIDATION_FAILED` | 对象不存在、损坏、尺寸无法读取 |
| 429 | `RATE_LIMITED` | 登录或 AI 调用超限 |
| 500 | `INTERNAL_ERROR` | 未分类服务端错误 |
| 503 | `DEPENDENCY_UNAVAILABLE` | 模型、检索、数据库或 Storage 暂不可用 |

## 5. 前后端责任

| 事项 | 前端 | 服务端（最终权威） |
|---|---|---|
| 登录 | 收集凭据、展示统一错误 | 验证哈希、限流、签发/撤销会话 |
| 页面保护 | 根据会话优化跳转 | 每个页面数据读取和 API 再次鉴权 |
| 输入 | 即时必填/长度/格式提示 | 对所有字段重新校验；客户端结果不可信 |
| 日期 | 即时预览 | 按 Asia/Shanghai 重算并决定是否可保存 |
| 筛选排序 | URL 状态和控件 | 校验枚举并返回稳定排序结果/统计 |
| 图片 | 数量、声明类型/大小预检、预览 | 文件头、大小、尺寸、归属、EXIF、私有路径 |
| AI 建议 | 展示候选和建议、记录 dirty 字段、让用户采用 | 调用模型、校验 schema、版本化任务、保留质量证据、拒绝迟到结果 |
| 用户确认值 | 表单状态和 accepted task id | 只保存合法字段；不得让 AI 覆盖已有确认值 |
| 数据归属 | 不提交 owner/user id | 固定会话主体；所有资源按服务端关系校验 |
| 幂等/并发 | 禁用按钮、复用 key、提交 revision | 唯一幂等约束、事务、乐观锁 |
| 密钥 | 不读取、不缓存 | 只从服务端环境变量读取 |
| 错误 | 保留输入、就近提示、显示 request id | 统一错误格式；日志脱敏 |

前端校验用于体验，任何前端校验都不能替代服务端校验。middleware 只做快速重定向，也不能替代 Route Handler/Application Service 的 `requireSession()`。

## 6. 状态与异常契约

### 6.1 页面状态

- 加载：显示骨架或文字状态；不得先显示错误的 0 条统计。
- 空库存：显示新增/手工录入引导；不得自动生成模拟库存。
- 筛选无结果：显示清除筛选；不得复用空库存文案。
- 详情不存在：显示明确错误和返回列表动作；不泄露其他主体信息。
- 会话过期：读取跳登录；写操作保留客户端输入，重新登录后由用户主动重试，不自动重放。
- 网络/存储失败：不显示成功；保留草稿和已完成上传引用，提供重试。

### 6.2 表单与 AI 状态

```text
draft → images_ready → queued → recognizing
                         ├→ needs_confirmation → researching
                         ├→ partial
                         ├→ complete
                         ├→ failed/timed_out
                         └→ cancelled
任一 AI 终态 → user_confirming → saving → saved | save_failed
无图片或不调用 AI：draft → user_confirming → saving
```

- AI 等待时可以填写开封状态和日期；返回结果不得覆盖 dirty 字段。
- 未开封隐藏 PAO 模块；已开封时 PAO 获取中显示加载，有可靠结果显示月数和来源，失败后才显示重试和手动补充。
- 更换图片不清空手填值；重新调用创建新 suggestion_version，旧任务结果失效。
- 刷新恢复草稿但不自动重复付费 AI 调用。
- 失败、partial、cancelled、timed_out 均允许手工保存。

### 6.3 详情与列表状态

- 详情只展示一张封面图；有图时使用排序第一张，无图时使用与原型一致的默认口红插画。其后固定顺序为品牌-系列-色号组合名称 → 品牌/系列/色号 → 开封/期限/色系标签 → 使用期限卡片 → 备注。底部“新增／列表／编辑／移出”在手机与桌面均单排横向排列。
- 新增页和编辑页均允许拖动调整已有图片顺序；`image_ids[0]` 必须与 `cover_image_id` 一致。无图片时 `cover_image_id=null`，页面显示默认插画但不创建图片记录。
- 三节点时间轴始终显示：录入日期必有；未开封显示“尚未开封”；未知显示“未记录”；无 deadline 显示“待补充”。页面不显示“提醒截止日”字段。
- 默认列表排序为 `expiry`；筛选顺序为期限、开封、色系、品牌。
- 进入详情再返回必须保留筛选、排序、买前所选色系和滚动位置。
- 移出成功后当前列表、概览和买前统计使用同一查询口径更新；无历史入口。

### 6.4 重复提交与恢复

- POST item 使用 `(fixed_principal, idempotency_key)` 唯一约束；相同 key+相同请求返回同一结果，相同 key+不同请求返回 409 `IDEMPOTENCY_CONFLICT`。
- PATCH/discard/delete 使用 revision；冲突时保存编辑草稿并提示重新载入，不能自动合并或覆盖。
- Storage 上传成功但数据库绑定失败时保持 temp，24 小时后清理；重试保存可复用该 image id。
- Storage 删除失败不得让已删除/移出记录重新可见；内部清理可重试。

## 7. 工程边界

沿用 spec，不另起技术方案：Next.js App Router + TypeScript、CSS Modules、React Hook Form + Zod、Auth.js Credentials、Supabase PostgreSQL/Private Storage、DeepSeek 服务端 Adapter、Vercel 部署、Vitest/Testing Library/Playwright。

目录职责保持：

- `app/`：路由、页面、Route Handlers；不承载数据库和模型实现。
- `components/inventory`：列表、详情、比较展示。
- `components/intake`：上传、表单和 AI 建议交互。
- `components/ui`：无业务含义的通用组件。
- `lib/auth`：会话与服务端守卫。
- `lib/domain`：schema、期限、生命周期、筛选/排序枚举；不得依赖 UI/供应商。
- `lib/db`：repository、事务、migration 映射。
- `lib/storage`：私有对象、签名 URL、验证和清理。
- `lib/ai/providers`：DeepSeek Responses、Search、Fetch 适配；对上只暴露统一任务协议。
- `tests/unit|integration|e2e`：对应领域、边界和用户流程。

环境变量沿用 spec：`SUPABASE_SECRET_KEY`、`AI_PROVIDER=deepseek`、`AI_MODEL=deepseek-flash`、`AI_MAX_COST_CNY=2`，并配置人工维护的 `AI_USD_CNY_RATE`。任何 API key、Supabase secret key、密码哈希、Auth secret 都不得使用 `NEXT_PUBLIC_`。不增加用户/角色/组织环境变量或表。

Supabase 本期只使用 Free，并在新加坡 `ap-southeast-1` 创建开发项目；不购买 Pro，不承诺长期在线或生产级自动备份。接受项目不活跃后可能暂停。登录失败限流使用同一 PostgreSQL 的最小 `auth_login_attempts` 表，不增加 Redis 或额外网关。

## 8. 验收与变更契约

### 8.1 关键契约验证

| 契约 | 最低验证 |
|---|---|
| 鉴权 | 未登录逐个请求所有业务页面/API/图片均不能取得数据；伪造和过期 Cookie 失败 |
| 单用户归属 | 请求体中的 owner/user 字段被拒绝；客户端不存在 Supabase secret key/AI key |
| 默认排序 | 固定样本覆盖已到期、今日、未来、未知，顺序严格符合 BR-007 |
| 四维筛选 | 已开封 + 0–30天 + 豆沙 + 指定品牌只返回交集，summary 口径稳定 |
| 日期 | AC-006/007 全部边界 100% 单元测试通过；跨上海午夜重新计算 |
| 时间轴 | 三节点始终存在，缺值文案正确，页面无“提醒截止日” |
| 幂等 | 双击/重放相同 key 只生成一条；key 冲突返回 409 |
| 乐观锁 | 两标签编辑，旧 revision 不覆盖且草稿保留 |
| 图片 | 4 张、>10MiB、伪 MIME、损坏图被拒；私有 URL 不可匿名访问 |
| AI | 候选确认前不查错误产品期限；取消迟到结果无效；dirty 字段不被覆盖 |
| AI 降级 | 无结果/冲突/超时/无配置均可手填保存，不生成假来源或假日期 |
| PAO | unopened 隐藏；opened 成功显示值和来源，失败显示重试/手填 |
| 生命周期 | discard 后列表/compare 同步减少，无 finished/历史/恢复入口 |
| 删除 | 验证数据库业务记录/关联元数据硬删除、图片进入清理且接口不可再读取 |
| 响应式 | 375px 完成登录、上传、编辑、筛选、详情、删除确认；1440px 基本可用 |
| 性能 | 100 条库存筛选反馈 ≤300ms，首页读取 ≤2s，未达标需如实记录 |

### 8.2 契约变更流程

任何字段、枚举、默认排序、期限算法、接口路径、状态码或鉴权方式变化，必须在同一变更中同步：

1. 最新 PRD（若改变产品行为或验收）。
2. 原型及页面规格（若改变可见交互）。
3. `spec.md`（技术设计、表结构、开发任务）。
4. `contract.md`（请求/响应、状态与责任边界）。
5. 数据库 migration 和兼容/回滚说明。
6. 前后端 schema/types、API 实现与调用方。
7. 单元、集成、E2E 和 fixture。

破坏性变更必须提升 API 或 schema version；不得只改一端后要求另一端“自行兼容”。AI prompt/model 变化即使不改 HTTP schema，也必须更新 workflow/model version 并重跑同一评测集。

## 9. 已确认决策与上线前操作

### 已确认决策

1. 真实 AI 由用户点击“开始识别”触发；上传图片不自动外传。
2. 永久删除采用硬删除，无回收站。
3. 登录采用固定用户名 + 密码输入，不开放注册，不接邮箱/短信/第三方登录。
4. 模型采用 DeepSeek V4.1 Flash（API 名 `deepseek-flash`）做视觉和结构化输出；资料检索采用 DeepSeek 官方 Search/Fetch；单任务费用上限人民币 2 元。
5. Supabase 使用新加坡区域和 Free 套餐；本期仅用于初期开发验证，不升级 Pro。
6. 登录限流采用 PostgreSQL 最小表实现，这是当前依赖下最容易部署和维护的方式。

### 上线前操作

- 在 DeepSeek 控制台创建 API Key、充值，并核对当日模型/Search/Fetch 单价及图片数据政策。
- 设置固定用户名、生成 Argon2id 密码哈希和 32 字节以上 Auth secret；明文密码只由本人保管。
- 在 Supabase 新加坡区域创建 Free 开发项目；完成一次 PostgreSQL 手工导出和 Storage 图片下载。本期不做生产级恢复演练。
- 在 Vercel 设置服务端环境变量，使用默认 `vercel.app` 开发/预览地址即可；本期不要求购买或绑定正式域名。图片上传与 AI Route Handler 使用 `sin1`，与新加坡 Supabase 就近通信。确认客户端构建产物不包含任何密钥。

### 官方能力核对记录

- DeepSeek `deepseek-flash` 当前对应 V4.1 Flash，支持 Vision、Responses API 和 JSON Schema；Responses 内置 `web_search` 当前只支持不具备 Vision 的 `deepseek-v4-pro`，因此本期采用 Flash + 独立 Search/Fetch API。
- Supabase 当前无中国大陆 region；可选邻近 region 包括 Singapore、Tokyo、Seoul。
- 本期选用 Supabase Free，因此不需要国际付款方式；Free 的暂停和备份限制作为已接受的开发环境约束。
- 核对日期：2026-11-03。开发启动和上线前再次检查官方价格与区域页面。

