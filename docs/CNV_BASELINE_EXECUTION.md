# CNV 基线校正执行链

2026-10-11 本地修订；尚未部署、尚未运行真实计算实例验收。

## 执行顺序

1. Octopus 校验用户、BED、成对 FASTQ 及对象大小，生成 `CNVBaselineFix` 输入。申请实例前检查必要参考对象存在且非空。
2. Squid 申请计算实例；初始化 supervisor 先首报并保持心跳，挂载数据盘。
3. `baseline_fix` 只逐文件下载参考资源，禁止调用全量 `database` 同步及 VEP 解压。自定义 BED 从任务对象下载；只有使用默认 BED 才下载默认 BED。
4. 下载 FASTQ/BED，验证 FASTQ 配对、压缩文件完整性和 BED 坐标。刷新 FAI 时间，避免 CNVKit 在只读参考目录内重建索引。
5. 启动 miniwdl 后启动 sepiida-agent；Agent 扫描已产生的日志，监控进度。等待 miniwdl 结束后，Agent 继续运行以完成上传及归档回调。
6. Agent 上传最终基线和流程输出到本机构、任务、执行 attempt 的对象储存目录。
7. Octopus 校验已归档 `outputs.resolved.json` 的 `CNVBaselineFix.reference`：必须属于当前机构/任务/attempt，并且最终对象存在且非空。登记基线时锁定任务，拒绝过期 attempt。
8. 基线登记及归档暂存成功后发送归档完成事件；Squid 释放实例。归档未确认时不能以流程退出成功代替归档完成。

## 最小参考资源

参考桶沿用独立的参考资源配置；未配置时为 `schemabio-1327430028`。

| 对象目录 | 文件 |
|---|---|
| `database/hg19/` | `Homo_sapiens.GRCh37.dna.primary_assembly.fa` |
| `database/hg38/` | `Homo_sapiens.GRCh38.dna.primary_assembly.fa` |
| 相应基因组目录 | FASTA 的 `.fai`、标准 BWA `.amb`、`.ann`、`.bwt`、`.pac`、`.sa` 索引 |
| `database/<genome>/schema_bundle/` | `<genome>_reference.cnvkit.cnn` |
| 相应基因组目录（仅默认 BED） | `<genome>_default.bed` |

本轮采用所有实例都可用的标准 BWA 索引。WDL 支持的 minibwa 加速索引不属于必需文件。CNVKit 的排除区域 BED 随其工具 Docker 镜像提供，不需要另外同步数据库。

## 结果与验收边界

- 仅 `CNVBaselineFix.reference` 是最终基线；`new_batch_reference`、target/antitarget coverage 均是中间文件，不能任意选一个 `.cnn`。
- CVM 基线登记保存对象储存的归档 URL，不保存将随实例删除的本地路径。
- 基线导入不要求 WES 的 `qc_result`，不产生变异报告；CNV 基线页与任务中心的详情入口禁用，直接解读地址返回 HTTP 404。
- 计算镜像仍须包含匹配的 `baseline_fix.wdl`、工具镜像、miniwdl、COSCLI、Agent 和 COSCLI 参考桶配置。本轮无需新增镜像初始化脚本接口。
- 本地测试覆盖 hg19/hg38、默认/自定义 BED、启动顺序、UserData 限制、最终文件选择、归档对象缺失/为空、跨 attempt 拒绝和登记事务。真实云端下载、WDL 运行、上传和释放仍须部署后验收；未自动申请节点或重跑已有任务。
