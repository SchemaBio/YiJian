# 初评性能优化与计算节点镜像发布

2026-10-08，Asia/Shanghai。用户明确授权将本次 YiJian 修改发布到生产服务器，并将计算节点系统镜像更新为 `img-b1dhdlia`。

- YiJian 运行镜像：`schemabio/yijian:assessment-perf-20261008-78ae792e`，healthy。
- Squid 应用镜像：`schemabio/squid:workflow-center-20261007-f553661f`，healthy。仅更新计算节点镜像配置并重建容器；Compose 与运行环境的 `CVM_IMAGE_ID` 均为 `img-b1dhdlia`。
- Octopus、Cuttlefish 与 parquet-query 均 healthy；两个网关健康接口及 YiJian 登录页面检查通过。
- 发布后核对 14 个登录页静态资源；通过现有账号只读核对归档任务 `73ac68fd-4f6e-437b-8244-d16b09bbc7e1` 的固定 attempt `5298563b-0d4a-4a28-93c9-e10f86d3b2fe`：激活初评上下文可读取，证据 138,919 条，SNP/InDel 55,393 条，所有七类数据行数合计 138,919 条。结果记录在 `post-deploy-verification.json`，未输出凭据、注释内容或签名地址。
- 同步了 10 个源文件及开发验证记录，按远端旧源码哈希核对基线，再按新哈希验证内容；远端构建成功。使用主 Compose 与 Parquet override，仅针对 Squid、YiJian 执行 `up -d --no-deps`，并重新加载网关解析新容器地址。
- 发布备份与验收证据：`/home/ubuntu/schema/backups/assessment-perf-20261008-78ae792e/`。含旧源码、0600 配置备份、旧镜像身份、源文件哈希、构建与发布日志、`status.json` 和 `acceptance.json`。保留回滚镜像。

本次采用受控源文件同步发布，未执行 GitHub push。未重新投递工作流、创建计算实例或修改人工判读；系统镜像启动及真实浏览器全量初评性能仍需后续验收。

## 后续真实浏览器检查：未通过

2026-10-08 使用 Codex 浏览器打开上述固定归档任务，从总览进入变异判读。页面触发初评，先显示“正在加载初评证据 · 已处理 0 条”，随后显示“初评失败”，具体错误：`Invalid Input Error: Failed to read file "assessment.parquet": Snappy decompression failure: Uncompressed data size mismatch`。

这次检查证明当前生产初评仍无法完成，服务健康和接口验收不能替代浏览器全量验收。错误发生在读取用于初评的 Parquet 时；尚未确定是数据文件问题还是浏览器引擎读取问题。未达到完成状态，无法验收结果分页。现场截图保留在本地 `.gotmp/assessment-browser-failure-20261008.png`；未修改人工判读或回报。

## 修复及真实浏览器复验：通过

同日发布 `schemabio/yijian:assessment-snappy-20261008-c71e87d4`，仅更新 `src/lib/parquet-browser.ts` 并重建 YiJian。初评读取不同 Parquet 时原先统一使用 `assessment.parquet`；现改为 `assessment-<table>-<objectSha256>.parquet`，避免同一路径重新注册不同内容时复用引擎外部文件缓存。同时将注册后的创建、核验及流式消费纳入 finally 清理，创建失败也释放文件。

源码更新前后 SHA256、旧源码、0600 配置备份、构建与健康结果存放在 `/home/ubuntu/schema/backups/assessment-snappy-20261008-c71e87d4/`。构建通过，节点镜像仍为 `img-b1dhdlia`。本地类型检查与完整前端回归 101 项通过；合成 Node-WASM 复现未完成（阻塞在本地扩展加载），不作为修复证据。

使用 Codex 浏览器重新加载固定归档任务，实际页面从加载证据推进到“初评完成 · 自动置顶 0 条”。全量流程包含固定上下文的七类表，共 138,919 条；此前 Snappy 错误未再出现。逐一确认 SNP/InDel 55,393 条、CNV Region 64,732 条、CNV Exon 18,414 条均正常载入，均能翻到第二页（总页数分别 2,770、3,237、921）。控制台检查未发现错误。成功截图：本地 `.gotmp/assessment-browser-success-20261008.png`。

未修改人工判读、置顶或回报；本次证明执行及分页恢复，不代表全部临床证据齐备，也不替代人工判读、完整性能测量或 IGV 验收。
