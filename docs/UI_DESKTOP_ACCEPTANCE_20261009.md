# YiJian 桌面风格更新验收

本记录对应当前工作树及此前风格提交。只验收桌面视窗；本地浏览器使用真实页面组件和合成数据，未提交患者资料、账户、权限、充值或下载操作。代码尚未提交、推送或部署。过程证据见 UI_STYLE_AUDIT_20261009.md。

## 十项要求

| 要求 | 实现与验证 |
|---|---|
| 1 悬停统一 | 142个生产TSX文件AST检查：73处HoverHint、18处nav Tooltip，无原生title或其他Tooltip变体。HoverHint与坐标提示共享白底/深色文字、边框、箭头；暗色主题对应深色底。实际样本HPO键盘聚焦提示已查看，鼠标延迟/键盘/关闭/空闲监听回归通过。 |
| 2 逐页检查 | 下表覆盖全部28个page.tsx路由。源码检查、实际页面组件浏览器证据和相应恢复测试均记于过程记录。 |
| 3 清理提示 | 已移除“结果可判读”、取消初评横幅、重复UUID教学、重复用户菜单设置、空资源标识清单及空分组。保留影响临床判断、保留期限、费用与错误恢复的必要信息。 |
| 4 基因刷新 | SNVIndelTab刷新使用yj-tool-button，实际任务页面已查看，与筛选/导出工具统一。 |
| 5 样本详情 | SampleSummaryCard复用ToolbarPopover，720px桌面浮层，统一主题/边框/留白/关闭入口；实际任务路由打开验证。 |
| 6 初评紧凑 | ResultTabs旁的评估信息/重试按钮在同一标签栏；55,393行取消合成状态正常显示，无aborted错误与独立横幅。 |
| 7 全站一致 | 统一面板、工具按钮、弹层页脚、只读字段、语义反馈；设置和配置增加桌面列数，共享操作从错误内容列移至操作区，修复历史搜索图标重叠。 |
| 8 概览改善 | 工作台已有接口数据形成五项指标、最近任务、待处理事项；任务总览有检出/回报/成员/基因组、八类结果表、样本性别核对及质控。缺失/失败不虚构0，运行任务才展示有效进度；实际桌面路由查看。 |
| 9 账单颜色 | 七种类型DOM计算样式确认七组不同前景/背景：绿、黄、红、青、蓝、紫、橙；两个费用路由均查看。 |
| 10 效率 | 保留分页/Worker、移除每秒时钟，新增悬停仅激活目标挂载浮层/监听，排版未增加数据请求、轮询或动画。55,393行Worker最大回复1000行及10万历史记录性能回归通过。 |

## 路由证据索引

| 页面 | 桌面证据 |
|---|---|
| / | 合成登录/未登录实际HomePage到dashboard/login；加载status标签 |
| /dashboard | dashboard-desktop-progress-final.jpg，指标/最近任务/待办 |
| /samples、/samples/[uuid] | samples-desktop-hint.jpg、sample-edit-desktop.jpg、sample-detail-desktop-final.jpg |
| /samples/pedigree | 桌面列表、过程记录家系图/成员详情/编辑/关联与失败恢复 |
| /data | data-upload-desktop-final.jpg、列表与读取失败恢复 |
| /tasks、/tasks/new | tasks-desktop-progress-final.jpg、new-task-desktop-final.jpg |
| /tasks/[uuid] | assessment-cancelled-desktop-final.jpg、sample-popover-desktop-final.jpg、variant-desktop-1600-inspector.jpg、reports-desktop-final.jpg；过程记录八类变异、详情和图表 |
| /history | history-desktop-search-spacing.jpg，来源追溯与实际搜索 |
| /pipeline | pipeline-edit-desktop.jpg、列表 |
| /pipeline/config | config-desktop-density-final.jpg、首次失败/刷新恢复记录与测试 |
| /pipeline/gene-list | gene-list-desktop-actions-final.jpg、编辑/保存失败记录 |
| /pipeline/bed、/pipeline/baseline | 桌面资源表，过程记录上传/校正弹层及恢复测试 |
| /pipeline/templates | templates-desktop-actions-final.jpg，操作区与弹层 |
| /billing、/settings/billing、/billing/recharge | billing-desktop-seven-colors.jpg、settings-billing-desktop-final.jpg、桌面充值数量/预估/入账 |
| /settings、/settings/permissions | settings-desktop-density-final.jpg、permissions-desktop-final.jpg（真实权限组件合成自部署入口；SaaS重定向规则保留） |
| /admin | 桌面机构/指标/预警/任务，过程记录编辑/开通与失败恢复 |
| /about、/privacy | about-desktop-final.jpg、privacy-desktop-header-final.jpg |
| /login、/register | login-desktop-final.jpg、实际桌面注册表单 |
| /forgot-password、/reset-password | 实际桌面说明页及返回登录；保留管理员核验方式 |

截图目录为`.gotmp/style-audit/`。1280桌面窗口与1600×900并排判读断点均查看，长ClinVar标签overflow=visible、单元格204.67px、标签180.67px。桌面不足以容纳表格所有列时，保留表格内部横向滚动。

## 最终代码检查

2026-10-09收尾运行：48测试文件通过、1跳过；158项通过、1项跳过，34.67秒。生产构建成功，TypeScript成功，全路由生成成功；git diff --check通过。跳过项为独立engine性能基准，55,393行Worker及10万历史索引性能回归实际执行并通过。构建与测试并行执行，因此本轮耗时不作为独立性能对比。

桌面风格更新已完成本地实现和逐页检查。生产部署、真实账户交易和真实临床数据验收没有在本次风格工作中执行。
