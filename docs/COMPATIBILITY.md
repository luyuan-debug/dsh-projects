# 兼容性与依赖解析

固定已验证：DSH 0.2.1-rc.2，Host build 332895e0f7c9d4dbfb29729f5eb367fa263ff986，macOS arm64。随包 native reader 仅 arm64 Mach-O；其他系统未获产品安装验收。

构建固定 Node 26.8.1 / npm 11.19.0，lockfileVersion=3。Host 自带 Node 24.21.0 是隔离 Host 验证的运行时，两者分别记录。本轮不更新 lockfile。

插件声明固定 DSH peer 包。开发目录 `.npmrc` 使用 legacy-peer-deps，避免 npm 自动安装宿主 peer。这仅控制开发依赖解析，不能证明宿主 peer 检查通过。DSH 安装可能报告 unmet peer：插件不打包第二套 Host，运行期依赖由固定构建解析。实际安装/解析结果写入发布报告，警告不能改写为全版本兼容。

Client 中外置 React、react-dom 和 @deepseek-ai/*。esbuild 将 immer / zustand 及实际引用的传递实现合入 Client；Zod 4.4.3 随 tgz 打包。第三方许可证随包保留。

跨平台离线 CI 仅覆盖无需真实 Host/Desktop 的可重跑测试；Mac PDF/ImageIO、真实 Host 安装、Desktop、外部 MCP 与真实模型均需单独验证。
