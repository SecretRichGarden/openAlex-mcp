# OpenAlex MCP Server - 产品需求文档 (PRD)

**版本**: 1.0  
**日期**: 2026-01-25  
**作者**: AI编程助手架构师  
**状态**: 待开发

---

## 📋 目录

1. [项目概述](#项目概述)
2. [需求分析](#需求分析)
3. [功能需求](#功能需求)
4. [技术架构](#技术架构)
5. [API设计](#api设计)
6. [数据模型](#数据模型)
7. [性能优化](#性能优化)
8. [部署方案](#部署方案)
9. [开发计划](#开发计划)
10. [风险评估](#风险评估)

---

## 1. 项目概述

### 1.1 项目背景

OpenAlex 是一个完全开放的全球研究系统目录，包含超过 2.4 亿篇学术文献。相比 PubMed，OpenAlex 具有以下优势：

- **更快的响应速度**：现代化的 REST API，响应时间通常在 200ms 以内
- **开放获取支持**：可以直接下载 OA 论文全文
- **更丰富的元数据**：包含引用关系、主题分类、机构信息等
- **免费且无限制**：每天 100,000 credits（免费 API Key）

### 1.2 项目目标

构建一个轻量化的 OpenAlex MCP 服务器，与现有的 PubMed MCP 服务器配合使用，为 AI Agent 提供：

1. **快速的文章检索能力**（快速模式）
2. **详细的摘要信息**（深度模式）
3. **全文下载与内容缓存**（深度专家模式）
4. **优化的 JSON 输出格式**，提升上下文利用效率
5. **多 Agent 协作支持**，便于扩展

### 1.3 核心价值

- **互补性**：与 PubMed MCP 配合，覆盖更全面的学术资源
- **高效性**：利用 OpenAlex 的快速 API，提升检索速度
- **智能化**：基于全文内容的 QA 增强，提供深度分析能力
- **轻量化**：前端语言实现，易于部署和维护

---

## 2. 需求分析

### 2.1 用户场景

#### 场景 1：快速文献检索
```
用户：帮我找一下关于"CRISPR基因编辑"的最新论文
AI Agent → OpenAlex MCP (快速模式) → 返回论文列表
```

#### 场景 2：深度信息获取
```
用户：这篇论文的主要发现是什么？
AI Agent → OpenAlex MCP (深度模式) → 返回详细摘要和关键信息
```

#### 场景 3：全文分析与QA增强
```
用户：这篇论文的实验方法是什么？
AI Agent → OpenAlex MCP (深度专家模式) → 下载全文 → 提取相关内容 → 回答
```

#### 场景 4：多源数据对比
```
用户：比较 PubMed 和 OpenAlex 中关于某个主题的论文
AI Agent → PubMed MCP + OpenAlex MCP → 对比分析
```

### 2.2 功能优先级

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 文章检索（快速模式） | P0 | 核心功能，必须实现 |
| 摘要信息（深度模式） | P0 | 核心功能，必须实现 |
| 全文下载与缓存 | P1 | 重要功能，提升深度分析能力 |
| JSON格式优化 | P1 | 提升上下文利用效率 |
| 多Agent协作支持 | P2 | 便于扩展和集成 |

---

## 3. 功能需求

### 3.1 功能 1：文章检索（快速模式）

#### 3.1.1 功能描述
提供快速的文章检索能力，返回论文的基本信息列表，适合快速浏览和筛选。

#### 3.1.2 输入参数
```typescript
{
  query: string;              // 搜索关键词（支持 OpenAlex 查询语法）
  max_results?: number;       // 最大返回结果数（默认：20，最大：200）
  filters?: {                 // 过滤条件
    publication_year?: number | string;  // 年份或范围，如 2020, "2020-2023", ">2020"
    is_oa?: boolean;          // 是否开放获取
    type?: string;            // 类型：article, book, dataset 等
    topics?: string[];        // 主题ID列表
    institutions?: string[];  // 机构ID列表
    authors?: string[];      // 作者ID列表
  };
  sort_by?: string;          // 排序：cited_by_count:desc, publication_date:desc 等
  page?: number;              // 分页（默认：1）
}
```

#### 3.1.3 输出格式（优化后）
```json
{
  "meta": {
    "total_count": 15234,
    "page": 1,
    "per_page": 20,
    "query_time_ms": 42
  },
  "papers": [
    {
      "id": "W2741809807",
      "title": "论文标题",
      "authors": ["作者1", "作者2"],
      "year": 2023,
      "venue": "期刊名称",
      "cited_by_count": 45,
      "is_oa": true,
      "doi": "10.1234/example",
      "openalex_url": "https://openalex.org/W2741809807"
    }
  ]
}
```

#### 3.1.4 实现要点
- 使用 `per-page=200` 获取最大页面大小，减少 API 调用
- 使用 `select` 参数只获取必要字段，提升响应速度
- 实现请求缓存，避免重复查询
- 支持批量 DOI/PMID 查询（使用 OR 过滤器）

### 3.2 功能 2：摘要信息（深度模式）

#### 3.2.1 功能描述
获取论文的详细信息，包括完整摘要、作者信息、关键词、主题分类等，适合深度分析。

#### 3.2.2 输入参数
```typescript
{
  work_id: string;           // OpenAlex Work ID 或 DOI/PMID
  include_abstract?: boolean; // 是否包含摘要（默认：true）
  include_authors?: boolean; // 是否包含作者详情（默认：true）
  include_topics?: boolean;  // 是否包含主题分类（默认：true）
  include_references?: boolean; // 是否包含引用关系（默认：false）
  abstract_mode?: "quick" | "deep"; // 摘要模式（默认：deep）
}
```

#### 3.2.3 输出格式（优化后）
```json
{
  "id": "W2741809807",
  "title": "论文标题",
  "abstract": "完整摘要内容...",
  "abstract_summary": {
    "key_points": ["要点1", "要点2", "要点3"],
    "keywords": ["关键词1", "关键词2"],
    "length": 1200
  },
  "authors": [
    {
      "name": "作者姓名",
      "institution": "机构名称",
      "orcid": "0000-0000-0000-0000"
    }
  ],
  "metadata": {
    "publication_date": "2023-01-15",
    "venue": "期刊名称",
    "type": "journal-article",
    "language": "en",
    "cited_by_count": 45,
    "is_oa": true
  },
  "topics": [
    {
      "id": "T12345",
      "name": "主题名称",
      "level": 1
    }
  ],
  "open_access": {
    "is_oa": true,
    "oa_status": "gold",
    "oa_url": "https://example.com/paper.pdf"
  },
  "identifiers": {
    "doi": "10.1234/example",
    "pmid": "12345678",
    "mag": "1234567890"
  }
}
```

#### 3.2.4 实现要点
- 支持通过 DOI、PMID、OpenAlex ID 等多种方式查询
- 实现摘要智能截断（quick: 1500字符，deep: 6000字符）
- 提取关键点和关键词，便于 LLM 理解
- 结构化输出，去除冗余信息

### 3.3 功能 3：全文下载与论文内容缓存（深度专家模式）

#### 3.3.1 功能描述
检测并下载开放获取论文的全文，建立本地缓存，支持基于全文内容的 QA 增强。

#### 3.3.2 输入参数
```typescript
{
  work_id: string;           // OpenAlex Work ID
  auto_download?: boolean;   // 是否自动下载（默认：false）
  force_download?: boolean;  // 是否强制重新下载（默认：false）
  extract_sections?: string[]; // 提取的章节：abstract, introduction, methods, results, discussion
}
```

#### 3.3.3 输出格式
```json
{
  "work_id": "W2741809807",
  "fulltext_status": "available",
  "oa_url": "https://example.com/paper.pdf",
  "cache_status": "cached",
  "cache_path": "./cache/fulltext/W2741809807.pdf",
  "file_size": 2048576,
  "cached_at": "2026-01-25T10:30:00Z",
  "extracted_sections": {
    "abstract": "摘要内容...",
    "introduction": "引言内容...",
    "methods": "方法内容...",
    "results": "结果内容...",
    "discussion": "讨论内容..."
  }
}
```

#### 3.3.4 实现要点
- 检测 OpenAlex 返回的 `open_access.oa_url` 字段
- 支持 PDF 下载和文本提取（使用 pdf-parse 或类似库）
- 实现智能缓存机制，避免重复下载
- 提取论文关键章节，便于 QA 增强
- 支持批量下载（带速率限制）

#### 3.3.5 缓存策略
```
cache/
├── fulltext/
│   ├── W2741809807.pdf          # PDF 文件
│   ├── W2741809807.txt           # 提取的文本
│   ├── W2741809807_sections.json # 章节提取结果
│   └── index.json                # 缓存索引
└── papers/
    └── W2741809807.json          # 论文元数据缓存
```

### 3.4 功能 4：返回请求头 JSON 格式的线性优化

#### 3.4.1 功能描述
优化返回的 JSON 格式，去除冗余信息，只保留对 LLM 有用的论文内容，提升上下文利用效率。

#### 3.4.2 优化策略

**原始 OpenAlex 响应示例：**
```json
{
  "id": "https://openalex.org/W2741809807",
  "doi": "https://doi.org/10.1234/example",
  "title": "论文标题",
  "display_name": "论文标题",
  "publication_date": "2023-01-15",
  "publication_year": 2023,
  "type": "journal-article",
  "type_crossref": "journal-article",
  "open_access": {
    "is_oa": true,
    "oa_status": "gold",
    "oa_url": "https://example.com/paper.pdf",
    "any_repository_has_fulltext": true
  },
  "authorships": [
    {
      "author": {
        "id": "https://openalex.org/A123456789",
        "display_name": "作者姓名",
        "orcid": "https://orcid.org/0000-0000-0000-0000"
      },
      "institutions": [
        {
          "id": "https://openalex.org/I123456789",
          "display_name": "机构名称",
          "ror": "https://ror.org/123456789",
          "country_code": "US",
          "type": "education"
        }
      ],
      "is_corresponding": true,
      "author_position": "first"
    }
  ],
  "cited_by_count": 45,
  "biblio": {
    "volume": "10",
    "issue": "3",
    "first_page": "123",
    "last_page": "145"
  },
  "is_retracted": false,
  "is_paratext": false,
  "concepts": [
    {
      "id": "https://openalex.org/C123456789",
      "wikidata": "https://www.wikidata.org/entity/Q123456",
      "display_name": "主题名称",
      "level": 1,
      "score": 0.95
    }
  ],
  "mesh": [],
  "locations": [
    {
      "is_oa": true,
      "landing_page_url": "https://example.com/paper",
      "pdf_url": "https://example.com/paper.pdf",
      "source": {
        "id": "https://openalex.org/S123456789",
        "display_name": "期刊名称",
        "issn_l": "1234-5678",
        "issn": ["1234-5678", "5678-1234"],
        "is_oa": true,
        "is_in_doaj": true,
        "host_organization": "出版商名称",
        "host_organization_name": "出版商名称",
        "type": "journal",
        "apc_payment": {
          "value": 0,
          "currency": "USD"
        }
      },
      "license": "cc-by",
      "version": "publishedVersion",
      "is_accepted": true,
      "is_published": true
    }
  ],
  "referenced_works": [
    "https://openalex.org/W123456789",
    "https://openalex.org/W987654321"
  ],
  "related_works": [
    "https://openalex.org/W111111111",
    "https://openalex.org/W222222222"
  ],
  "abstract_inverted_index": {
    "background": [0, 15, 30],
    "methods": [45, 60],
    "results": [75, 90],
    "conclusion": [105, 120]
  }
}
```

**优化后的 JSON 格式：**
```json
{
  "id": "W2741809807",
  "title": "论文标题",
  "abstract": "完整摘要文本（从 abstract_inverted_index 重建）",
  "authors": [
    {
      "name": "作者姓名",
      "institution": "机构名称",
      "orcid": "0000-0000-0000-0000",
      "is_corresponding": true
    }
  ],
  "year": 2023,
  "venue": "期刊名称",
  "cited_by_count": 45,
  "is_oa": true,
  "oa_url": "https://example.com/paper.pdf",
  "doi": "10.1234/example",
  "topics": [
    {
      "id": "C123456789",
      "name": "主题名称",
      "level": 1
    }
  ],
  "references_count": 25,
  "related_works_count": 10
}
```

#### 3.4.3 优化规则
1. **字段精简**：
   - 去除 `display_name`（与 `title` 重复）
   - 去除 `type_crossref`（与 `type` 重复）
   - 去除 `biblio` 详细信息（除非特别需要）
   - 去除 `mesh`（除非特别需要）

2. **结构扁平化**：
   - 将 `authorships` 简化为 `authors` 数组
   - 将 `open_access` 信息扁平化到顶层
   - 将 `locations` 信息提取关键字段

3. **数据转换**：
   - 将 `abstract_inverted_index` 重建为完整文本
   - 将完整的 OpenAlex URL 简化为 ID
   - 将 `referenced_works` 和 `related_works` 简化为计数

4. **智能提取**：
   - 只保留对 LLM 有用的字段
   - 根据模式（quick/deep）决定包含的详细程度

### 3.5 功能 5：多 Agent 协作支持

#### 3.5.1 功能描述
提供便于多 Agent 结构高效开发的功能和接口。

#### 3.5.2 支持的功能
1. **批量查询优化**：
   - 支持批量 DOI/PMID 查询（最多 50 个）
   - 使用 OR 过滤器，减少 API 调用

2. **缓存共享**：
   - 统一的缓存目录结构
   - 支持缓存统计和清理

3. **状态管理**：
   - 提供系统状态查询接口
   - 支持缓存统计和性能监控

4. **错误处理**：
   - 统一的错误格式
   - 支持重试和降级策略

---

## 4. 技术架构

### 4.1 技术选型

| 技术 | 选择 | 理由 |
|------|------|------|
| 语言 | JavaScript (Node.js) | 轻量化，易于部署，与 PubMed MCP 保持一致 |
| MCP SDK | @modelcontextprotocol/sdk | 官方 SDK，稳定可靠 |
| HTTP 客户端 | node-fetch | 轻量，支持代理 |
| PDF 处理 | pdf-parse | 提取 PDF 文本内容 |
| 缓存 | 文件系统 | 简单可靠，无需额外依赖 |
| 配置管理 | dotenv | 环境变量管理 |

### 4.2 项目结构

```
openalex-mcp-server/
├── src/
│   ├── index.js                 # 主服务器入口
│   ├── openalex-client.js      # OpenAlex API 客户端
│   ├── cache-manager.js         # 缓存管理
│   ├── fulltext-downloader.js  # 全文下载器
│   ├── json-optimizer.js        # JSON 格式优化器
│   └── utils.js                 # 工具函数
├── config/
│   └── mcp-config.json          # MCP 配置模板
├── cache/                        # 缓存目录（自动创建）
│   ├── papers/                  # 论文元数据缓存
│   ├── fulltext/                 # 全文缓存
│   └── index.json                # 缓存索引
├── .env.example                  # 环境变量模板
├── package.json                  # 项目配置
├── README.md                     # 项目文档
├── PRD.md                        # 本文档
└── LICENSE                       # 许可证
```

### 4.3 核心模块设计

#### 4.3.1 OpenAlexClient
负责与 OpenAlex API 交互：
- API 请求封装
- 速率限制管理（100 req/s）
- 错误重试机制（指数退避）
- 请求缓存

#### 4.3.2 CacheManager
负责缓存管理：
- 论文元数据缓存
- 全文文件缓存
- 缓存索引维护
- 缓存清理策略

#### 4.3.3 FulltextDownloader
负责全文下载：
- OA 论文检测
- PDF 下载
- 文本提取
- 章节分割

#### 4.3.4 JsonOptimizer
负责 JSON 格式优化：
- 字段精简
- 结构扁平化
- 数据转换
- 智能提取

---

## 5. API 设计

### 5.1 MCP Tools 列表

#### Tool 1: `openalex_search`
快速文章检索

**参数：**
```json
{
  "query": "CRISPR gene editing",
  "max_results": 20,
  "filters": {
    "publication_year": ">2020",
    "is_oa": true
  },
  "sort_by": "cited_by_count:desc"
}
```

#### Tool 2: `openalex_get_work`
获取论文详细信息

**参数：**
```json
{
  "work_id": "W2741809807",
  "include_abstract": true,
  "include_authors": true,
  "abstract_mode": "deep"
}
```

#### Tool 3: `openalex_batch_get_works`
批量获取论文信息

**参数：**
```json
{
  "work_ids": ["W2741809807", "W1234567890"],
  "include_abstract": true
}
```

#### Tool 4: `openalex_detect_fulltext`
检测全文可用性

**参数：**
```json
{
  "work_id": "W2741809807"
}
```

#### Tool 5: `openalex_download_fulltext`
下载全文

**参数：**
```json
{
  "work_id": "W2741809807",
  "force_download": false
}
```

#### Tool 6: `openalex_get_fulltext_sections`
获取全文章节

**参数：**
```json
{
  "work_id": "W2741809807",
  "sections": ["abstract", "methods", "results"]
}
```

#### Tool 7: `openalex_cache_stats`
缓存统计

**参数：**
```json
{
  "action": "stats"
}
```

#### Tool 8: `openalex_system_check`
系统检查

**参数：**
```json
{}
```

### 5.2 与 PubMed MCP 的配合

#### 5.2.1 互补策略
- **OpenAlex**：快速检索、OA 论文下载、丰富的元数据
- **PubMed**：生物医学专业数据、MeSH 主题词、更详细的摘要

#### 5.2.2 使用场景
1. **快速检索**：优先使用 OpenAlex（速度快）
2. **深度分析**：结合 PubMed（更详细的生物医学信息）
3. **全文获取**：优先使用 OpenAlex（直接下载 OA 论文）
4. **数据验证**：交叉验证两个数据源的结果

---

## 6. 数据模型

### 6.1 Work（论文）数据结构

```typescript
interface Work {
  // 基本信息
  id: string;                    // OpenAlex ID（简化版）
  title: string;
  abstract?: string;
  publication_date: string;
  publication_year: number;
  
  // 作者信息
  authors: Author[];
  
  // 发表信息
  venue: string;
  type: string;
  language: string;
  
  // 引用信息
  cited_by_count: number;
  
  // 开放获取
  is_oa: boolean;
  oa_url?: string;
  oa_status?: string;
  
  // 标识符
  doi?: string;
  pmid?: string;
  
  // 主题分类
  topics: Topic[];
  
  // 引用关系（简化）
  references_count?: number;
  related_works_count?: number;
}
```

### 6.2 缓存数据结构

```typescript
interface CacheIndex {
  version: string;
  created: string;
  papers: {
    [workId: string]: {
      cached_at: string;
      expires_at: string;
      file_path: string;
    }
  };
  stats: {
    totalPapers: number;
    totalSize: number;
    lastCleanup: string;
  };
}
```

---

## 7. 性能优化

### 7.1 API 调用优化
1. **使用最大页面大小**：`per-page=200`
2. **批量查询**：使用 OR 过滤器（最多 50 个 ID）
3. **字段选择**：使用 `select` 参数只获取必要字段
4. **请求缓存**：避免重复查询

### 7.2 速率限制管理
- **限制**：100 请求/秒，100,000 credits/天
- **策略**：实现全局速率限制器
- **监控**：跟踪每日 credit 使用量

### 7.3 缓存策略
1. **内存缓存**：** 最近查询的结果
2. **文件缓存**：论文元数据和全文
3. **缓存过期**：元数据 30 天，全文 90 天
4. **缓存清理**：定期清理过期缓存

### 7.4 错误处理
- **指数退避**：1s, 2s, 4s, 8s, 16s
- **最大重试**：5 次
- **降级策略**：API 失败时返回缓存数据

---

## 8. 部署方案

### 8.1 本地部署
```bash
npm install
cp .env.example .env
# 编辑 .env 文件
npm start
```

### 8.2 NPX 部署（魔塔社区）

#### 8.2.1 发布到 NPM
```json
{
  "name": "@your-org/openalex-mcp-server",
  "version": "1.0.0",
  "bin": {
    "openalex-mcp": "./src/index.js"
  },
  "files": [
    "src/",
    "package.json",
    "README.md"
  ]
}
```

#### 8.2.2 使用方式
```bash
# 全局安装
npm install -g @your-org/openalex-mcp-server

# 或直接使用 npx
npx @your-org/openalex-mcp-server
```

#### 8.2.3 MCP 客户端配置
```json
{
  "mcpServers": {
    "openalex-mcp": {
      "command": "npx",
      "args": ["@your-org/openalex-mcp-server"],
      "env": {
        "OPENALEX_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 8.3 环境变量配置

```env
# OpenAlex API 配置
OPENALEX_API_KEY=your-api-key  # 可选，但推荐（提升 credit 限制）

# 功能配置
ABSTRACT_MODE=deep             # quick | deep
FULLTEXT_MODE=enabled          # disabled | enabled | auto
CACHE_ENABLED=true             # 是否启用缓存

# 代理配置（可选）
PROXY_ENABLED=false
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=https://proxy.example.com:8080

# 缓存配置
CACHE_DIR=./cache
CACHE_EXPIRY_DAYS=30
FULLTEXT_CACHE_EXPIRY_DAYS=90
```

---

## 9. 开发计划

### 9.1 开发阶段

#### Phase 1: 核心功能（Week 1-2）
- [ ] 项目初始化
- [ ] OpenAlex API 客户端实现
- [ ] 基础工具实现（search, get_work）
- [ ] JSON 格式优化器
- [ ] 基础缓存功能

#### Phase 2: 全文功能（Week 3）
- [ ] 全文检测功能
- [ ] PDF 下载功能
- [ ] 文本提取功能
- [ ] 章节分割功能
- [ ] 全文缓存管理

#### Phase 3: 优化与测试（Week 4）
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 单元测试
- [ ] 文档编写
- [ ] 部署准备

#### Phase 4: 发布（Week 5）
- [ ] NPM 发布
- [ ] 魔塔社区提交
- [ ] 使用文档
- [ ] 示例代码

### 9.2 里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1: 核心功能完成 | Week 2 | 基础检索和获取功能 |
| M2: 全文功能完成 | Week 3 | 全文下载和缓存功能 |
| M3: 测试完成 | Week 4 | 测试报告和文档 |
| M4: 正式发布 | Week 5 | NPM 包和文档 |

---

## 10. 风险评估

### 10.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| OpenAlex API 变更 | 高 | 低 | 版本锁定，监控 API 变更 |
| PDF 提取失败 | 中 | 中 | 多库支持，降级策略 |
| 速率限制 | 中 | 中 | 实现速率限制器 |
| 缓存损坏 | 低 | 低 | 缓存验证和修复机制 |

### 10.2 业务风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| API Key 限制 | 中 | 低 | 提供免费 Key 获取指南 |
| 数据质量 | 低 | 低 | 数据验证和清洗 |

---

## 11. 成功指标

### 11.1 性能指标
- API 响应时间 < 500ms（快速模式）
- 全文下载成功率 > 90%
- 缓存命中率 > 60%

### 11.2 功能指标
- 支持所有核心功能
- JSON 输出体积减少 > 50%
- 与 PubMed MCP 无缝配合

### 11.3 用户体验指标
- 部署时间 < 5 分钟
- 配置项 < 10 个
- 文档完整性 100%

---

## 12. 附录

### 12.1 参考资源
- [OpenAlex API 文档](https://docs.openalex.org)
- [MCP 协议规范](https://modelcontextprotocol.io)
- [PubMed MCP Server](./mcp-pubmed-server)

### 12.2 相关项目
- mcp-pubmed-server：PubMed MCP 服务器参考实现
- OpenAlex 官方文档：API 使用指南

---

**文档版本**: 1.0  
**最后更新**: 2026-01-25  
**状态**: 待评审
