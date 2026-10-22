# DSH Projects

**把项目目标、共享资料和独立任务，放在同一个工作区。**

DSH Projects 是面向 **DeepSeek Harness** 的第三方插件。你可以围绕一个项目持续讨论、积累资料与记忆，并把需要独立执行的工作交给不同 Thread；每个任务都有自己的会话，也能随时进入、继续或停止。

**本地优先 · 原生会话 · 独立任务 · 共享上下文**

[获取候选版](https://github.com/luyuan-debug/dsh-projects/releases) · [安装指南](docs/INSTALL.md) · [使用指南](docs/USAGE.md) · [已知限制](docs/KNOWN_LIMITATIONS.md)

> **当前阶段：首个候选版**
>
> 本地核心流程已在固定 DSH 构建上验证。当前保留为私有预发行草稿，许可证尚未确定；真实模型语义与用户接受验收尚未完成。

## 一个项目，持续推进

项目主对话用于组织工作，独立 Thread 承接具体任务，Memory 与 Library 保存可追溯的共享信息。适合围绕同一目标整理资料、开展并行任务，并在多次会话之间延续上下文。

| 能力 | 你可以做什么 |
| --- | --- |
| **项目主对话** | 保存目标与项目指令，通过 Coordinator 派工或继续已有 Thread |
| **独立 Threads** | 为任务保留独立会话，进入任务直接续聊、停止执行或恢复工作 |
| **Overview** | 集中查看项目与 Thread 的状态 |
| **Memory** | 保存、编辑和忘记项目记忆，保留来源与版本信息 |
| **Library** | 导入、预览、替换和下载资料，按需读取支持的文档内容 |
| **本地执行** | 在明确授权的目录中使用 Direct 或 Git Worktree 模式开展工作 |

Conversation、模型选择、审批和 Stop 沿用 DSH 的原生能力。资料副本与文件预览在本机处理；模型调用的数据传输取决于你在 DSH 中选择的提供方。

## 从第一个项目开始

1. **安装插件。** 在 [Releases](https://github.com/luyuan-debug/dsh-projects/releases) 的 Assets 中下载 `.tgz` 和对应 `.sha256`，核对后从 DSH 插件页安装并启用。
2. **建立项目。** 填写目标、项目指令，并选择你已经配置和授权的模型。
3. **加入上下文。** 把资料加入 Library，将需要长期沿用的约定保存到 Memory。
4. **开始工作。** 在项目主对话提出任务；需要本地执行时，确认工作目录与 Direct / Worktree 模式，再进入各个 Thread 跟进。

例如，可以从这句话开始：

> 请先梳理这些资料，列出需要独立处理的任务。执行前让我确认工作目录。

完整操作、目录授权和停止方式见 [使用指南](docs/USAGE.md)。

## 当前支持范围

| 项目 | 当前候选版 |
| --- | --- |
| 运行环境 | macOS arm64，DSH `0.2.1-rc.2` |
| 本地任务 | Direct / Git Worktree |
| 文档读取 | PDF、PNG/JPEG、DOCX、XLSX、PPTX，以及支持的文本资料 |
| 项目管理 | 暂停、归档、恢复，以及确认后的删除 |
| 分发方式 | GitHub Release 安装包；当前为 Draft Prerelease |

已验证宿主构建为 `332895e0f7c9d4dbfb29729f5eb367fa263ff986`。其他 DSH 构建和操作系统尚未获得产品兼容性验收；Linux CI 覆盖的是可移植离线测试。

## 试用前了解这些边界

- **真实模型验收仍在等待完成。** 当前控制与数据链路验证不等于模型理解、路由质量或图像语义已经通过；不宣称完整复刻 Claude Projects。
- **部分高级流程尚未完成。** 包括真实外部 MCP、自动创建 Thread 的 Routine、插件内 PR/CI 协作和多可写仓库高级流程。执行发生在本机，当前没有云 Worker。
- **文档读取有明确范围。** 不提供 OCR、旧版 Office 支持、宏执行、公式计算或通用 Office 保真排版；格式和大小限制见 [已知限制](docs/KNOWN_LIMITATIONS.md)。
- **删除与卸载各有边界。** 项目删除会清理插件拥有的数据，同时归档保留 DSH Session 历史；用户原文件、仓库和 Worktree 不删除。卸载插件不会自动清空项目资料。
- **临时附件需要妥善保存。** 未发送的 File/图片不承诺跨退出或卸载持久化。安装时出现的 peer 警告及解析边界见 [兼容性说明](docs/COMPATIBILITY.md)。

## 文档与开发

[安装](docs/INSTALL.md) · [使用](docs/USAGE.md) · [架构](docs/ARCHITECTURE.md) · [迁移与回退](docs/MIGRATION.md) · [安全报告方式](SECURITY.md) · [参与维护](CONTRIBUTING.md)

<details>
<summary><strong>构建、测试与安装身份</strong></summary>

使用 Node `26.8.1` / npm `11.19.0`：

```sh
npm ci
npm run build
npm run test:portable
# 在 macOS arm64 上额外验证实际 PDF / ImageIO reader
npm run test:mac
```

开发安装由 `.npmrc` 固定 `legacy-peer-deps=true`；宿主 peer 包由 DSH 提供，lockfile 保持锁定。Linux 的 13 项 Mac 专用测试显式跳过，macOS 作业继续执行它们；CI 不替代真实 Host、Desktop 或模型验收。详见 [发布维护与测试范围](docs/RELEASE.md)。

当前安装版本为 `0.0.0-final01.5`。包名 `dsh-project-threads-wave1-spike` 沿用历史兼容标识，在 DSH 界面中的入口仍是 **Projects**。发布标签与安装包的对应关系以 Release 页面为准。

</details>

## 许可

本项目许可证尚待维护者确认，当前候选保持私有。第三方组件保留各自许可，详见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [许可证决策](LICENSE_DECISION.md)。
