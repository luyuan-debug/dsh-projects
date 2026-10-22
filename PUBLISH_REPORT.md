# v0.1.0-rc.1 发布验证记录

本次版本采用 MIT，用户已授权检查通过后公开仓库并发布 Prerelease，明确不设 Latest。发布页和对应标签的 Actions 是外部发布/CI 状态的权威入口。本文件记录可随源码分发的构建与安装验证事实，不包含本机路径、Profile 或完整审计日志。

## 产品与来源

基于 Claude Projects 的项目组织方式，为 DeepSeek Harness 实现第三方本地项目插件。已实现项目主对话/Coordinator、独立 Thread、Overview、Memory、Library、Direct/Worktree 和项目生命周期；未完成项详见 README 与 KNOWN_LIMITATIONS。

版本从 0.0.0-final01.5 更新到 0.1.0-rc.1。包名、插件/Client id、持久化命名空间、迁移键与产品实现保持不变；依赖图不升级。新增 MIT LICENSE 和许可元数据，保留原第三方版权/许可，重建包收录最新用户文档。

## 本地验证

- Node 26.8.1 / npm 11.19.0：npm ci、Client build 通过；Client 与基线逐字节一致。
- Mac 完整离线测试 196 PASS / 0 FAIL。
- 包含 MIT 的 777 个成员与源码/依赖、实际安装目录逐字节一致。
- 全新隔离 Profile：安装、项目/Thread、直接和协调器续聊、冷恢复、停用/重新启用、卸载以及普通会话通过。
- 独立升级 Profile：先安装旧候选创建合成数据，再升级新包；项目/Thread 身份、运行计数、Memory 和 Library 字节保持，没有任务重放；停用/恢复/卸载通过。
- Host 进程均正常结束，无已观察的 owned 进程残留；收费模型调用 0。
- peer 检查仍 exit=1，固定 Host 实际运行通过；不将警告或范围外兼容改写为通过。

包 SHA-256：`5afcc0b99d88846f94d6e6966903fbeafd74a5d87fa135be58ac2230317e60fc`。

## 验证边界

真实 Host 配合脚本模型只验证控制与数据链路，不证明真实模型语义或图像理解。本轮没有重跑 Desktop GUI。macOS arm64 / DSH 0.2.1-rc.2 / 332895e0f7c9d4dbfb29729f5eb367fa263ff986 是固定已验证范围；Linux CI 只是可移植离线测试。

旧标签、失败与修复记录均保留。完整原始开发历史与审计材料保持本地，不追加到公共仓库。公开前扫描范围包含全部拟公开 Git 历史、安装包和 Actions 日志；具体扫描范围见 SECURITY_SCAN_REPORT.md。
