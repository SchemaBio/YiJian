# BAM 七天保留规则发布记录

## 已发布

- 日期：2026-10-06。
- Octopus：`schemabio/octopus:bam-retention-20261006-f9b2add6`。
- YiJian：`schemabio/yijian:bam-retention-20261006-f9b2add6`。
- 两服务均已健康启动。
- 远端配置：`BAM_RETENTION_DAYS=7`、`BAM_CLEANUP_ENABLED=true`。
- 2026-10-06 15:28:16 UTC 确认定时清理已启用。
- 本轮未变更计算节点系统镜像或工作流；清理由 Octopus 执行。

## 范围和保留时间

任务 `73ac68fd-4f6e-437b-8244-d16b09bbc7e1`，执行 `5298563b-0d4a-4a28-93c9-e10f86d3b2fe`：

| 项目 | 核对值 |
|---|---|
| 完成时间 | 2026-09-29 15:35:22.359747 UTC |
| 保留截止 | 2026-10-06 15:35:22.359747 UTC / 北京时间 23:35:22 |
| 去重 BAM | 5,428,396,048 bytes |
| 对应 BAI | 4,067,128 bytes |
| 归档对象总数 | 31 |
| 删除清单 | 2 项，仅本次执行的 `markdup.bam` 和 `markdup.bam.bai` |
| 应保留对象 | 其他 29 项，包括结果及清单 |

默认检查命令未删除任何文件，亦未写入数据库。服务的完成快照登记已建立独立保留期记录；到期前清理尝试数为 0。

## 接口与构建核对

- Windows `go build ./...` 成功；本地模块缓存有权限警告，但编译退出码为 0。
- Linux Docker 构建 Octopus、YiJian 成功，服务健康检查通过。
- 前端本地类型检查仍有 27 项既有依赖声明问题，当前修改未新增诊断；生产 Linux 构建通过。
- 下载目录返回 200、`bam_retention_days=7` 和准确的 `bam_expires_at`。
- 到期前 IGV BAM/BAI 授权返回 200；响应有效期截至 15:35:22 UTC，两份签名实际截至 15:35:20 UTC，均未越过保留期限。检查过程中未记录签名 URL，也未申请付费下载。
- 结果上下文返回 200，QC 成员数为 1。
- 未增加或运行测试套件，未申请计算实例。

## 证据与回退

远端备份目录：`/home/ubuntu/schema/backups/bam-retention-20261006-f9b2add6`。

保留源码清单及 SHA256、旧源码、旧环境配置、构建日志、服务健康记录、启用清理前的环境配置，以及清理前 COS 对象的 key/size/ETag 清单。旧的只读删除计划在上一发布备份 `bam-retention-20261006-9a2cd344/bam-cleanup-dry-run.json`。

`BAM_CLEANUP_ENABLED=false` 可停止后续物理清理，但七天访问截止仍有效。删除后的 BAM 不会因为回滚应用而恢复。没有为到期 BAM 创建副本。

COS `GetBucketVersioning` 返回 403，无法查看桶的版本控制配置；本实现核对并删除当前可读对象，不声称已清理不可见的历史版本。详细规则见 Octopus 的 `docs/BAM_RETENTION.md`。

## 首次到期清理

本次任务自然到期后的定时清理已成功，未提前修改完成时间或强制提前删除：

| 核对项 | 结果 |
|---|---|
| 自动完成时间 | 2026-10-06 15:36:16.838622 UTC / 北京时间 23:36:16 |
| 到期后的调度延迟 | 约 54 秒，符合每分钟检查间隔 |
| 保留期任务状态 | `deleted`，清理尝试 1 次，错误码为空 |
| 对象不存在确认 | BAM 15:36:16.716048 UTC；BAI 15:36:16.827463 UTC，均经 HEAD 确认 |
| COS 清理后对象总数 | 29 |
| 清理目标缺失 | 2 / 2 |
| 其他对象身份核对 | 29 / 29 的 key、size、ETag 均与清理前一致 |
| 下载目录 | 200，`bam_status=deleted`，BAM 文件数为 0 |
| IGV | 200，BAM 轨迹不可用，明确提示已超过七天保留期 |
| 结果上下文 | 200，`state=ready`，QC 成员数为 1 |

最终对象核对保存于远端备份的 `archive-after-cleanup.json`。数据库保留两条 `object_absent_confirmed` 及一条 `deleted` 审计事件。本轮没有调用下载扣费或积分修改接口。
