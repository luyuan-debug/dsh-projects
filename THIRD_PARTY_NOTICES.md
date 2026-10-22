# 第三方声明

本轮从 FINAL-01 项目源码恢复并整理，没有移植社区 reader、MCP transport 或宿主实现。筛选树不含旧 evidence 中的官方实现摘录或私人参考图。本项目自身许可证尚未决定，见 LICENSE_DECISION.md。

| 包 | 固定版本 | 许可 | 分发位置 |
| --- | --- | --- | --- |
| zod | 4.4.3 | MIT | tgz 内 node_modules/zod（含原 LICENSE） |
| immer | 10.1.1 | MIT | lib/client.js 中引用的实现 |
| zustand | 4.5.7 | MIT | lib/client.js 中引用的实现 |
| use-sync-external-store | 1.7.0 | MIT | Client 构建的传递依赖；未引用部分不分发 |
| esbuild | 0.25.10 | MIT | 仅构建工具，不打包运行时 |

原版权及完整许可见 third_party/licenses/*.txt；这些文本也加入 npm 安装包。esbuild 平台包与主项目同为 MIT，构建环境保留其元数据。React/react-dom 与 @deepseek-ai/* 由宿主提供并外置，不复制到安装包。Swift reader 调用系统 AppKit/PDFKit/ImageIO，Python reader 用标准库做有界静态读取。测试资料为交付包中的合成资料，不含私人 Claude 图或用户项目。

Git bundle 中保留原始来源历史，本地备份不推送。静态来源审计不足以替代维护者对自有代码权属的确认。
