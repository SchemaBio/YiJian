# 远端发布记录：2026-10-06 结果页与原始下载

## 发布版本

- Octopus：`schemabio/octopus:results-downloads-20261006-4e131634`
- YiJian：`schemabio/yijian:results-downloads-20261006-4e131634`
- 两容器健康状态：healthy。
- 21 个源码文件已同步并逐一核验 SHA256。本次未提交或推送 Git。

包含 CNV 类型筛选、Exon CN 字段与信号图、ISCN 候选列、STR 列调整、回报/置顶固定列宽，以及原始 ZIP 线粒体 VCF 识别、下载布局、费用说明和新建任务 BAM 保留提示。

## 只读发布检查

- 结果上下文：HTTP 200、ready，QC 1 名成员。
- 任务页面：HTTP 200。
- IGV/CNR 清单：HTTP 200，CNR 可用。
- CNR 对象：Range 返回 206，Origin CORS 正确。
- 下载目录：HTTP 200，BAM 1 个；新 ZIP 缓存 pending，准备过程不扣费。
- 旧任务没有归档线粒体 VCF，下载目录明确记录不可恢复；未伪造文件。
- 未创建付费下载申请、未扣积分、未修改计算节点镜像配置。
- Linux 容器中的两仓生产构建均成功，本机既有类型错误未在远端构建复现。

## 工作流及保留规则

远端没有独立的 schema-germline 仓库。修正后的 single/trio 源码同步在：

`/home/ubuntu/schema/workflow-source/schema-germline/`

这只是后续系统镜像构建的源码；当前计算节点镜像 ID 未修改。用户后续更新系统镜像内实际运行的 WDL，新任务才能将 `MitochondrialMutect2.vcf` (`<prefix>.mt.vcf.gz`) 和 TBI 归档并纳入 ZIP；无需更改 Agent 协议。

BAM 7 天自动删除尚未核实：COS GetBucketLifecycle 返回 403。页面已加入策略提示，实际自动清理仍需确认或配置；本次没有删除任何 BAM 或其他任务数据。

## 镜像清理与回滚

- 已删除 39 个未被任何容器引用的旧 Octopus/YiJian 镜像标签；当前只剩本轮两个应用标签。
- 未操作其他项目镜像、容器、卷或数据。
- 全局悬空镜像 prune 被自动审批拒绝，因为可能波及其他项目；最终执行了仅限两个应用仓库的清理。
- 旧层仍可能被 BuildKit 缓存引用；不宣称这些标签清理释放了对应全部镜像大小。
- 上一版本镜像已保存为 150.4 MB 压缩回滚归档，SHA256 已记录。

备份目录：`/home/ubuntu/schema/backups/results-downloads-20261006-4e131634`

包含源码、权限受限的原 `.env`、原 Compose、镜像版本、构建/发布日志、旧镜像 tar.gz 与清理清单。恢复镜像可使用 `gzip -dc rollback-images.tar.gz | docker image load`，再恢复原镜像配置并重建应用容器；不在用户界面暴露备份中的环境凭据。
