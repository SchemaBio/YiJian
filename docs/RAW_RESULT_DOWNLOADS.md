# 原始结果下载：线粒体 VCF 与费用说明

## 2026-10-06 修正

线粒体文件来自 `tasks/gatk.wdl` 的 `MitochondrialMutect2`：

- `<prefix>.mt.vcf.gz`：原始 Mutect2 结果，也是 `MtVEP` 实际使用的输入。本轮 ZIP 收录此文件。
- `<prefix>.mt.vcf.gz.tbi`：配套索引，一并归档及打包。
- `<prefix>.mt.filtered.vcf.gz`、`<prefix>.mt.pass.vcf.gz`：过滤结果，不与原始 VCF 混用。
- Trio 当前只对先证者调用线粒体分析，不宣称包含父母的线粒体 VCF。

single/trio 的 PipelineSummary 与 `write_json` 原来未引用 MT VCF，Sepiida 递归归档最终输出时无法收录。工作流仓库已新增 `mt_vcf`、`mt_vcf_tbi`，指向任务原始 VCF/TBI。Agent 现有递归归档协议即可处理，不需要更改 Agent。

Octopus ZIP 优先读取这两个声明；兼容旧摘要时，仅允许根据该摘要唯一 prefix 找到当前 attempt 下精确命名的 `<prefix>.mt.vcf.gz` 与对应 TBI，不选择其他 VCF、不跨 attempt。新 ZIP 缓存使用 v3，并将缺失清单纳入指纹，避免继续提供旧版缺失说明。打包过程不扣费。

只读核对已完成任务 `73ac68fd`：COS 当前 attempt 31 个归档对象中没有 MT VCF。因此历史任务不能凭结果表补造原始 VCF。界面及 ZIP download-manifest 明确记录未归档，而不是将其误称为流程未产生。

## 页面与扣费

- ZIP、BAM 采用独立卡片；ZIP 每次新申请 1 积分。
- BAM 按 HEAD 确认的实际大小：ceil(bytes / 1,000,000,000)，每 GB 1 积分。显示 GB、精确字节及本次费用。
- 准备 ZIP、查看大小、取消费用确认不扣费；确认后签发并扣费。
- BAM 确认后展示链接，不自动触发大文件下载；用户选择开始下载或复制链接。
- 每个链接绑定申请公网 IP，3 小时有效。复制、续传和恢复同一申请不重复扣费；新申请单独计费。取回旧申请保留原到期时间。
- 页面与新建任务页新增 SaaS BAM 7 天保留策略提示，并提示到期无法使用 IGV 复核 reads。

## 发布与待完成项

1. 更新 Octopus 和 YiJian；本轮尚未部署。
2. 计算节点实际执行的 single/trio 必须同步工作流修正。仅更新下载页面不会使旧工作流自动归档 MT VCF；镜像内 WDL 若未通过其他机制刷新，需要更新工作流镜像。
3. BAM 自动删除规则尚未核实：源码未找到 BAM 专用 7 天清理任务，COS GetBucketLifecycle 返回 403 AccessDenied。`DATA_RETENTION_DAYS` 针对上传资产，不能当作结果 BAM 自动清理的证据。正式启用保留策略前，需要核实或配置专门的 BAM/BAI 清理；不能按整个 attempt 设置生命周期，以免删除 Parquet 和判读所需结果。
4. Octopus 编译退出 0；前端当前仍为 27 个既有类型诊断，本轮没有新增。本地没有 MiniWDL，未完成 WDL 编译或新归档 ZIP 运行验收。未运行自动化测试、未申请计算节点、未扣积分、未改 COS 生命周期、未删除文件。
