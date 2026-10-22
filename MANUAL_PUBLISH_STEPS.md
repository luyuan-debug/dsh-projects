# 唯一外部阻塞：GitHub 发布通道未就绪

本机没有 gh。GitHub 连接可查询当前登录，但未返回可访问仓库，也不提供创建仓库、Release 或资产上传能力，无法确认完整写权限。没有发生 push、仓库创建或 Release 创建。

用户只需完成一件事：准备一个已认证且具创建私有仓库/推送/Release 权限的 GitHub CLI 会话，然后让 Codex 继续。本轮未获自动安装系统软件许可，未安装 gh。

最短人工操作：按 [GitHub CLI 官方安装说明](https://github.com/cli/cli#installation) 安装 gh，然后执行：

```sh
gh auth login --hostname github.com --git-protocol https --web
```

无需把 token 发给 Codex。已认证后，由 Codex重新审计候选历史/资产并执行同目录下 tools/release/publish.sh。该脚本仅创建 Private 仓库及 Draft Prerelease，不支持切换 Public。仓库已存在时先核对远端是否为空及授权，不能覆盖。

本地仓库和资产的绝对路径见外层 PUBLISH_REPORT.md；本文件保持仓库可移植，不内嵌机器用户名。
