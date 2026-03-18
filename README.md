# AI Digest

Fork 说明：
1. 优先从 [Fusion](https://github.com/0x2e/fusion) 的数据库读取
  * 如果没有配置 Fusion 的数据库的路径，降为从 RSS 数据源实时抓取
2. 项目结构尽量与原项目保持一致，方便后续维护和扩展。
3. 可以复用 Fusion 的优点，你可以通过 Fusion 管理自己的RSS源、更新数据。

---

## 原本介绍

skill 制作详情可查看 ➡️ https://mp.weixin.qq.com/s/rkQ28KTZs5QeZqjwSCvR4Q

从 [Andrej Karpathy](https://x.com/karpathy) 推荐的 90 个 Hacker News 顶级技术博客中抓取最新文章，通过 MiniMax AI 多维评分筛选，生成一份结构化的每日精选日报。

![AI Digest 概览](assets/overview.png)

> 信息源来自 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/)，涵盖 simonwillison.net、paulgraham.com、overreacted.io、gwern.net、krebsonsecurity.com 等。

## 使用方式

作为 OpenCode Skill 使用，在对话中输入 `/digest` 即可启动交互式引导流程：

```
/digest
```

Agent 会依次询问：

| 参数 | 选项 | 默认值 |
|------|------|--------|
| 时间范围 | 24h / 48h / 72h / 7天 | 48h |
| 精选数量 | 10 / 15 / 20 篇 | 15 篇 |
| 输出语言 | 中文 / English | 中文 |
| MiniMax API Key | 手动输入（首次需要，之后自动记忆） | — |

配置会自动保存到 `~/.ai-digest/config.json`（含 `fusionDbPath`、`outputDir` 等字段），下次运行可一键复用。

### 直接命令行运行

```bash
export MINIMAX_API_KEY="your-key"
export FUSION_DB_PATH="/path/to/fusion.db"  # 可选，默认 ~/apps/fusion/fusion.db
npx -y bun scripts/digest.ts --hours 48 --top-n 15 --lang zh --output ./output/digest.md
```

脚本启动时会读取 `~/.ai-digest/config.json`，CLI 参数优先级高于配置文件。

## 功能

### 五步处理流水线

```
Fusion DB → 时间过滤 → AI 评分+分类 → AI 摘要+翻译 → 趋势总结
```

1. **数据获取** — 优先从 [Fusion](https://github.com/0x2e/fusion) SQLite 数据库读取文章；若数据库不可用则回退到直接抓取 90 个 RSS 源（10 路并发，15s 超时），兼容 RSS 2.0 和 Atom 格式
2. **时间过滤** — 按指定时间窗口筛选近期文章
3. **AI 评分** — MiniMax 从相关性、质量、时效性三个维度打分（1-10），同时完成分类和关键词提取
4. **AI 摘要** — 为 Top N 文章生成结构化摘要（4-6 句）、中文标题翻译、推荐理由
5. **趋势总结** — AI 归纳当日技术圈 2-3 个宏观趋势

### 日报结构

生成的 Markdown 文件包含以下板块：

| 板块 | 内容 |
|------|------|
| 📝 今日看点 | 3-5 句话的宏观趋势总结 |
| 🏆 今日必读 | Top 3 深度展示：中英双语标题、摘要、推荐理由、关键词 |
| 📊 数据概览 | 统计表格 + Mermaid 饼图（分类分布）+ Mermaid 柱状图（高频关键词）+ ASCII 纯文本图 + 话题标签云 |
| 分类文章列表 | 按 6 大分类分组，每篇含中文标题、来源、相对时间、评分、摘要、关键词 |

### 六大分类体系

| 分类 | 覆盖范围 |
|------|----------|
| 🤖 AI / ML | AI、机器学习、LLM、深度学习 |
| 🔒 安全 | 安全、隐私、漏洞、加密 |
| ⚙️ 工程 | 软件工程、架构、编程语言、系统设计 |
| 🛠 工具 / 开源 | 开发工具、开源项目、新发布的库/框架 |
| 💡 观点 / 杂谈 | 行业观点、个人思考、职业发展 |
| 📝 其他 | 不属于以上分类的内容 |

## 亮点

- **零依赖** — 纯 TypeScript 单文件，无第三方库，基于 Bun 运行时的原生 `fetch`、`bun:sqlite` 和内置 XML 解析
- **中英双语** — 所有标题自动翻译为中文，原文标题保留为链接文字，不错过任何语境
- **结构化摘要** — 不是一句话敷衍了事，而是 4-6 句覆盖核心问题→关键论点→结论的完整概述，30 秒判断一篇文章是否值得读
- **可视化统计** — Mermaid 图表（GitHub/Obsidian 原生渲染）+ ASCII 柱状图（终端友好）+ 标签云，三种方式覆盖所有阅读场景
- **智能分类** — AI 自动将文章归入 6 大类别，按类浏览比平铺列表高效得多
- **趋势洞察** — 不只是文章列表，还会归纳当天技术圈的宏观趋势，帮你把握大方向
- **配置记忆** — API Key 和偏好参数自动持久化，日常使用一键运行

## 环境要求

- [Bun](https://bun.sh) 运行时（通过 `npx -y bun` 自动安装）
- [Fusion](https://github.com/0x2e/fusion) SQLite 数据库可访问（通过 `FUSION_DB_PATH` 环境变量或配置文件 `fusionDbPath` 字段指定路径，未配置时自动回退到直接抓取 RSS 源）
- MiniMax API Key（[免费获取](https://platform.minimaxi.com)）
- 网络连接

## 信息源

90 个 RSS 源精选自 Hacker News 社区最受欢迎的独立技术博客，包括但不限于：

> Simon Willison · Paul Graham · Dan Abramov · Gwern · Krebs on Security · Antirez · John Gruber · Troy Hunt · Mitchell Hashimoto · Steve Blank · Eli Bendersky · Fabien Sanglard ...

完整列表内嵌于 `scripts/digest.ts`。
