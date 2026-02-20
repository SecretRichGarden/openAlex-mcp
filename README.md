# OpenAlex + PubMed MCP Server

一个轻量化的 OpenAlex MCP 服务器，可与 PubMed MCP 搭配使用，为 AI Agent 提供快速学术文献检索、详细摘要信息和全文下载能力。

## 功能特性

- **论文搜索**: 通过关键词搜索学术文献，支持多种过滤和排序选项
- **论文详情**: 获取单篇论文的完整信息，包括摘要、作者、主题等
- **批量查询**: 一次性获取多篇论文的信息，提高效率
- **全文下载**: 检测并下载开放获取论文的 PDF 全文
- **章节提取**: 从 PDF 中提取并识别论文章节（摘要、引言、方法、结果等）
- **智能缓存**: 本地缓存论文元数据，减少 API 调用
- **速率限制**: 内置速率限制和指数退避重试机制

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/SecretRichGarden/openAlex-mcp.git
cd openAlex-mcp

# 安装依赖
npm install
```

### 配置

1. 复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件（可选）：

```env
# OpenAlex API 密钥（可选，但推荐获取以获得更高的速率限制）
# 在 https://openalex.org/register 免费获取
OPENALEX_API_KEY=your-api-key-here

# 启用缓存（默认：true）
CACHE_ENABLED=true

# 摘要处理模式（默认：quick）
ABSTRACT_MODE=quick
```

### 运行（本地）

```bash
npm start
```

### 运行（npx 一键）

```bash
npx -y openalex-mcp-server
```

### 配置 Claude Desktop

将以下配置添加到 Claude Desktop 的配置文件中：

**macOS/Linux**: `~/.claude/desktop_config.json`
**Windows**: `%APPDATA%\Claude\desktop_config.json`

```json
{
  "mcpServers": {
    "openalex-mcp-server": {
      "command": "node",
      "args": [
        "/path/to/openAlex-mcp/src/cli.js"
      ],
      "env": {
        "OPENALEX_API_KEY": "your-api-key-here",
        "CACHE_ENABLED": "true"
      }
    }
  }
}
```

或者使用 `npx`（无需安装）：

```json
{
  "mcpServers": {
    "openalex-mcp-server": {
      "command": "npx",
      "args": ["-y", "openalex-mcp-server"],
      "env": {
        "OPENALEX_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 可用工具

### `openalex_search`

搜索学术文献。

**参数**:
- `query` (必需): 搜索关键词
- `max_results` (可选): 每页结果数，默认 20，最大 200
- `page` (可选): 页码，默认 1
- `sort_by` (可选): 排序字段，如 "cited_by_count:desc"
- `filters` (可选): 过滤器对象
  - `publication_year`: 发表年份
  - `is_oa`: 是否为开放获取
  - `type`: 文献类型

**返回格式**:
```json
{
  "meta": {
    "total_count": 1000,
    "page": 1,
    "per_page": 20
  },
  "papers": [
    {
      "id": "W3128609807",
      "title": "论文标题",
      "authors": [...],
      "publication_year": 2023,
      "venue": {...},
      "cited_by_count": 42,
      "open_access": {...}
    }
  ]
}
```

### `openalex_get_work`

获取单篇论文的详细信息。

**参数**:
- `work_id` (必需): 论文 ID（OpenAlex ID、DOI 或 PMID）
- `include_abstract` (可选): 是否包含摘要，默认 true
- `abstract_mode` (可选): 摘要模式（quick/deep），默认 quick

**示例**:
```json
{
  "work_id": "W3128609807"
}
```

### `openalex_batch_get_works`

批量获取多篇论文信息。

**参数**:
- `work_ids` (必需): 论文 ID 数组（最多 50 个）
- `include_abstract` (可选): 是否包含摘要，默认 false

**示例**:
```json
{
  "work_ids": ["W3128609807", "W2741809807", "W2105678901"]
}
```

### `openalex_detect_fulltext`

检测论文是否有可用的全文。

**参数**:
- `work_id` (必需): 论文 ID

**返回**:
```json
{
  "work_id": "W3128609807",
  "is_oa": true,
  "oa_status": "gold",
  "oa_url": "https://arxiv.org/pdf/2301.xxxxx.pdf",
  "fulltext_available": true
}
```

### `openalex_download_fulltext`

下载论文全文 PDF。

**参数**:
- `work_id` (必需): 论文 ID
- `force_download` (可选): 强制重新下载，默认 false

**返回**:
```json
{
  "work_id": "W3128609807",
  "status": "downloaded",
  "cache_path": "/path/to/cache/W3128609807.pdf",
  "file_size": 1234567
}
```

### `openalex_get_fulltext_sections`

获取论文的章节内容。

**参数**:
- `work_id` (必需): 论文 ID
- `sections` (可选): 要获取的章节列表

**可用章节**:
- `abstract`
- `introduction`
- `methods`
- `results`
- `discussion`
- `conclusion`
- `references`

### `openalex_cache_stats`

查看缓存统计信息。

**参数**:
- `action` (可选): "stats" 或 "clear"，默认 stats

### `openalex_system_check`

检查系统状态和 API 连接。

**参数**: 无

## 使用示例

### 示例 1: 搜索机器学习相关的高被引论文

```json
{
  "tool": "openalex_search",
  "arguments": {
    "query": "machine learning",
    "max_results": 10,
    "sort_by": "cited_by_count:desc",
    "filters": {
      "publication_year": 2023,
      "is_oa": true
    }
  }
}
```

### 示例 2: 获取论文详情并下载全文

```json
{
  "tool": "openalex_get_work",
  "arguments": {
    "work_id": "W3128609807",
    "include_abstract": true
  }
}
```

```json
{
  "tool": "openalex_download_fulltext",
  "arguments": {
    "work_id": "W3128609807"
  }
}
```

```json
{
  "tool": "openalex_get_fulltext_sections",
  "arguments": {
    "work_id": "W3128609807",
    "sections": ["abstract", "introduction", "methods"]
  }
}
```

### 示例 3: 批量获取论文信息

```json
{
  "tool": "openalex_batch_get_works",
  "arguments": {
    "work_ids": [
      "W3128609807",
      "W2741809807",
      "W2105678901"
    ]
  }
}
```

### 示例 4: 与 PubMed MCP 配合使用

配置两个 MCP 服务器可以同时使用：

```json
{
  "mcpServers": {
    "openalex-mcp-server": {
      "command": "node",
      "args": ["/path/to/openAlex-mcp/src/cli.js"],
      "env": {
        "OPENALEX_API_KEY": "your-key"
      }
    },
    "pubmed-mcp-server": {
      "command": "npx",
      "args": ["-y", "@your-org/pubmed-mcp"]
    }
  }
}
```

工作流程：
1. 使用 OpenAlex 搜索论文获取广泛的学术文献
2. 使用 PubMed 获取生物医学领域的详细元数据
3. 使用 OpenAlex 下载全文并提取章节

## 配置选项

### 环境变量

| 变量 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `OPENALEX_API_KEY` | string | - | OpenAlex API 密钥（可选） |
| `CACHE_ENABLED` | boolean | true | 是否启用本地缓存 |
| `ABSTRACT_MODE` | string | quick | 摘要处理模式 |

### API 密钥

虽然不需要 API 密钥也可以使用 OpenAlex API，但注册并使用 API 密钥可以获得：
- 更高的速率限制（有密钥：10 请求/秒，无密钥：5 请求/秒）
- 更稳定的服务体验

在 [https://openalex.org/register](https://openalex.org/register) 免费获取 API 密钥。

## 项目结构

```
openalex-mcp/
├── src/
│   ├── index.js                 # MCP 服务器入口
│   ├── openalex-client.js       # OpenAlex API 客户端
│   ├── cache-manager.js         # 缓存管理器
│   ├── fulltext-downloader.js   # 全文下载器
│   ├── json-optimizer.js        # JSON 格式优化器
│   └── utils.js                 # 工具函数
├── config/
│   └── mcp-config.json          # MCP 配置模板
├── cache/
│   ├── papers/                  # 论文元数据缓存
│   └── fulltext/                # 全文 PDF 和文本缓存
├── package.json
├── .env.example
└── README.md
```

## 开发

### 类型检查

```bash
npm run typecheck
```

### 运行测试

```bash
npm test
```

## 常见问题

### Q: 为什么搜索结果为空？

A: 可能的原因：
1. 搜索关键词太具体或拼写错误
2. 应用了过于严格的过滤条件
3. 网络连接问题

### Q: 全文下载失败怎么办？

A: 检查以下几点：
1. 论文是否为开放获取（OA）
2. OA URL 是否有效
3. 网络连接是否正常
4. 使用 `openalex_detect_fulltext` 工具检查可用性

### Q: 如何提高 API 请求速率？

A: 注册并配置 OpenAlex API 密钥可以将速率从 5 请求/秒提高到 10 请求/秒。

### Q: 缓存占用空间太大怎么办？

A: 使用 `openalex_cache_stats` 工具查看缓存大小，并定期清理 `cache/` 目录。

## 许可证

ISC

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关链接

- [OpenAlex API 文档](https://docs.openalex.org/)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [Claude Desktop 配置指南](https://docs.anthropic.com/claude/docs/mcp)

---

Made with ❤️ for the AI research community
