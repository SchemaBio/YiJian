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
