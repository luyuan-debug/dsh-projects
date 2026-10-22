# 本轮开源发布步骤

用户已授权 MIT / Public / Prerelease / 非 Latest。本轮由 Codex 执行，不需要再次申请同一发布授权。

1. 核对 MIT 及第三方声明，npm ci，build，完整 Mac 离线测试。
2. 生成 0.1.0-rc.1 tgz，对比包成员；全新隔离安装与 0.0.0-final01.5 升级验证。
3. 扫描当前源码、全部拟公开历史、发布资产及 Actions 日志。
4. 推送新提交和 v0.1.0-rc.1 标签；确认两端 CI 成功，不重写旧标签。
5. 更新同一个草稿 Release、上传新版本资产并下载核对。
6. 检查全部通过后将仓库改为 Public，发布该草稿，保留 Prerelease，make_latest=false。

旧 tools/release/publish.sh 只用于最初创建私有仓库，不用于此已有仓库的公开发布。
