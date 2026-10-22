# 升级、数据身份与回退

本轮保留 package name `dsh-project-threads-wave1-spike`、插件 id、Client module id、事件名和 `project_threads_*` 持久化命名空间，产品实现文件逐字节沿用 FINAL-01。版本继续 `0.0.0-final01.5`，tag 采用 `final01-candidate`，避免把发布整理当成已验证的版本升级。

数据根由 DSH_HOME/Profile 和标准 XDG_DATA_HOME 派生为 `dsh-project-threads/<身份哈希>`，元数据由对应 storage-domain 管理。不要仅改包名或删除显式受管路径就假定迁移完成。

升级前：暂停项目、停止任务、正常退出 DSH，一致备份数据根与同 Profile 的 project_threads_* 存储。不要复制账号配置/凭据。保留原 ID、cwd、grant、snapshot，不自动迁移绝对工作路径。回退恢复同路径/同 Profile 的一致快照。旧版不理解新工具撤销约束时，不能回退后直接执行任务。

后续安全重命名建议（尚未执行）：先盘点 package/bundle/module/storage/事件/迁移键及 Host 安装解析的耦合；保留旧包兼容入口和旧数据只读识别；设计显式用户确认、备份、原子提交、幂等恢复与失败回滚；用旧 Profile、Direct/Worktree、Memory/Library、Thread、停启/卸载矩阵验收后再决定版本和身份变化。不能同时加载两个 writer 访问同一命名空间。
