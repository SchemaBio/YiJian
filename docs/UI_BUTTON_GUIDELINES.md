# YiJian 按钮与图标规范

YiJian 开源版和 SaaS 共用本规范。范围为操作按钮；导航、标签页、数据选择项、普通基因与坐标链接以及家系/信号绘图保持各自语义，不为这些元素批量增加装饰图标。

## 使用方式

使用 `src/components/shared/ActionButton.tsx` 的 `ActionButton` 和 `IconActionButton`，基于现有 UI Kit Button，不修改 UI Kit 包。

```tsx
<ActionButton action="save" loading={saving} loadingLabel="保存中…" onClick={save}>保存</ActionButton>
<IconActionButton action="copy" size="small" label="复制完整 UUID" onClick={copy} />
```

`action` 选择固定语义，不负责调用业务方法；没有 `action` 就显示文字。普通弹窗取消、继续、确认、清空筛选无需图标。`IconActionButton` 必须提供 `label`，可以通过 `hint` 说明不可用原因；已在 HoverHint 内的纯图标操作可使用 `ActionButton iconOnly`，保留可访问名称。

- 普通按钮 32px 高，16px 图标；表格操作使用 `size="small"`，28px 高，14px 图标。
- 纯图标按钮分别为 32×32px、28×28px；图标线宽 1.75，间距 6px，颜色继承按钮。
- 新增 Plus，编辑 Pencil，保存 Save，刷新 RefreshCw，重试 RotateCcw；启动 Play，取消执行 Square，等待 Clock。
- 删除 Trash2，关闭 X，复制 Copy，复制成功 Check；上传 Upload，下载/导出 Download。
- 解读 BookOpen，完成 CheckCircle2；完成解读 LockKeyhole，取消解读完成 UnlockKeyhole；AI Sparkles，外链 ExternalLink，更多 MoreHorizontal。
- 当前锁定版本的 CheckCircle2/UnlockKeyhole 对应新版 CircleCheck/LockKeyholeOpen 的语义，保持依赖版本不变。
- 所有关键或破坏性操作保留文字；灰色等待按钮不可点击；保留原业务权限、确认及解读锁。
- 加载时由 `loading` 统一替换为 Loader2 并禁用点击，`loadingLabel` 与正常文字共同预留宽度。只在实际异步处理期间加载，不将“只读/能力不可用”标成处理中。
- 普通按钮默认为 `type="button"`；真实表单提交必须显式 `type="submit"`。ref、Popover asChild 及事件继续透传。
- 图标按钮外层结构在加载时保持稳定，防止丢失焦点、ref 或异步测试的 DOM 引用。禁用原因可悬停读取，正常按钮可通过键盘聚焦查看提示。
- 动画尊重系统的减少动画设置。主题颜色使用已有 tokens，不增加独立配色。

## 页面迁移清单

- [x] 任务中心、新建/编辑/批量任务、执行状态按钮。
- [x] 变异详情、两版 ACMG、CNV、人工解读、回报、初评重试、结果下载、IGV 重试。
- [x] HPO、ACMG、SVC、CNV Gain/Loss 五类 AI 入口共用组件。
- [x] 样本、家系及数据匹配操作、UUID/表格复制反馈。
- [x] 历史检出、数据中心、分析流程及配置资源操作。
- [x] 费用、设置、权限、管理页面及公共表单按钮。
- [x] 公共确认弹窗、分页、工具弹出层操作按钮。

## 许可及发布

`public/licenses/lucide.txt` 保留 lucide-react 安装版本的 ISC 许可、版权信息及 Feather 来源部分的 MIT 许可。从关于页可打开全文，现有 Dockerfile 将整个 public 目录复制到运行时，因此无需额外镜像下载或新增依赖。升级图标包时同步核对该文件。

## 验证

公共组件测试覆盖 ref、点击与加载防重复、表单提交、纯图标名称、聚焦/Escape 提示及禁用原因。复用现有 AI/IGV/CNV、解读锁、资源读取和历史聚合测试。

视觉验证仅使用本机开发模拟身份与合成任务，不连接生产服务，不调用真实 AI。检查 1280、1440、1920px 桌面视口，按钮正常/加载/等待/禁用状态及浅色/深色主题。临时 API 测试夹具在交付前移除；不将模拟登录开关写入生产配置。

本轮全量回归通过 243 项（另有 1 项跳过）；最终公共按钮、弹窗、AI、筛选和解读锁检查通过 20 项，生产构建与 TypeScript 检查通过。桌面预览存放在 [button-evidence](button-evidence/)，包括浅深色任务中心、加载状态和弹窗；截图中的任务均为合成数据。
