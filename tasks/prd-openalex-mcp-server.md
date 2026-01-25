# OpenAlex MCP Server - Ralph YOLO PRD

## Overview
构建一个轻量化的 OpenAlex MCP 服务器，为 AI Agent 提供快速学术文献检索、详细摘要信息和全文下载能力。使用 Node.js 和 @modelcontextprotocol/sdk 实现，支持与 PubMed MCP 配合使用。

---

## User Stories

### US-001: 项目初始化和基础结构
**As a** 开发者,
**I want** 初始化 Node.js 项目并创建基础目录结构,
**So that** 项目有一个清晰的代码组织基础。

**Acceptance Criteria:**
- [ ] 创建 `package.json`，包含项目名称 `openalex-mcp-server`，版本 `1.0.0`
- [ ] 添加依赖：`@modelcontextprotocol/sdk`、`node-fetch`、`dotenv`
- [ ] 创建目录结构：`src/`、`config/`、`cache/papers/`、`cache/fulltext/`
- [ ] 创建 `.env.example` 文件，包含 `OPENALEX_API_KEY`、`ABSTRACT_MODE`、`CACHE_ENABLED` 配置项
- [ ] 创建 `.gitignore` 文件，忽略 `node_modules/`、`.env`、`cache/`
- [ ] Typecheck passes

---

### US-002: 工具函数模块
**As a** 开发者,
**I want** 创建通用工具函数模块,
**So that** 其他模块可以复用这些功能。

**Acceptance Criteria:**
- [ ] 创建 `src/utils.js` 文件
- [ ] 实现 `rebuildAbstract(invertedIndex)` 函数：从 OpenAlex 的 `abstract_inverted_index` 重建完整摘要文本
- [ ] 实现 `simplifyOpenAlexId(url)` 函数：将 `https://openalex.org/W123` 简化为 `W123`
- [ ] 实现 `sleep(ms)` 函数：异步延迟
- [ ] 实现 `validateWorkId(id)` 函数：验证 OpenAlex Work ID 格式
- [ ] 导出所有函数
- [ ] Typecheck passes

---

### US-003: 缓存管理器模块
**As a** 开发者,
**I want** 创建文件系统缓存管理器,
**So that** 可以缓存论文元数据和全文，避免重复 API 调用。

**Acceptance Criteria:**
- [ ] 创建 `src/cache-manager.js` 文件
- [ ] 实现 `CacheManager` 类，支持以下方法：
  - `get(key)`: 获取缓存数据
  - `set(key, data, expiryDays)`: 设置缓存，默认 30 天过期
  - `has(key)`: 检查缓存是否存在且未过期
  - `delete(key)`: 删除缓存
  - `getStats()`: 返回缓存统计信息（文件数、总大小）
- [ ] 缓存存储在 `cache/papers/` 目录，使用 JSON 格式
- [ ] 自动创建缓存目录（如果不存在）
- [ ] Typecheck passes

---

### US-004: OpenAlex API 客户端 - 基础请求
**As a** 开发者,
**I want** 创建 OpenAlex API 客户端基础模块,
**So that** 可以与 OpenAlex API 进行交互。

**Acceptance Criteria:**
- [ ] 创建 `src/openalex-client.js` 文件
- [ ] 实现 `OpenAlexClient` 类，构造函数接受 `apiKey` 参数（可选）
- [ ] 实现 `_request(endpoint, params)` 私有方法：发送 GET 请求到 OpenAlex API
- [ ] 请求头包含 `User-Agent` 和可选的 `api_key` 参数
- [ ] 基础 URL 为 `https://api.openalex.org`
- [ ] 实现基础错误处理（HTTP 错误码检查）
- [ ] Typecheck passes

---

### US-005: OpenAlex API 客户端 - 搜索功能
**As a** 开发者,
**I want** 实现论文搜索功能,
**So that** 用户可以通过关键词检索论文。

**Acceptance Criteria:**
- [ ] 在 `OpenAlexClient` 类中添加 `search(query, options)` 方法
- [ ] 支持参数：`query`（必需）、`max_results`（默认20，最大200）、`page`（默认1）、`sort_by`
- [ ] 支持过滤器：`publication_year`、`is_oa`、`type`
- [ ] 使用 `select` 参数只获取必要字段：`id,title,authorships,publication_year,primary_location,cited_by_count,open_access,doi`
- [ ] 返回简化的论文列表格式（见 US-007）
- [ ] Typecheck passes

---

### US-006: OpenAlex API 客户端 - 获取单篇论文
**As a** 开发者,
**I want** 实现获取单篇论文详情功能,
**So that** 用户可以获取论文的完整信息。

**Acceptance Criteria:**
- [ ] 在 `OpenAlexClient` 类中添加 `getWork(workId, options)` 方法
- [ ] 支持通过 OpenAlex ID（W123）、DOI（10.xxx）、PMID 查询
- [ ] 支持参数：`include_abstract`（默认true）、`include_authors`（默认true）、`include_topics`（默认true）
- [ ] 返回优化后的论文详情格式（见 US-007）
- [ ] Typecheck passes

---

### US-007: JSON 格式优化器
**As a** 开发者,
**I want** 创建 JSON 格式优化器模块,
**So that** API 返回的数据更简洁，提升 LLM 上下文利用效率。

**Acceptance Criteria:**
- [ ] 创建 `src/json-optimizer.js` 文件
- [ ] 实现 `optimizeWork(rawWork)` 函数，将 OpenAlex 原始响应转换为简化格式
- [ ] 简化规则：
  - 将 `https://openalex.org/W123` 简化为 `W123`
  - 将 `authorships` 扁平化为 `authors` 数组（包含 name、institution、orcid）
  - 从 `abstract_inverted_index` 重建完整摘要
  - 提取 `open_access.oa_url` 到顶层
  - 从 `primary_location.source.display_name` 提取 `venue`
- [ ] 实现 `optimizeSearchResults(rawResults)` 函数，优化搜索结果列表
- [ ] Typecheck passes

---

### US-008: MCP 服务器入口 - 基础框架
**As a** 开发者,
**I want** 创建 MCP 服务器入口文件,
**So that** 可以作为 MCP 服务器运行。

**Acceptance Criteria:**
- [ ] 创建 `src/index.js` 文件
- [ ] 使用 `@modelcontextprotocol/sdk` 创建 MCP Server 实例
- [ ] 服务器名称为 `openalex-mcp-server`
- [ ] 加载环境变量（使用 dotenv）
- [ ] 初始化 `OpenAlexClient` 和 `CacheManager` 实例
- [ ] 实现 `server.run()` 启动逻辑
- [ ] 在 `package.json` 添加 `"bin": {"openalex-mcp": "./src/index.js"}` 和 `"type": "module"`
- [ ] Typecheck passes

---

### US-009: MCP Tool - openalex_search
**As a** AI Agent,
**I want** 使用 openalex_search 工具搜索论文,
**So that** 可以快速找到相关学术文献。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_search` 工具
- [ ] 工具描述：「Search for academic papers in OpenAlex database」
- [ ] 输入参数 schema：`query`（必需）、`max_results`（可选，默认20）、`filters`（可选对象）、`sort_by`（可选）
- [ ] 调用 `OpenAlexClient.search()` 并返回优化后的结果
- [ ] 返回格式包含 `meta`（total_count、page、per_page）和 `papers` 数组
- [ ] Typecheck passes

---

### US-010: MCP Tool - openalex_get_work
**As a** AI Agent,
**I want** 使用 openalex_get_work 工具获取论文详情,
**So that** 可以获取论文的完整摘要和元数据。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_get_work` 工具
- [ ] 工具描述：「Get detailed information about a specific paper」
- [ ] 输入参数 schema：`work_id`（必需，支持 OpenAlex ID/DOI/PMID）、`include_abstract`（可选）、`abstract_mode`（可选，quick/deep）
- [ ] 调用 `OpenAlexClient.getWork()` 并返回优化后的结果
- [ ] 支持缓存：先检查缓存，命中则直接返回
- [ ] Typecheck passes

---

### US-011: MCP Tool - openalex_batch_get_works
**As a** AI Agent,
**I want** 使用 openalex_batch_get_works 工具批量获取论文,
**So that** 可以一次获取多篇论文的信息。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_batch_get_works` 工具
- [ ] 工具描述：「Get information for multiple papers in one request」
- [ ] 输入参数 schema：`work_ids`（必需，数组，最多50个）、`include_abstract`（可选）
- [ ] 在 `OpenAlexClient` 中添加 `batchGetWorks(workIds, options)` 方法
- [ ] 使用 OR 过滤器批量查询：`filter=openalex:W123|W456|W789`
- [ ] 返回论文数组
- [ ] Typecheck passes

---

### US-012: 全文下载器模块 - 检测和下载
**As a** 开发者,
**I want** 创建全文下载器模块,
**So that** 可以检测和下载 OA 论文全文。

**Acceptance Criteria:**
- [ ] 创建 `src/fulltext-downloader.js` 文件
- [ ] 实现 `FulltextDownloader` 类
- [ ] 实现 `detectFulltext(workData)` 方法：检测论文是否有可用的 OA 全文 URL
- [ ] 实现 `downloadFulltext(workId, oaUrl)` 方法：下载 PDF 到 `cache/fulltext/{workId}.pdf`
- [ ] 返回下载状态：`{ status: 'downloaded' | 'cached' | 'failed', path: string }`
- [ ] Typecheck passes

---

### US-013: 全文下载器模块 - 文本提取
**As a** 开发者,
**I want** 从 PDF 中提取文本内容,
**So that** 可以支持基于全文的 QA 增强。

**Acceptance Criteria:**
- [ ] 添加 `pdf-parse` 依赖到 `package.json`
- [ ] 在 `FulltextDownloader` 类中实现 `extractText(pdfPath)` 方法
- [ ] 提取全文文本并保存到 `cache/fulltext/{workId}.txt`
- [ ] 实现 `extractSections(text)` 方法：尝试识别并提取 abstract、introduction、methods、results、discussion 章节
- [ ] 将提取结果保存到 `cache/fulltext/{workId}_sections.json`
- [ ] Typecheck passes

---

### US-014: MCP Tool - openalex_detect_fulltext
**As a** AI Agent,
**I want** 使用 openalex_detect_fulltext 工具检测全文可用性,
**So that** 可以知道论文是否可以下载全文。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_detect_fulltext` 工具
- [ ] 工具描述：「Check if full text is available for a paper」
- [ ] 输入参数 schema：`work_id`（必需）
- [ ] 返回：`{ work_id, is_oa, oa_status, oa_url, fulltext_available }`
- [ ] Typecheck passes

---

### US-015: MCP Tool - openalex_download_fulltext
**As a** AI Agent,
**I want** 使用 openalex_download_fulltext 工具下载论文全文,
**So that** 可以获取论文的完整内容。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_download_fulltext` 工具
- [ ] 工具描述：「Download full text PDF for an open access paper」
- [ ] 输入参数 schema：`work_id`（必需）、`force_download`（可选，默认false）
- [ ] 调用 `FulltextDownloader.downloadFulltext()` 并返回结果
- [ ] 返回：`{ work_id, status, cache_path, file_size }`
- [ ] Typecheck passes

---

### US-016: MCP Tool - openalex_get_fulltext_sections
**As a** AI Agent,
**I want** 使用 openalex_get_fulltext_sections 工具获取论文章节,
**So that** 可以获取论文特定部分的内容。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_get_fulltext_sections` 工具
- [ ] 工具描述：「Get extracted sections from a downloaded paper」
- [ ] 输入参数 schema：`work_id`（必需）、`sections`（可选数组，默认全部）
- [ ] 如果全文未下载，先触发下载和提取
- [ ] 返回请求的章节内容
- [ ] Typecheck passes

---

### US-017: MCP Tool - openalex_cache_stats
**As a** AI Agent,
**I want** 使用 openalex_cache_stats 工具查看缓存统计,
**So that** 可以了解缓存使用情况。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_cache_stats` 工具
- [ ] 工具描述：「Get cache statistics」
- [ ] 输入参数 schema：`action`（可选，默认 "stats"，可选 "clear"）
- [ ] 返回：`{ papers_cached, fulltext_cached, total_size_mb, cache_dir }`
- [ ] 如果 action 为 "clear"，清空缓存并返回确认
- [ ] Typecheck passes

---

### US-018: MCP Tool - openalex_system_check
**As a** AI Agent,
**I want** 使用 openalex_system_check 工具检查系统状态,
**So that** 可以验证 MCP 服务器运行正常。

**Acceptance Criteria:**
- [ ] 在 MCP 服务器注册 `openalex_system_check` 工具
- [ ] 工具描述：「Check system status and API connectivity」
- [ ] 无需输入参数
- [ ] 测试 OpenAlex API 连接（发送测试请求）
- [ ] 返回：`{ status: 'healthy' | 'degraded', api_reachable, cache_enabled, version }`
- [ ] Typecheck passes

---

### US-019: 速率限制和错误重试
**As a** 开发者,
**I want** 实现 API 速率限制和错误重试机制,
**So that** 服务器可以稳定可靠地运行。

**Acceptance Criteria:**
- [ ] 在 `OpenAlexClient` 中实现速率限制器：最多 10 请求/秒
- [ ] 实现指数退避重试：1s、2s、4s、8s、16s，最多 5 次重试
- [ ] 处理常见错误：429 (Rate Limit)、500、502、503、504
- [ ] 记录重试日志到 stderr
- [ ] Typecheck passes

---

### US-020: MCP 配置文件模板
**As a** 用户,
**I want** 有一个 MCP 配置文件模板,
**So that** 可以快速配置 Claude Desktop 或其他 MCP 客户端。

**Acceptance Criteria:**
- [ ] 创建 `config/mcp-config.json` 配置模板
- [ ] 包含使用 `node` 直接运行的配置示例
- [ ] 包含使用 `npx` 运行的配置示例
- [ ] 包含环境变量配置说明
- [ ] 在 README.md 中添加配置说明（创建基础 README）
- [ ] Typecheck passes

---

### US-021: 项目文档和使用说明
**As a** 用户,
**I want** 有完整的项目文档,
**So that** 可以快速上手使用。

**Acceptance Criteria:**
- [ ] 创建 `README.md` 文件，包含：
  - 项目简介
  - 快速开始（安装、配置、运行）
  - 可用工具列表及参数说明
  - 配置选项说明
  - 与 PubMed MCP 配合使用说明
- [ ] 包含至少 3 个使用示例
- [ ] Typecheck passes

---

## Story Dependencies

```
US-001 (项目初始化)
  └── US-002 (工具函数)
  └── US-003 (缓存管理器)
  └── US-004 (API客户端基础)
        └── US-005 (搜索功能)
        └── US-006 (获取论文)
        └── US-007 (JSON优化器)
              └── US-008 (MCP服务器框架)
                    └── US-009 (search工具)
                    └── US-010 (get_work工具)
                    └── US-011 (batch_get_works工具)
                    └── US-017 (cache_stats工具)
                    └── US-018 (system_check工具)
  └── US-012 (全文下载器-检测下载)
        └── US-013 (全文下载器-文本提取)
              └── US-014 (detect_fulltext工具)
              └── US-015 (download_fulltext工具)
              └── US-016 (get_fulltext_sections工具)
  └── US-019 (速率限制)
  └── US-020 (配置模板)
  └── US-021 (项目文档)
```

---

## Technical Notes

- **语言**: JavaScript (ES Modules)
- **运行时**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP客户端**: node-fetch
- **PDF处理**: pdf-parse
- **OpenAlex API**: https://api.openalex.org
- **速率限制**: 100 req/s (with API key), 10 req/s (polite limit)

---

**文档版本**: 1.0
**创建日期**: 2026-01-25
**适配目标**: Ralph YOLO 自动化开发
