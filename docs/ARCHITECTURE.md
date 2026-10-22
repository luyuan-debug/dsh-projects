# 架构

`cordis.patch.yml` 挂载 `src/product/host/thread-links-plugin.mjs`；`lib/client.js` 是由 `src/product/client/thread-links.mjs` 构建的宿主 Client 模块。前端原生 React/DSH 模块由 Host 提供。

- `domain/`：项目、Thread 关联、派工交付、工作区授权、工具策略、知识与删除生命周期。
- `host/`：Host Agent/Session owner、公开工具/审批/模型接口、项目 API、事件投影与恢复。协调器和 Thread 使用独立宿主 Session。
- `backends/local/`：storage-domain、受管工作区、Git 边界、资料 blob、schema 迁移和 Profile 租约。
- `readers/`：Swift PDFKit/ImageIO 程序和隔离 Python OOXML 读取；不执行文档脚本/宏。
- `client/` 与 `protocol/`：Projects UI、原生会话引用、来源/状态/请求协议。

Project Conversation、Overview、Memory、Library 是插件拥有的工作区。Conversation 渲染、模型、审批、停止和持久 Session 由固定 DSH 构建提供。保留现有 Agent owner、Workspace/Git、Memory 和 reader 适配，不另建执行平台。

任务与文档均作为不可信内容；用户目录授权必须通过 Host/UI 明确记录。运行时工具集取项目选择、角色、目录许可、Git 保护、Host 与原生审批的交集。历史报告可读取和整合，不能伪装成新的用户资源授权。

仓库为原始 FINAL-01 提交的筛选快照，独立新历史；完整开发历史只在本地备份。基线身份见 RELEASE_MANIFEST.json。
