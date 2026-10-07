# 类型检查与变异外链更新（2026-10-07）

## 类型错误核对

原 27 个错误集中在 Radix、Testing Library、PageAgent、Arrow 及其使用处。TypeScript 解析记录显示无法定位间接依赖；根目录包通过 pnpm Windows junction 指向 `.pnpm`，沙箱的 realpath 访问限制导致解析结果错误。

按现有锁文件离线重建依赖后，在正常文件权限下执行 `tsc --noEmit --incremental false` 返回 0，完整检查无错误。没有扩大 any 类型、排除测试文件或关闭严格检查。包版本与锁文件未改变。Windows 沙箱内继续执行时可能产生同类误报，应在允许读取联接目标的终端执行检查。

Dockerfile 在生产构建前新增 `pnpm typecheck` 门禁。数据库链接由浏览器根据当前变异的原始注释构建，用户点击后才访问外站，不抓取外部数据库内容。

## 外链

新增 Franklin、UCSC、NCBI Gene、HGNC、OMIM、HPO Gene、UniProt、UniParc、PubMed、COSMIC、MITOMAP 和 Google；保留 VarSome、ClinVar、dbSNP。多值标识分别生成链接；没有来源标识时显示未提供。HPO 使用 NCBI Gene ID，不使用 HGNC 编号或基因符号代替。

Franklin hg19 使用 `chr-position-ref-alt`，hg38 使用 `chr-position-ref-alt-HG38`，参考未知时禁用；UCSC 和 VarSome 使用该次任务的明确参考版本。外链不包含任务、样本、签名地址或令牌。
