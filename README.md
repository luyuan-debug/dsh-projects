# DSH Projects

基于 **Claude Projects** 的项目组织方式，为 **DeepSeek Harness** 实现的第三方本地项目插件。

**适配版本：DSH 0.2.1-rc.2 · macOS arm64**

**当前版本：v0.3.0-rc.1 · 预发行版 · MIT**

[下载安装包](https://github.com/luyuan-debug/dsh-projects/releases/tag/v0.3.0-rc.1) · [安装指南](docs/INSTALL.md) · [使用指南](docs/USAGE.md) · [兼容性](docs/COMPATIBILITY.md)

> **当前版本不支持 DSH 官方 Agent Team。** 请勿在项目主对话（Coordinator）或 Thread 中启用 Agent Team，也不要选择 Agent Team 预设。同一 Profile 同时安装两个插件尚未经过兼容性测试；需要分别使用时，请使用独立 Profile。[详细说明](docs/COMPATIBILITY.md#agent-team)

## 本次更新

`v0.3.0-rc.1` 主要升级项目记忆，并改进目录选择和连接状态提示。

- **记忆有了明确结构：** 项目概要、需求、约束、决定、问题和经验以逻辑 Markdown 文件管理；当前内容、候选与历史分开，保留来源和修订记录。
- **每轮提供合适的上下文：** 在预算内组织概要、索引与相关正文。索引包含字面短说明；**Used This Turn** 分开显示“索引预览”和“已提供全文”，方便核对已组装的内容。
- **可以检索项目资料：** 本地词法检索覆盖已授权的工程文本和 Library。工程索引需要确认范围，默认不自动召回来源资料。
- **可选连接 Hindsight：** 适配 Hindsight `1.1.0`，按项目绑定独立记忆库，默认关闭；已有库默认只读，任务报告写回需要单独开启。连接检查不再沿用上一次成功状态。
- **目录等待可以取消：** 新增取消和超时处理，关闭任务或切换项目后忽略迟到结果，避免目录选择一直占住其他项目操作。

本地离线测试、固定 DSH Host 和原生 Desktop 的相关流程已验证。**真实 Hindsight Recall / Retain、真实模型效果尚未验证；原生“选择指定目录并完成后续授权”的完整成功流程仍未完成验证。** 详见 [验证范围](docs/RELEASE.md) 和 [已知限制](docs/KNOWN_LIMITATIONS.md)。

## 核心能力

**把一次对话，延续成一个可以持续推进的项目。**

项目主对话用来讨论目标、安排任务；Thread 用来执行具体工作。Memory 保存项目约定，Library 存放参考资料，方便后续对话继续使用。

| 功能 | 已实现的内容 |
| --- | --- |
| 项目与主对话 | 设置目标和项目指令，通过 Coordinator 创建或继续 Thread |
| 独立 Thread | 每个任务使用独立会话，可进入续聊、停止执行，在 Overview 查看状态 |
| Memory | 管理逻辑记忆文件、候选与历史，查看来源、版本及本轮上下文；可选 Hindsight 历史补充 |
| Library | 导入、预览、替换、下载资料，读取 PDF、PNG/JPEG、DOCX、XLSX、PPTX 的受支持内容 |
| 本地工作区 | 授权目录后使用 Direct 或 Git Worktree，沿用 DSH 的模型选择、审批和停止操作 |
| 项目管理 | 暂停、归档、恢复和删除项目 |

参考 Claude Projects 不代表功能完全相同。本插件与 Claude Projects 没有官方关联。

## 尚未实现与使用限制

- **Agent Team：** 不支持在 Project 内运行，也不支持 Coordinator 调度 Team 成员；同一 Profile 共装未验证。
- **扩展与自动化：** 真实外部 MCP 接入、自动创建 Thread 的 Routine、插件内 PR/CI 协作及多可写仓库流程尚未完成；没有云端 Worker。
- **记忆效果：** 本地检索采用词法匹配，不提供通用语义理解。记忆被提供给模型不代表模型已经理解或遵守；忘记也不会清除已有聊天和原文件。
- **文档处理：** 不提供 OCR、旧版 Office、宏执行、公式计算或完整 Office 排版还原。
- **平台范围：** 其他 DSH 构建与操作系统尚未验证，实际模型的任务完成质量和图片理解尚未验证。

完整说明见 [已知限制](docs/KNOWN_LIMITATIONS.md)。

## 开始使用

1. 下载 Release 中的 `.tgz` 和同名 `.sha256` 文件，按 [安装指南](docs/INSTALL.md) 校验。建议先在独立 Profile 试用。
2. 从 `v0.1.0-rc.1` 升级时，先停止任务并备份数据，按 [升级与回退](docs/MIGRATION.md) 明确批准数据迁移；本版本不会静默升级旧存储。
3. 打开 **Projects**，创建项目，填写目标与项目指令，选择已配置的模型。
4. 将参考资料加入 **Library**，将需要保留的约定写入 **Memory**。在主对话提出任务，需要操作本地文件时确认目录和执行权限。

默认使用本地 Standard 记忆，不连接 Hindsight。需要外部历史时，再阅读 [Hindsight 设置](docs/HINDSIGHT.md)，核对服务、数据出口与费用范围。

资料预览在本机处理；模型请求可能将资料发送给你在 DSH 中选择的服务商。删除项目会清理插件数据，并归档保留 DSH 会话历史；用户原文件、仓库和 Worktree 不会被删除。卸载插件不会自动清空项目资料。

## 文档与开发

- [使用指南](docs/USAGE.md) · [目录选择](docs/DIRECTORY_SELECTION.md) · [升级与回退](docs/MIGRATION.md)
- [架构](docs/ARCHITECTURE.md) · [构建与测试](CONTRIBUTING.md) · [发布维护](docs/RELEASE.md)
- [版本记录](CHANGELOG.md) · [报告安全问题](SECURITY.md)

本项目采用 [MIT 许可证](LICENSE)，第三方组件的许可见 [第三方声明](THIRD_PARTY_NOTICES.md)。
