# DSH Projects v0.1.0-rc.1

基于 **Claude Projects** 的项目组织方式，为 **DeepSeek Harness** 实现的第三方本地项目插件。

**适配版本：DSH 0.2.1-rc.2 · macOS arm64**

**MIT 开源 · 预发行版**

> **当前版本不支持 DSH 官方 Agent Team。** 请勿在 Project 主对话（Coordinator）或 Thread 中运行 Agent Team、选择 Team 预设，或让 Coordinator 调度 Team 成员。同一 Profile 共装未经过兼容性测试；需要分别使用时，请使用独立 Profile。[兼容性说明](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/COMPATIBILITY.md#agent-team)

## 核心能力

**把一次对话，延续成一个可以持续推进的项目。**

- **项目与任务：** 保存项目目标和指令，在主对话中安排工作，通过独立 Thread 执行并继续讨论，在 Overview 查看状态。
- **Memory：** 保存、编辑和删除项目记忆，保留来源与版本。
- **Library：** 导入、预览、替换和下载资料，读取 PDF、PNG/JPEG、DOCX、XLSX、PPTX 的受支持内容。
- **本地工作区：** 授权目录后使用 Direct 或 Git Worktree，沿用 DSH 的模型选择、审批和停止操作。
- **项目管理：** 暂停、归档、恢复和删除。删除项目会清理插件数据，归档保留 DSH 会话历史；用户原文件、仓库和 Worktree 保留。

## 尚未实现

真实外部 MCP 接入、自动创建 Thread 的 Routine、插件内 PR/CI 协作、多可写仓库流程和云端 Worker 尚未提供。文档读取不支持 OCR、旧版 Office、宏执行、公式计算或完整排版还原。

本插件参考 Claude Projects，但尚未实现其全部功能，也没有官方关联。本地核心流程已通过固定环境测试；实际模型的任务完成质量和图片理解尚未验证。详见 [已知限制](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/KNOWN_LIMITATIONS.md)。

## 安装

1. 从下方 **Assets** 下载 `.tgz` 安装包和同名 `.sha256` 文件，放入同一目录。
2. 在该目录运行校验命令，确认输出 `OK`：

   ```sh
   shasum -a 256 -c dsh-project-threads-wave1-spike-0.1.0-rc.1.tgz.sha256
   ```

3. 在 DSH 的 **插件 → 安装第三方插件** 中输入安装包的完整 `file:` 路径，安装并启用。
4. 打开 **Projects**，创建项目、选择模型，加入资料后开始工作。

[安装指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/INSTALL.md) · [使用指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/USAGE.md) · [升级与回退](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/MIGRATION.md)

## 版本说明

已验证 DSH 构建为 `332895e0f7c9d4dbfb29729f5eb367fa263ff986`。其他 DSH 构建和操作系统尚未验证。安装时仍可能出现 peer 依赖警告，请先阅读兼容性说明。

安装包名保留为 `dsh-project-threads-wave1-spike`，界面名称为 **Projects**。本版本保留 Prerelease 标记，不设为 Latest。

[构建与测试记录](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/RELEASE.md) · [MIT 许可证](https://github.com/luyuan-debug/dsh-projects/blob/main/LICENSE) · [第三方声明](https://github.com/luyuan-debug/dsh-projects/blob/main/THIRD_PARTY_NOTICES.md)
