# 安装 DSH Projects

已验证环境为 **macOS arm64 / DSH 0.2.1-rc.2**，对应 Host build `332895e0f7c9d4dbfb29729f5eb367fa263ff986`。其他构建和操作系统尚未验证。

> **当前版本不支持 DSH 官方 Agent Team。** 不要在 Project 主对话或 Thread 中选择 Team 预设。同一 Profile 共装未验证；需要分别使用时，请使用独立 Profile。[兼容性说明](COMPATIBILITY.md#agent-team)

## 1. 下载并校验

在 [Releases](https://github.com/luyuan-debug/dsh-projects/releases) 中打开当前候选，从 **Assets** 下载：

- `dsh-project-threads-wave1-spike-0.1.0-rc.1.tgz`
- `dsh-project-threads-wave1-spike-0.1.0-rc.1.tgz.sha256`

两份文件放在同一目录，在该目录运行：

```sh
shasum -a 256 -c dsh-project-threads-wave1-spike-0.1.0-rc.1.tgz.sha256
```

确认输出 `OK` 后再安装。当前版本为 MIT 开源预发行候选，请阅读发布页的已知限制。

## 2. 在 DSH 中安装

打开 **插件 → 安装第三方插件**，输入 `.tgz` 的完整 `file:` 路径；安装后选择 **立即启用**，等待组件显示 **运行中**，再打开 **Projects**。

安装包名为 `dsh-project-threads-wave1-spike`，界面入口为 Projects。

## 3. 创建第一个项目

创建项目并填写目标、项目指令。未配置模型时也可以先创建项目；开始模型任务前，请在 DSH 中配置并选择已授权的提供方和模型。

把资料加入 Library，将长期约定保存到 Memory。在项目主对话提出任务，需要本地执行时确认工作目录和 Direct / Worktree 模式。更多操作见 [使用指南](USAGE.md)。

<details>
<summary>使用 CLI 安装</summary>

在你明确选择的 Profile 中执行，将路径替换为下载文件的实际位置：

```sh
dsh plugin --profile <profile> add file:/absolute/path/candidate.tgz --ignore-scripts
```

</details>

## 升级、停用和卸载

升级前暂停项目、停止任务、正常退出 DSH，并按 [迁移与回退](MIGRATION.md) 备份数据。

停用或卸载可使用 DSH 插件页。卸载不会自动清空项目资料；需要清理插件拥有的数据时，请先在 Projects 内删除项目。宿主会话历史归档保留，用户原目录不删除。

宿主 peer 包由 DSH 提供。安装时可能出现 unmet peer 警告，其实际含义和已验证解析边界见 [兼容性说明](COMPATIBILITY.md)。
