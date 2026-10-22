# DSH Projects v0.1.0-rc.1 · MIT 开源预发行版

基于 **Claude Projects** 的项目组织方式，为 **DeepSeek Harness** 实现的第三方本地项目插件。

**当前适配：DSH 0.2.1-rc.2 · macOS arm64**

提供本地项目工作区：围绕目标组织对话，让独立 Thread 承接任务，再用 Memory 与 Library 留住项目需要的上下文。

这个候选版聚焦于日常项目工作的基础流程——**建立项目、加入资料、派发任务、跟进执行，以及在之后继续工作。**

## 参考与实现范围

参考 Claude Projects，不代表完整复刻；下面是本插件目前做到的范围。

| 状态 | 功能 |
| --- | --- |
| **已实现** | 项目目标与指令、项目主对话 / Coordinator、Overview、独立 Thread 的派工与续聊 |
| **已实现** | 共享 Memory、Library 导入/预览/替换/下载，PDF、图片与现代 Office 的有界读取 |
| **已实现** | 本地 Direct / Worktree、目录授权、原生会话/审批/Stop、项目暂停/归档/恢复与删除 |
| **尚未完成** | 真实外部 MCP、自动创建 Thread 的 Routine、插件内 PR/CI 协作、多可写仓库高级流程 |
| **当前不支持** | 云 Worker、OCR、旧 Office、宏执行、公式计算、通用 Office 保真排版 |

真实模型语义、图像理解和用户接受验收尚未完成。这是独立的第三方实现，提及 Claude Projects 表示产品参考，不代表官方关联或背书。

## 核心能力

**把一次对话，延续成一个可以持续推进的项目。**

- **项目主对话与独立任务。** 在主对话中组织工作，创建或继续已有 Thread；每个 Thread 保留独立会话，可进入后直接续聊、停止和恢复。
- **可维护的项目记忆。** 保存、编辑与忘记 Memory 条目，保留来源和版本，供项目按需引用。
- **随项目组织的资料库。** 在 Library 导入、预览、替换和下载资料，按需读取 PDF、PNG/JPEG 与现代 Office 文档的受支持内容。
- **有明确授权边界的本地执行。** 使用 Direct 或 Git Worktree，在确认过的工作目录中开展任务；Conversation、模型、审批和 Stop 复用 DSH 原生能力。
- **项目生命周期。** 支持暂停、归档和恢复。确认删除项目后，清理插件数据并归档保留宿主会话历史；用户原文件与仓库保留。

## 安装与开始使用

**已验证环境：macOS arm64 · DSH 0.2.1-rc.2**

1. 从本页 **Assets** 下载 `.tgz` 安装包和同名 `.sha256` 校验文件，放到同一目录并核对校验和。
2. 打开 DSH 的插件页，选择安装第三方插件，输入 `.tgz` 的完整 `file:` 路径，启用后等待组件显示“运行中”。
3. 打开 **Projects**，创建项目，设置目标和模型；加入资料后，从主对话开始工作。

[详细安装步骤](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/INSTALL.md) · [使用指南](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/USAGE.md) · [迁移与回退](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/MIGRATION.md)

## 这是一个候选版本

本地核心流程已经完成固定环境验证，**真实模型语义、图像理解和用户接受验收尚未完成**。当前不宣称完整 Claude Projects parity，也不承诺其他 DSH 构建或操作系统的产品兼容性。

真实外部 MCP、自动创建 Thread 的 Routine、插件内 PR/CI 协作和多可写仓库高级流程尚未完成；当前没有云 Worker。文档读取不提供 OCR、宏执行、公式计算或通用 Office 保真排版。未发送的临时附件不承诺跨退出持久化。

安装时的 peer 警告仍保留，固定 Host 的实际运行验证不能替代 peer 检查通过。请结合 [兼容性说明](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/COMPATIBILITY.md) 与 [已知限制](https://github.com/luyuan-debug/dsh-projects/blob/main/docs/KNOWN_LIMITATIONS.md) 评估试用范围。

<details>
<summary><strong>验证记录与下载校验</strong></summary>

| 验证范围 | 结果 |
| --- | --- |
| 本候选 Mac 完整离线测试 | 196 通过 |
| 当前候选 macOS CI | 178 通过，0 跳过 |
| 当前候选 Ubuntu CI | 165 通过，13 项 Mac 专用测试跳过 |
| 隔离 Host 核心流程 | 安装、启停、项目与 Thread、续聊、冷恢复、卸载通过 |
| 旧候选升级 | 从 0.0.0-final01.5 升级后，项目 / Thread / Memory / Library 保持 |
| 安装包一致性 | 全部成员与候选源码及实际安装目录逐字节核对 |

[CI 记录](https://github.com/luyuan-debug/dsh-projects/actions)。Host 测试使用脚本模型，未调用收费模型；本次开源发布验证不包括 Desktop GUI 或真实模型语义验收。

- 安装版本：`0.1.0-rc.1`
- 候选标签：`v0.1.0-rc.1`
- 已验证 Host build：`332895e0f7c9d4dbfb29729f5eb367fa263ff986`
- 内部包名：`dsh-project-threads-wave1-spike`（保留安装与数据兼容标识）

将安装包与校验文件放在同一目录后运行：

```sh
shasum -a 256 -c dsh-project-threads-wave1-spike-0.1.0-rc.1.tgz.sha256
```

安装包 SHA-256 以本页同名 `.sha256` 资产为准。

</details>

---

**MIT 开源预发行版。** 第三方组件的版权与许可声明随包保留。本版本继续标记为 Prerelease，不设为 Latest。
