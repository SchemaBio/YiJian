# 隐私页部署记录

- 部署日期：2026-10-12（北京时间）。
- 页面版本：2026-10-12，中英文共享同一政策版本。
- 业务代码提交：`a582703`；公开访问修复提交：`bfb869c`。
- 当前镜像：`schemabio/yijian:privacy-bfb869c`。
- 服务器代码目录：`/home/ubuntu/schema/YiJian`。
- 通过 Git bundle 将已提交代码部署到服务器；未替用户 push GitHub。

## 验证

- 本地类型检查通过；隐私页三项测试及公开访问两项回归测试通过。
- 服务器 Docker 构建执行类型检查和生产构建并通过。
- YiJian 容器健康，更新后重载 gateway 的 nginx。
- `/privacy`、`/privacy?lang=en`、`/login` HTTP 200。
- 浏览器以未登录状态直接打开英文深链接成功，点击中文成功切换语言和 URL。
- 线上检查发现原 AuthProvider 会在会话失效时将隐私页跳转至登录页，已将 `/privacy` 纳入公开页面，保留其他业务页面的认证机制。
- Octopus、Squid 和 gateway 健康；本次未更新这些服务的代码或镜像。

## 回滚资料

服务器 `/home/ubuntu/schema/backups/privacy-20261012T061152Z` 保存部署前环境配置、旧镜像标签、两次构建日志及验收记录。环境备份权限为 600，目录权限为 700，不纳入 Git。部署前镜像 `schemabio/yijian:notice-style-1c543952` 保留用于回滚。

本次没有变更数据库、COS 对象或部署云区域。海外云部署安排写入隐私政策不代表已创建海外服务实例。政策之外的供应商协议、法定联系人和代表等仍由实际运营落实。
