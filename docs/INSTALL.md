# 安装 DSH Projects

适用于 **DSH Projects v0.3.0-rc.1**。已验证环境为 **macOS arm64 / DSH 0.2.1-rc.2**，对应 Host build `332895e0f7c9d4dbfb29729f5eb367fa263ff986`。其他构建和操作系统尚未验证。

建议先在独立 Profile 试用。已有 `v0.1.0-rc.1` 数据时，请先阅读 [升级与回退](MIGRATION.md)：本版本变更了存储格式，不能直接用旧安装包读取升级后的数据。

> **当前版本不支持 DSH 官方 Agent Team。** 不要在 Project 主对话或 Thread 中选择 Team 预设。同一 Profile 共装未验证；需要分别使用时，请使用独立 Profile。[兼容性说明](COMPATIBILITY.md#agent-team)

## 1. 下载并校验

打开 [v0.3.0-rc.1 发布页](https://github.com/luyuan-debug/dsh-projects/releases/tag/v0.3.0-rc.1)，从 **Assets** 下载：

- `dsh-project-threads-wave1-spike-0.3.0-rc.1.tgz`
- `dsh-project-threads-wave1-spike-0.3.0-rc.1.tgz.sha256`

两份文件放在同一目录，在该目录运行：

```sh
shasum -a 256 -c dsh-project-threads-wave1-spike-0.3.0-rc.1.tgz.sha256
```

确认输出 `OK` 后再安装。该版本为预发行版，具体适用范围见 [已知限制](KNOWN_LIMITATIONS.md)。

## 2. 在 DSH 中安装

先确认当前 Profile。打开 **插件 → 安装第三方插件**，输入 `.tgz` 的完整 `file:` 路径；安装后选择 **立即启用**，等待组件显示 **运行中**，再打开 **Projects**。

安装包名为 `dsh-project-threads-wave1-spike`，界面入口为 **Projects**。包名用于延续既有安装和存储身份，不要自行修改。

<details>
<summary>使用 CLI 安装</summary>

在你明确选择的 Profile 中执行，将 Profile 和路径替换为实际值：

```sh
dsh plugin --profile <profile> add file:/absolute/path/dsh-project-threads-wave1-spike-0.3.0-rc.1.tgz --ignore-scripts
```

已有旧版项目数据时，先完成备份并按 [迁移说明](MIGRATION.md) 处理，不要通过反复安装绕过迁移检查。

</details>

## 3. 创建第一个项目

创建项目并填写目标、项目指令。未配置模型时也可以先创建项目；开始模型任务前，请在 DSH 中配置并选择已授权的提供方和模型。

把资料加入 **Library**，将长期约定保存到 **Memory**。默认使用本地 Standard 记忆，不需要 Hindsight。需要补充外部历史时，再按 [Hindsight 设置](HINDSIGHT.md) 核对服务、数据出口与费用。

在主对话提出任务；需要本地执行时，确认工作目录和 Direct / Worktree 模式，再单独授予任务执行权限。目录选择等待支持取消和超时，但原生指定目录完整成功流程仍未完成验证，详见 [目录选择](DIRECTORY_SELECTION.md)。更多操作见 [使用指南](USAGE.md)。

## 升级、停用和卸载

升级前暂停项目、停止任务、正常退出 DSH，并按 [升级与回退](MIGRATION.md) 备份对应 Profile 的插件数据。

停用或卸载可使用 DSH 插件页。卸载不会自动清空项目资料；需要清理插件拥有的数据时，请先在 Projects 内删除项目。宿主会话历史归档保留，用户原目录不删除。断开 Hindsight 或删除项目默认保留远端记忆库。

宿主 peer 包由 DSH 提供。安装时可能出现 unmet peer 警告，其含义和已验证边界见 [兼容性说明](COMPATIBILITY.md)。
