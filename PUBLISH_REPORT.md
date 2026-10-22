# DSH Projects 发布报告

本地发布准备完成；尚未推送、创建 GitHub 仓库或 Release。唯一外部阻塞是 GitHub 发布通道未就绪。仓库目标 dsh-projects，策略 Private + Draft Prerelease，许可证待用户选择。

## 整理结果

从已校验的 FINAL-01 source.bundle 恢复权威 HEAD，建立全新独立 Git 快照，原始 58 提交及保护 refs 留在仓库外本地备份。保留产品源码/Client/构建/测试/迁移代码与必要资料，排除旧日志、证据大包、旧插件、私人图、Profile 和凭据。新增 README、安装/使用/架构/兼容性/限制/迁移/发布文档，SECURITY、CONTRIBUTING、CHANGELOG、第三方声明及许可副本。

46 个产品/Client/配置/lockfile 身份文件逐字节等于原提交（docs/SOURCE_SELECTION.json）；没有新增功能。package name、持久化 namespace 与内部版本保持，修改 files 打包列表、增加离线测试入口与发布维护工具。使用 final01-candidate tag。新包 SHA-256 `04ff55627e134d3e739afe0cd78185c35dff5c01d75da30619377e2b6123bd8f`，旧包保留在本地备份。

## 实际重跑结果

- npm ci 与 build 成功；Node 26.8.1 / npm 11.19.0 固定，lockfile 哈希未变。Client hash 与 FINAL-01 一致。
- Mac 离线 196/196，portable 离线 178/178。首次测试入口使用临时目录符号路径导致断言失败，改为 realpath 后重跑通过；产品代码未改。
- 新独立 DSH_HOME/Profile 安装/启用、项目/独立 Thread、Host 检视、Thread 直接续聊、协调器继续同一 Session、冷恢复、停用/普通会话、重新启用和卸载/普通会话均通过。776 个源码/包/安装文件逐字节一致。退出后无已观察的测试进程残留。
- 安装 peer 警告保留，peers check exit=1；固定 Host 的实际功能通过，不能视为 peer 检查通过或全版本兼容。Host 四项关键文件与基线 hash 相同。
- 初次 Host 验证被沙箱进程清单限制中断；随后获得该次操作自动批准，在独立环境重跑。测试适配器曾漏选真实来源消息、漏传普通 Session ID；修正测试工具后在全新 Profile 跑完整流程。原失败材料仅留本地，不改写为产品测试 PASS。
- 收费模型调用 0；真实 Host + 脚本模型。Desktop GUI 本轮未重跑；原交付的 Desktop 证据不冒充本轮观察。CI 工作流已配置，但 GitHub 未运行。

## 安全、许可和边界

最终源码/拟推送独立历史/安装包有限扫描未处理项为 0，逐项复核记录见 SECURITY_SCAN_REPORT.md。补充 Zod、immer、zustand、use-sync-external-store、esbuild 的许可文本。自有部分权属/许可证尚待维护者确认，未自动添加 LICENSE 或公开；推荐选项见 LICENSE_DECISION.md。

真实模型语义、完整 Claude parity、用户接受均 false。真实外部 MCP、自动创建 Thread Routine、产品内 PR/CI、多可写仓库高级流程仍未闭合；只有固定 macOS arm64 / DSH 构建证据。现代文档读取范围与删除保留历史规则见 docs/KNOWN_LIMITATIONS.md。

## GitHub 与后续动作

本机 gh 未安装。GitHub 连接只完成无破坏查询，未返回授权仓库，且工具不支持建仓/Release/资产上传。不能据连接存在推断写权限。未安装系统软件，也未进行任何外部写入。

用户仅需准备已认证且有相应权限的 gh，然后让 Codex继续；安装后第一条命令为 `gh auth login --hostname github.com --git-protocol https --web`，无需提供 token。后续 exact command 为 `sh tools/release/publish.sh /absolute/path/to/release-artifacts`。它会先重扫/验 hash，再创建 Private 仓库、推 main/tag 和 Draft Prerelease，设置 latest=false。详情见 MANUAL_PUBLISH_STEPS.md。

仓库 URL：未创建；Release URL：未创建；remote main：未推送。候选 commit 与本机绝对路径见外层 RELEASE_MANIFEST.json / PUBLISH_REPORT.md。
