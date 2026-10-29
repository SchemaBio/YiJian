# 2026-10-29 周末上线准备核对

核对时间：2026-10-29 12:46（Asia/Shanghai）。结论：服务运行健康，但尚不能宣布正式收款或客户试运营验收完成。本次仅提交代码和只读核对，没有 push、部署、配置 Stripe、发起付款、AI 或计算任务。

## 已完成与现场证据

- Squid `2c1abc3`、Cuttlefish `d2e7c02`：直接配置密钥、币种和每积分售价；保存后暂停，显式同步价格、验证、启用；旧订单保留原价格。前端相关 27 项测试、类型检查、生产构建及后端隔离 PostgreSQL 支付回归、全仓编译检查通过。未使用真实 Stripe 凭据。
- 当前 Squid / Cuttlefish / YiJian 镜像仍为 `stripe-payments-20261028t152642z`；Octopus / SepiLens 为 `github-refresh-20261028t143037z`。五服务 healthy、running，RestartCount 均 0。新后台定价及上一轮 YiJian 充值页排版尚未部署。
- YiJian 登录页和 Cuttlefish 入口 HTTP 200；无签名 Webhook 返回 400。该结果只证明到达验签门禁，不证明 Stripe 真签名投递正常。
- test/live 均 disabled、unverified，API Key / Webhook Secret 均未配置；payment_profiles / versions / orders / events 均零行。
- `SAAS_SETTINGS_PRESERVE_APPLIED=true`；仍有一项待应用计算配置，未应用或清除。
- 支付主密钥文件存在、权限 0400；第 41 节保护目录内 `payment-master-key`、`squid.dump`、`octopus.dump` 存在。仅核对文件存在与元数据，没有读取密钥或执行恢复。数据库备份大小分别 235823、98328949 字节。
- 主机可用磁盘约 14.3 GiB；下一次构建前需根据实际镜像和备份大小重新核对空间。

## 上线前待关闭事项

| 事项 | 当前证据与通过标准 |
| --- | --- |
| 发布版本 | 先推送已审查提交并锁定各仓 revision / 镜像摘要。按 Squid → Cuttlefish → YiJian 发布，新增支付表迁移前重新备份；保留支付主密钥与 preserve-applied，核对待配置前后不变。 |
| Stripe 测试闭环 | 管理员提供测试 API Key 与 Webhook Secret，配置币种/售价，真实同步并验证；用 Stripe 测试卡完成 Checkout、真实签名回调、模拟到账、退款与对账。确认生产余额与真实充值流水不变；重复投递不重复到账。合成测试不能替代。 |
| 正式收款配置 | 确认 Stripe 账户已满足收款条件、live 密钥/回调/最终币种售价正确，权限满足后台创建商品价格；核实公开回调没有交互挑战。管理员验收后主动启用；此前保持关闭。 |
| 计算执行回归 | 现有 `TestDurableQueueConcurrentAdmissionAndCancellation` 超时、CVM `Expiry fence unavailable` 已在干净基线复现，仍未解决。对最终版本补齐隔离 PostgreSQL 围栏/会话/账务、20 并发模拟云、失败/抢占/重启/资源回收的结果与风险处置。真实云端全链路验收由有权限的人员安排，不自动触发付费任务。 |
| 租户隔离与用户流程 | 对最终部署版本用两个隔离组织检查样本、上传、任务、结果、报告、下载、支付订单互不可访问；完成注册审核、登录退出、充值关闭时人工入口、失败提示等用户流程。此前局部通过不能代替本次完整发布记录。 |
| 备份与回退 | 发布前生成最新业务库/部署配置/密钥保护备份；在隔离环境验证可恢复。现有回退脚本会因待计算配置或 live 订单拒绝执行，须准备保持 applied 配置及在途支付处理能力的兼容回退；不得覆盖恢复旧账本。 |
| 运行保障 | 确认健康、磁盘、数据库、失败事件、对账积压、计算资源回收的告警与当班负责人；保留发布观察和应急暂停收款操作说明。当前只证明健康，不证明告警链路已演练。 |
| 示例数据（若列入首发） | 第 39–40 节的模板选择、发布与真实隔离组织发放验收仍需最终核实；没有证据时不承诺新用户自动获得示例。 |

完整历史与连接方法见 [远端交接](REMOTE_SERVER_SESSION_HANDOFF.md)。通用发布门禁见相邻 Squid 仓库 `docs/RELEASE_CHECKLIST.md`，支付操作见 Squid `docs/STRIPE_PAYMENTS.md` 与 Cuttlefish `docs/stripe-payments.md`。本记录中“待关闭”表示本轮没有足以证明最终验收完成的证据，不推断所有相关能力均不可用。
