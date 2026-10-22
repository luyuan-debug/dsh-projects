# 架构

DSH Projects 管理项目、Thread、Memory 和 Library，DSH 负责会话运行、模型调用、审批与停止。

项目主对话（Coordinator）负责组织任务。每个 Thread 使用独立的 DSH 会话，可由主对话创建，也可以直接进入继续工作。Thread 不是 Agent Team 成员；当前不支持嵌套 Team，见 [兼容性](COMPATIBILITY.md#agent-team)。

## 源码结构

| 目录 | 职责 |
| --- | --- |
| `src/product/domain/` | 项目与 Thread、任务分配、工作区授权、工具策略、记忆和生命周期 |
| `src/product/host/` | 对接 DSH 会话、工具、审批、模型及事件，处理恢复与项目 API |
| `src/product/backends/local/` | 本地存储、工作区、Git 限制、资料文件和数据迁移 |
| `src/product/readers/` | PDFKit / ImageIO 与 Python OOXML 读取程序 |
| `src/product/client/` | Projects 界面 |
| `src/product/protocol/` | 设置、请求、状态及工具结果协议 |
| `lib/client.js` | 构建后的客户端模块 |

`cordis.patch.yml` 加载 `src/product/host/thread-links-plugin.mjs`。客户端由 `src/product/client/thread-links.mjs` 构建，使用 DSH 提供的 React 和界面模块。

## 权限与数据

项目工具权限受角色、目录授权、Git 保护规则和 DSH 原生审批共同约束。文档、模型输出和 Memory 内容不能授予目录权限。撤销工具后，尚未执行的调用会重新检查；已经开始的操作不会自动回滚。

插件数据由当前 Profile 的本地存储管理。项目删除清理插件自身数据，同时归档保留 DSH 会话；不会删除用户原文件或仓库。数据备份和恢复见 [升级与回退](MIGRATION.md)。
