# 文件与语言支持

Memory 正式记录保存在项目数据域，逻辑 Markdown 文件、当前决定、候选与历史由 Projects 负责。Evidence 是可重建的本地词法索引；排名和资料正文不会授予权限。

| 来源 | 当前正文能力 | 可追溯位置 | 主要边界 |
| --- | --- | --- | --- |
| 正式记忆 | 当前可见、active 记录全量参与同一词法核心；非前 50 条截断 | entryId、revision、logicalPath、hash、来源引用 | 候选不进入当前 Packet；历史须显式查询；不推断用户已经批准 |
| 授权工程 UTF-8 文本 | Markdown、纯文本与已列入白名单的代码/配置文本 | Project、resourceId、workspaceInstanceId、相对路径、内容 SHA-256、行号 | 不支持 UTF-16 解码；二进制、symlink、隐藏目录、凭据、依赖和构建目录排除；尊重 `.gitignore` 与显式 excludes |
| PDF | 复用既有 PDFKit 文字层提取 | 物理页码、原文件 hash/version | 扫描页/图片仅支持原有图像阅读；无 OCR、自动视觉理解或新增模型请求 |
| DOCX | 复用既有 OOXML reader 的段落与表格单元格正文 | `word/document.xml` 内段落/表格位置 | 页眉页脚、批注、脚注及不支持的结构遵循 reader 的遗漏声明；不渲染图片和图表 |
| XLSX | 已读取范围的原始单元格值，逐工作表保留身份 | sheet、cell、文件 hash/version | Evidence 默认最多 8 工作表，每表 `A1:T50`；始终明确显示该范围限制；不计算公式、不补造缺失缓存、不展开共享公式、不解释图表 |
| PPTX | 幻灯片形状文本与表格值 | 幻灯片号、文件 hash/version | 不自动索引讲者备注；组合形状、母版/布局文本、动画与图表值遵循既有 reader 限制 |
| PNG / JPEG | 无自动可索引正文 | 原文件 hash/version；可沿用既有视觉读取 | 不把文件名当图片正文，不 OCR、不新增视觉模型调用 |
| 旧 DOC/XLS/PPT、加密/宏/异常容器 | 不进入 Evidence 正文 | 明确拒绝或降级原因 | 不执行 Office、不跟随外链、不展开 ZIP 到任意 Host 路径 |

工程符号抽取实际复用固定版本 `dsh-project-memory` 的**纯规则扫描**，包括 JS/TS 家族、Python、Go、Rust、C/C++/C#/Java 和 Shell 的适用声明。它不是编译器或 AST 解析器，不承诺完整语法、重载解析、类型解析、跨文件调用关系或所有语言特性。Swift、Kotlin、Ruby、PHP、Lua、GDScript 等允许的文本文件仍可进行正文词法检索；不将其宣传为 AST 支持。

词法核心处理拉丁词/标识符及 CJK 双字片段。它能匹配实际出现的术语、中文片段与标识符，不保证语义相似或跨语言同义改写召回。没有 embedding、向量引擎、辅助模型或第二搜索库。

Library Evidence 仅通过现有 `ProjectKnowledge.libraryRead` 接口读取：单次最多 65,536 字节；一次收集累计最多 512 KiB、50 页/单元、8 工作表、64 次 reader 请求。结构化 JSON 分页必须收齐并成功解析后才提供真实 records；超限半截 JSON 不参与正文索引。有限范围、无文字层、截断和失败均显示警告。界面正文预览另限于 64 KiB，预览截断不冒充来源全文；索引保留其已成功收集的真实 records 和位置。

工程扫描默认最多 2,000 文件、5,000 目录、32 MiB、20,000 派生块；单文件 256 KiB，单来源最多 128 块。超限会说明遗漏；不会把有限测量写成无限规模支持。选中源文件在返回前重新核对 hash；变化或撤权的引用被拒绝/移除，旧行号不会冒充当前来源。

离线文档读取测试使用 `tests/fixtures/readers` 的 PDF、DOCX、XLSX、PPTX、PNG 和合成大文本/大 OOXML，经实际 LibraryBlobs 导入及 ProjectKnowledge 读取；它证明提取、分页、位置和检索接线，不证明模型理解，也不能替代原生 Desktop 完整用户流程验证。
