# 安装

仅验证 DSH 0.2.1-rc.2 / 332895e0f7c9d4dbfb29729f5eb367fa263ff986 / macOS arm64。先校验候选包 SHA-256。DSH 插件页 → 安装第三方插件 → 输入 `.tgz` 的完整 `file:` URL → 立即启用 → 等待运行中，打开 Projects。

package 名仍为 `dsh-project-threads-wave1-spike`。正常安装不需要 `DSH_PROJECT_THREADS_*` 审计变量、测试模型或开发 overlay。未配置模型可以创建项目；执行任务仍需配置已授权模型。

CLI 等价示例（只在你选择的 Profile 执行）：

```sh
dsh plugin --profile <profile> add file:/absolute/path/candidate.tgz --ignore-scripts
```

宿主提供 peer 包；不要为了 peer 警告从注册表更新宿主。解析边界见 COMPATIBILITY.md。升级前按 MIGRATION.md 备份，停止任务并正常退出 DSH。

停用/卸载请使用插件页；插件入口消失不等于删除所有项目资料。需清理插件拥有的数据时先在 Projects 删除项目；历史归档保留。卸载不会隐式删除用户原目录。
