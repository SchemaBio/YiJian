# 浏览器表格生产加载修复

日期：2026-10-01。

## 根因和漏测

生产页面及两份 DuckDB Worker 的 CSP 仅允许 self 和 nonce，未允许 WebAssembly 编译。DuckDB 的异步初始化在部分编译错误下不能及时拒绝 Promise，因此表格一直等待。

补上编译权限后还发现默认扩展仓库依赖：锁定的 DuckDB-Wasm 1.32.0（引擎 v1.4.3）需要动态加载 Parquet/JSON；显式 SET TimeZone 又触发 ICU 下载。生产 connect-src 阻止外部扩展域名。本地夹具此前没有生产 CSP，并能访问默认仓库，所以没有暴露故障。

本次不再把仅有进程、HTTP 200 或裸 SQL 可执行当作完整表格验收。

## 修改

- 页面允许 wasm-unsafe-eval，继续禁止 JavaScript unsafe-eval。
- Emscripten 所需的动态 JavaScript 权限严格限制到 `/duckdb/duckdb-browser-eh.worker.js` 和 `/duckdb/duckdb-browser-mvp.worker.js` 两个响应，不给任意路径或整个站点。
- JSON、Parquet 的 EH/MVP 扩展从官方来源取得，以 scripts/duckdb-extensions.json 固定版本、路径及 SHA-256。构建复制到 public/duckdb/extensions；缓存不存在时下载并验证哈希。DuckDB 的默认扩展签名验证保留。
- 浏览器指定同源扩展仓库，显式 LOAD parquet/json 后关闭自动安装与自动加载。移除本流程不用的 TimeZone 设置，不下载 ICU。
- Worker 初始化增加 45 秒无进展期限、最长 180 秒总期限、错误及取消处理；下载持续报告进展时重置空闲期限，避免健康下载被固定 45 秒中断。
- 核心 WASM/Worker 发布到 `1.32.0-csp2` 版本目录；新 URL 避免旧 Worker CSP 缓存。仅固定的四个核心资源使用一年 immutable 缓存。
- Docker 构建排除 .gotmp，防止测试副本及临时授权进入镜像。

## 验收

- 已确认旧生产 login 与 Worker 响应都没有 wasm 权限。
- 相同生产 CSP 的本地浏览器夹具复现旧策略一直等待；限定 Worker 权限后 SQL 可执行；禁用外部下载并自托管扩展后能读取 Parquet。
- 正式 parquet-browser.ts、实际任务 73ac68fd 的 Parquet 和压缩自动基线、实际调整快照验证通过：记录 55,393，首屏 20 行，稳定 rowId 已生成。数据文件通过现有 SHA-256 和行数校验。
- 夹具使用授权本地副本和模拟权限接口，未取得用户登录会话，因此不声称完成登录生产页面点击验收。
- 前端 37 项测试和 TypeScript 检查通过；覆盖生产 CSP、Worker 权限路径限制、启动超时、持续进展、错误处理与同源扩展配置。
- 发布后核对同源扩展 HTTP 200、校验值及容器健康。用户需刷新原页面以取得新 CSP；旧页面本身保留旧安全策略。

官方依据：[CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)、[DuckDB-Wasm 扩展](https://duckdb.org/docs/stable/clients/wasm/extensions)。

## 公网复测与性能边界

- 2026-10-01 通过真实公网域名、生产页面/Worker CSP 和相同运行时初始化函数，在浏览器创建并查询小型 Parquet，结果 42 正确；首次启动 16.9 秒，再次启动 1.5 秒。临时诊断仅含合成数据，随后删除。
- 公网核心 Worker/WASM 均 HTTP 200，Cache-Control 为 public, max-age=31536000, immutable；仅 Worker 允许 JS eval。WASM 原大小约 34.2 MB，实际 gzip 传输约 7.7 MB，单次命令下载 14.08 秒。
- 部署镜像 `sha256:fd555fcb1b4ba609766805dd99f9221a1a6767057a6b6df91c36caac3c199b37`。
- 当前浏览器一次下载并校验完整 Parquet，然后在 Worker 中展开并执行全量筛选、排序和分页；并未实现 COS Range 按行组懒加载。Parquet 支持按列/行组读取，但任意条件分页、全量统计和排序通常需扫描相关行组，不能等价为每页下载 20 行。此限制需与引擎启动问题分开评估。
- 公网合成验证证明运行时链路可用，不替代已登录用户的完整结果页验收；真实文件本地夹具的 55,393 行验证保持有效。
