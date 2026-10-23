# Stripe 充值预留

本阶段继续人工充值申请，快捷数量为 100、500、1000、5000，默认 500。
自定义输入仅接受 1～5000 的正整数，非法输入明确报错，不能复制申请。
每购买 1 个 Credit 对应 1 积分。

`src/lib/payments.ts` 定义 Squid 的支付能力和结账接口；所有请求使用
`coreApi: false`，不经过 Octopus。结账请求携带 `Idempotency-Key`。
`GET /api/v1/billing/payment-options` 返回 `not_integrated` 和空价格；
`POST /api/v1/billing/checkout-sessions` 对合法请求返回 503、
`PAYMENT_NOT_INTEGRATED`，本次没有成功响应或 Stripe 支付按钮。

当前界面不显示虚构的货币金额。任务费率仅用于计算可用运行分钟数，
不参与 Credit 售价计算。自部署 Octopus 保持原行为。

后续对接需要完成价格、Checkout、订单、Webhook 验签与幂等入账、对账、
退款和拒付策略。前端支付成功跳转不得触发加积分。完整后端契约见
Squid 仓库 `docs/STRIPE_PAYMENTS.md`。
