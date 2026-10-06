# CNV Region 展示与 ClinGen 计算器

## 数据格式核对（2026-10-06）

当前 single/trio WDL 的 `cnv_bin_size` 默认 20000 bp。`CNVRegion` 调用 `merge_bins_for_cnv.py`，原始输出列为 chromosome、start、end、CNV_call、log2、depth、weight、CN；经 CNVAnno 注释后，原始第 4–8 列为 Col4–Col8。Col8 是绝对 CN，不能当 copy ratio。坐标沿用 CNR/BED 的 0-based 半开区间，长度是 end-start。

浏览器图使用完整 Region Parquet 的窗口查询，不受检出表页码或筛选影响。横轴为基因组坐标，纵轴为真实 log2；区间横线及中点标记分别表示合并区间范围和代表值。缺测处留空，0 虚线仅是坐标参考。窗口两侧扩展可配置，不修改原始 Parquet 或工作流检出 bin。单窗口最多 50,000 行，超过时要求缩小。

标准 CNVkit scatter 将原始 CNR bin 散点与 CNS/segment 叠加：https://cnvkit.readthedocs.io/en/stable/plots.html 。Region 图叠加合并区间 log2 与归档 `cnv_raw` 的 CNR 原始 bin 散点。后端沿用清单对象授权，只暴露受控轨迹 ID，签名接口固定当前 attempt 和归档版本；CNR 只用于此图，不作为 IGV 轨迹加载。浏览器按 task/归档版本缓存原始数据，窗口筛选仍在本地执行，读取上限 32 MiB。CNR 未归档、授权或 CORS 失败时明确提示，仅已有 Region 区间仍可显示，不把该状态宣称为原始 CNR 读取成功。本轮未完成浏览器实际 CNR 读取验收。

## ClinGen Loss/Gain

从 CNV 详情直接打开对应计算器，载入保存的证据；首次打开仅预选能确认的内容。真实已完成任务 Region 归档有 64,732 行，并含 Evidence_* 布尔标记和 Section* 分值。预选使用一致的 Evidence_1A/1B 与 Section1，Loss 的 Evidence_2F 与 Section2=-1 和非空良性区域说明，以及可独立归因的 Evidence_4O 与 Section4 范围内分值；条款无法明确对应时不自动勾选。未提供遗传信息选 5F（0 分）。这不证明 HI/TS 完整覆盖、RefSeq 蛋白编码基因总量或患者表型，相关计分项保持未选。基因计数未知时不以零个基因描述，用户输入后才确认计数。

Gain 基因数量阈值独立于 Loss：Gain 0–34 为 0、35–49 为 0.45、≥50 为 0.90；Loss 0–24 为 0、25–34 为 0.45、≥35 为 0.90。参考原始标准 Table 1/2：https://pmc.ncbi.nlm.nih.gov/articles/PMC7313390/ ，官方计算器：https://cnvcalc.clinicalgenome.org/cnvcalc/ 。

允许清除、调整、重置、保存；保存失败显示在计算器内并保留编辑内容。沿用行调整的租户/attempt/版本校验及历史，不修改原始数据。已有人工评估不被自动覆盖。未评估位点不显示虚构 VUS/0 分。

Franklin 入口按用户要求完全移除。

## 2026-10-06：类型筛选、ISCN 与外显子 CN 图

- CNV 类型筛选将页面的 Amplification/Deletion 转为原始 DUP/DEL；列头提供扩增、缺失、正常选项。查询仍仅在浏览器 DuckDB 执行。
- Region/Exon 新增 `ISCN_Candidate` 浏览器派生列：从工作流原始 ISCN 中保留 GRCh37/38 和染色体带区；将 BED 起点加 1；使用 `seq[GRCh…] …(start_end)xN` 的候选拷贝状态表示法。CN 估计取整后必须与 gain/loss 一致才生成；缺少参考、带区或有效 CN 时明确显示待确认。原始 ISCN 原值保留。此列同样参与本地查询、筛选及导出，原始 Parquet 和行身份不变。
- 该字符串是候选注释，不是已确认临床结论。整数 CN 来自估计取整，性染色体、嵌合等需要确认。参考 ISCN 2024 对测序 `seq` 与基于基因组坐标的格式说明：[ISCN 2024 修订](https://karger.com/cgr/article/165/1/1/924566/ISCN-2024-Summary-of-Revisions-and-New)。不把 copy gain 改写成已确定的串联重复 HGVS。
- Exon 原始报告是基因汇总：Col8=exon_count、Col9=log2_mean、Col10=log2_median、Col11=log2_std、Col12=CN、Col13=depth_mean、Col14=weight_mean、Col15=bin_count、Col16=segment_count、Col17=coverage_ratio、Col18=confidence、Col19=p_value。修正前后端别名，避免把 exon_count 当 CN、log2_median 当 copy ratio 或 log2_std 当信号权重。置信度显示原始 HIGH/MEDIUM/LOW，不生成百分比。
- Exon 详情增加 CN 图入口。使用同一 attempt 已授权原始 CNR 中的 `gene|transcript|ensembl|exon|strand|band` 注释，按基因、转录本、外显子分组；独立选择转录本，不混合转录本。完整有效 CNR weight 加权 log2；整组权重不全则按 bin 长度加权；CN=2×2^log2，不取整。图表包含读数、表格、复制入口，缺测不补造信号。CN=2 是归一化参考，性染色体需要结合分析校正解释。
- Region/Exon 共用原始 CNR 解析缓存（最多两份 task/attempt/归档版本数据）。每次打开重新检查授权；签名地址不缓存、不写入存储。仍为纯浏览器计算。
- 动态突变表移除转录本列；八类检出表回报和置顶列统一 width/minWidth/maxWidth=60px，保留列头筛选，标题禁止换行。

### 检查记录

- 只读核对真实任务 `73ac68fd` 当前归档：Region 64,732 行，Exon 18,414 行；两份报告均有原始 ISCN 列。
- CNR 19,541,699 字节；授权读取返回 206 和指定 Origin CORS，抽查 716 个 bin，其中 663 个带六段外显子注释。未在本轮读取或修改用户 reads。
- Octopus `go build ./...` 退出 0（本机模块元数据缓存写入提示 AccessDenied）。
- 前端 Webpack 打包编译成功，完整构建被既有类型错误阻断；HEAD 和当前代码均为 27 条相同的类型诊断，无新增诊断。默认 Turbopack 在本机 CSS 子进程启动阶段异常。
- `git diff --check` 通过。本轮未运行自动化测试，未部署；新图与 ISCN 派生 SQL 尚待浏览器运行验收。
