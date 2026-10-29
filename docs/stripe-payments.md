# 科研服务额度与 Stripe Checkout

YiJian SaaS 已对接 Squid 支付能力，不再是仅预留状态。自部署 Octopus 不开放该充值流程。每件对应 1 积分，单次 1～5000；币种及单价来自服务端，不以计算费率冒充售价。

`/service`、`/terms`、`/refund` 无需登录，支持四种界面语言，官网统一链接到这些页面。首版正文 `src/i18n/service-policy-v1.json`，版本 `research-service-2026-10-29-v1`，不可原地改写；修订须新增文本版本、保留历史路由并同步 Squid 常量。

`GET /api/v1/service-policy` 返回当前版本、链接和真实运营资料；未配置不填示例信息。充值页默认不勾选购买确认。新 Checkout 发送 `{product:"credit",quantity:N,accepted:true,policy_version:"…"}` 和 Idempotency-Key，所有支付请求 `coreApi:false`。版本过期刷新政策并清除勾选；未知版本不能新付款。

超时重试保持原幂等键，历史确认不追溯修改。切换组织清除确认和展示，旧请求迟到不跳转另一组织 Checkout。成功返回页仅查询订单，不加积分。测试支付不增加真实余额。

新正式订单必须通过独立业务审核记录、政策、端到端测试、账户状态及额度检查。暂停不代表旧 Checkout 会话取消；原订单、回调、退款和对账继续处理。

退款通过公开客服邮箱人工受理，正常三个工作日内答复，不要求健康数据。未使用付费额度可申请，已使用原则上不退；组织共享余额不能直接视作单笔可退额，不新增站内退款 API。

完整后台契约、发布、人工退款及回退要求见 Squid `docs/STRIPE_PAYMENTS.md` 和 `docs/PAYMENT_SAFETY.md`。发布顺序 Squid → Cuttlefish → YiJian/官网。无真实 Stripe 测试凭据及公开回调时，不得宣称真实收款验收完成。

公开政策页在服务端读取运营资料，避免支付审核抓取只看到占位提示。SaaS 部署可设置 `YIJIAN_SERVER_API_URL=http://squid:8080/api`，该地址仅供服务端访问，不从请求 Host 推导，也不转发登录凭据。
