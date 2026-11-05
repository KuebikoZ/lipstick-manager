# 口红柜：从剩余开发到上线执行 Prompt

将下面整段交给开发 AI。T5、T9 已完成，它从 T9.5 开始执行到 T10 唯一一次人工验收；用户确认验收通过后，继续完成 T11 上线。

```text
你现在负责把当前口红柜项目从剩余开发推进到可上线并完成上线。持续工作，不要只给计划或等待我逐步下达任务。

项目目录：
/Users/xuerou/Desktop/求职相关/秋招面试准备/互联网/vibe coding/product-workspace/lipstick-manager

开始前必须完整阅读并遵守：
1. /Users/xuerou/Desktop/求职相关/秋招面试准备/互联网/vibe coding/product-workspace/AGENTS.md
2. inventory/prd/current.yaml 指向的当前 PRD
3. inventory/spec.md
4. inventory/contract.md
5. inventory/prototype/current.yaml 指向的原型；最终交互以 app/app.js 后加载的 app/overrides.js 为准
6. package.json、现有代码、测试、migration 和当前 git diff

当前工作树可能已有未提交修改。它们属于用户。先检查并理解，不得覆盖、回滚、删除或把无关改动混入你的实现。发现冲突时只暂停受影响部分，继续完成其他工作。

已完成基线：
- T5 AI 图片识别基础闭环：b030b052e9d7b6944e052b136afaef0899de4233
- T9 AI 识别与检索质量收口：3a116d6195834173c75d72a65330cc2960684f0b
- 批次 B Preview 反馈修复后的稳定点：8c661c0897e9babc5efda3275d6cd05c94c3fa8a
- 5 个授权真实样本、11 张图片的脱敏评测报告已在 inventory/evaluation/ 中生成

不得重新实现或重新验收 T5/T9。先核对上述提交和现有代码；只有 T9.5 接入引起的必要兼容修改或回归缺陷才允许改动相关模块。当前执行顺序固定为：T9.5 → T10 → T11。

一、T9.5：产品度量闭环
- 只实现六类事件：page_view、action、intake_start、ai_result、save_result、intake_end。
- action 只覆盖 filter_apply、sort_change、compare_color_select、ai_suggestion_adopt、ai_suggestion_ignore、ai_suggestion_correct。
- 实现白名单 schema、event_id 幂等、session_id/intake_id/task_id 关联、环境隔离和指标汇总查询。
- 不记录图片、备注、产品身份正文、日期值、完整 URL、Cookie、密钥、提示词或模型原文。
- 不增加第三方分析平台、分析看板、逐卡片曝光、滚动深度或定时心跳。
- 使用 inventory/evaluation/product-validation-template.md 准备 T10 验收记录。

T9.5 完成后：
- 运行与改动相称的 lint、typecheck、unit/integration/e2e、build 或 pnpm check。
- 修复由本次工作引入的问题。
- 创建清晰的 checkpoint commit。
- 汇报实际命令和结果。
- 不要求用户进行人工验收，不询问是否继续，不为每个任务单独生成 Preview。

二、T10：唯一一次人工验收
- T9.5 完成且全项目自动检查通过后，统一推送并生成一次最终 Vercel Preview。
- 在交给用户前，先自行完成所有能够自动或代理完成的检查：自动测试、构建、接口、鉴权、密钥扫描、事件关联/去重/脱敏、指标复算、移动端视口、桌面键盘、失败恢复和数据导出检查。
- 准备好完整测试数据，并把唯一一次人工验收压缩为一份连续清单，覆盖：真实手机关键流程、真实 AI 外传与结果、手工降级、五项受控任务，以及无法由代理可靠完成的真实设备/主观理解检查。
- 不把可自动验证的事项交给用户。
- 用户只执行这一次人工验收。若发现问题，修复后沿用同一份验收记录，只复测失败项和受影响回归项，不另起第二轮完整验收。
- 在用户明确回复“T10 验收通过”或等价表述前，不执行 Production migration 或 Production 部署。

三、T11：验收通过后直接上线
- 用户明确确认 T10 验收通过，即视为已经授权执行 T11；不要再次询问是否允许上线。
- 上线前以只读方式核对目标 Production 项目、域名、环境变量、migration 列表、私有 bucket、备份/导出条件和将执行的确切目标，避免环境误用。
- 只在 T11 对 Production 执行 migration，随后执行 Production 部署。
- 完成自动或代理可执行的生产冒烟检查：健康检查、登录保护、未授权 API、核心读写、私有图片、AI 失败降级、事件写入和错误监控。
- 生产冒烟是上线验证，不组织第二次人工验收。
- 上线验证通过后开始 Production 真实试用记录，并保证 Preview/T10 测试数据不计入真实试用指标。
- 若外部平台弹出不可绕过的账号授权、凭据输入或安全审批，只在该动作实际成为阻塞时，准确说明需要用户完成的唯一动作；完成后立即继续，不重跑已通过工作。

全程要求：
- 不扩大产品范围，不增加多用户、角色、组织、分享、历史恢复、推送、交易或精确色差能力。
- 不使用模拟 AI 冒充真实结果，不伪造测试、Preview、部署或验收状态。
- 不擅自执行生产操作，直到用户明确确认 T10 验收通过。
- 保持进度更新；每个更新说明已完成、验证结果和下一步。
- 最终交付包括：生产 URL、部署版本/commit、migration 结果、自动检查与生产冒烟结果、已知限制、真实试用记录位置。

现在开始：先检查工作树和必读文档，然后直接执行当前尚未完成的第一个任务。
```
