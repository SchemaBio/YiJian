# AI 辅助功能接入交接

2026-10-11。YiJian 与 Cuttlefish 已从待接入适配器切换至 Octopus 的 SepiLens 接口。本轮真实收费关闭，未部署；SepiLens 引擎和结算约定由其项目独立维护。

## 页面与接口

- 样本新增、编辑、详情：诊断字段旁的 AI 图标生成 HPO。仅 present 术语追加到草稿，其他极性提示复核；使用现有术语库校验编号、去重和规范名称，不自动保存样本。
- 两版 ACMG、CNV Gain/Loss：按服务能力开放入口并展示禁用原因。模型建议、规则结果和人工判定独立处理，不自动覆盖计算器或保存解读。
- 临床上下文：带入已有疾病/遗传模式、样本类型及 HPO；缺失必填项时弹窗补充。未确认来源保持 unknown，不推断为已确认胚系。
- CNV 人工解读与变更记录继续使用已有行调整 API。
- 开源管理员配置默认关闭，Cuttlefish 平台默认开启。支持端点、Key、模型及 Responses/Chat 协议；Key 不回显、不写入浏览器存储，空 Key 保留原值，支持显式清除。

YiJian 的 src/lib/ai-assistance-client.ts 通过现有 api 客户端访问 /v1/ai-assistance/settings、/requests、/requests/{requestId} 及取消接口，自动按后端映射至 Squid 的 Octopus 代理。Cuttlefish 的 /api/manage/ai-settings 沿用管理鉴权、CSRF、操作原因及元数据审计，代理同一配置接口。

## 请求生命周期

RC2 能力区分候选提取、草案实验及正式评估。SVC 入口发送明确 experimental 模式和独立 draftAssessment，自动带入当前结构化方法材料；来源保持 unknown，需用户明确确认胚系来源后才执行，且始终显示未核验、禁止临床用途、不可采纳提示。实验结果不提供“填入人工解读”。正式 ACMG/CNV 继续遵守批准门禁。

HPO 原文只在后台执行内存驻留；恢复原文失败时显示不确定，不自动换键重跑。HPO 极性保持，只有 present 追加；返回的 Unicode 字符跨度在客户端转换为 UTF-16，越界跨度丢弃。终态失败/取消后再次由用户点击生成才用新键；网络错误和 uncertain 保留原键。

前端每 2 秒查询请求。切换位点或离开页面只停止观察；只有明确“取消”才调用取消 API。重复点击被拦截，网络错误重试相同输入复用幂等键；成功或输入变化后换新键。后台负责执行、恢复及幂等结算。

配置及能力每 30 秒刷新。服务未就绪、模型未配置、平台关闭或引擎禁用时禁止发起请求；服务端独立校验权限、能力和任务解读锁。

## SaaS 费用

HPO、SVC 实验及 evidence_only 收费尚未启用。正式变异结算还需同时符合平台策略与上游 production + delivered + settlement_eligible；真实收费本轮全部关闭。

Cuttlefish 管理员可明确发起模型能力测试，先确认可能产生模型服务商费用，不扣平台积分。测试不在保存配置时自动执行；supported/unsupported/unknown 分别显示，HTTP 200 不代表能力全部支持。管理接口沿用 {data: ...} 包装，由 HTTP 客户端解包。

真实收费关闭时显示“联调期间不扣费”，不弹扣费确认。结算约定对齐并开启后恢复 1 积分确认和“本次会话不再提示”；sessionStorage 偏好按用户/机构隔离，所有入口共享，不豁免扣费。

Squid 的 AI 账目使用独立请求引用；费用中心通过 related_task_id 显示完整关联任务 UUID，不混入分析任务的结算或退款。浏览器不能决定实际扣费。

完整字段映射、镜像构建、运行变量、数据恢复和验证方式见 Octopus 的 docs/SEPILENS_INTEGRATION.md。本轮未提供绕过门禁、模拟判决或本地模型降级路径。
