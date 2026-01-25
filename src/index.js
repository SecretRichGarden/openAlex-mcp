/**
 * OpenAlex MCP 服务器入口
 * 提供 MCP 协议接口，用于与 AI Agent 交互
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { OpenAlexClient } from './openalex-client.js';
import { CacheManager } from './cache-manager.js';
import { FulltextDownloader } from './fulltext-downloader.js';
import { optimizeWork, optimizeSearchResults, optimizeBatchResults } from './json-optimizer.js';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从环境变量获取配置
const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY || null;
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'; // 默认启用缓存
const ABSTRACT_MODE = process.env.ABSTRACT_MODE || 'quick';

// 初始化客户端和缓存管理器
const openAlexClient = new OpenAlexClient(OPENALEX_API_KEY || undefined);
const cacheManager = new CacheManager('cache/papers');
const fulltextDownloader = new FulltextDownloader('cache/fulltext');

/**
 * 创建 MCP Server 实例
 */
const server = new Server(
  {
    name: 'openalex-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

/**
 * 注册所有 MCP 工具
 */

// openalex_search - 搜索论文
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'openalex_search',
        description: 'Search for academic papers in OpenAlex database by keywords. Returns simplified paper metadata with title, authors, publication venue, year, citation count, and open access status.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search keywords to find papers by title'
            },
            max_results: {
              type: 'number',
              description: 'Number of results per page (default: 20, max: 200)',
              default: 20
            },
            page: {
              type: 'number',
              description: 'Page number for pagination (default: 1)',
              default: 1
            },
            sort_by: {
              type: 'string',
              description: 'Sort field and order, e.g., "cited_by_count:desc", "publication_year:desc"'
            },
            filters: {
              type: 'object',
              description: 'Filters to apply to search',
              properties: {
                publication_year: {
                  type: 'number',
                  description: 'Filter by publication year'
                },
                is_oa: {
                  type: 'boolean',
                  description: 'Filter by open access status'
                },
                type: {
                  type: 'string',
                  description: 'Filter by document type (e.g., "article", "conference-paper")'
                }
              }
            }
          },
          required: ['query']
        }
      },
      {
        name: 'openalex_get_work',
        description: 'Get detailed information about a specific paper by its OpenAlex ID, DOI, or PMID. Includes full abstract, author information, topics, and references count.',
        inputSchema: {
          type: 'object',
          properties: {
            work_id: {
              type: 'string',
              description: 'Paper identifier (OpenAlex ID like W1234567890, DOI like 10.xxx, or PMID)'
            },
            include_abstract: {
              type: 'boolean',
              description: 'Include abstract in response (default: true)',
              default: true
            },
            abstract_mode: {
              type: 'string',
              description: 'Abstract processing mode: "quick" (cached) or "deep" (fetch new)',
              enum: ['quick', 'deep']
            }
          },
          required: ['work_id']
        }
      },
      {
        name: 'openalex_batch_get_works',
        description: 'Get information for multiple papers in one request. More efficient than calling get_work multiple times.',
        inputSchema: {
          type: 'object',
          properties: {
            work_ids: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of paper IDs (OpenAlex IDs only, max 50)'
            },
            include_abstract: {
              type: 'boolean',
              description: 'Include abstracts in response (default: false for performance)',
              default: false
            }
          },
          required: ['work_ids']
        }
      },
      {
        name: 'openalex_detect_fulltext',
        description: 'Check if full text is available for a paper and get the open access URL if available.',
        inputSchema: {
          type: 'object',
          properties: {
            work_id: {
              type: 'string',
              description: 'Paper identifier (OpenAlex ID, DOI, or PMID)'
            }
          },
          required: ['work_id']
        }
      },
      {
        name: 'openalex_download_fulltext',
        description: 'Download full text PDF for an open access paper. Returns the cached file path on success.',
        inputSchema: {
          type: 'object',
          properties: {
            work_id: {
              type: 'string',
              description: 'Paper identifier (OpenAlex ID, DOI, or PMID)'
            },
            force_download: {
              type: 'boolean',
              description: 'Force re-download even if cached (default: false)',
              default: false
            }
          },
          required: ['work_id']
        }
      },
      {
        name: 'openalex_get_fulltext_sections',
        description: 'Get extracted sections (abstract, introduction, methods, results, discussion, etc.) from a downloaded paper. Will trigger download if not cached.',
        inputSchema: {
          type: 'object',
          properties: {
            work_id: {
              type: 'string',
              description: 'Paper identifier (OpenAlex ID, DOI, or PMID)'
            },
            sections: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion', 'references']
              },
              description: 'Specific sections to retrieve (default: all available sections)'
            }
          },
          required: ['work_id']
        }
      },
      {
        name: 'openalex_cache_stats',
        description: 'Get cache statistics or clear the cache. Shows number of cached papers, total size, and cache directory.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Action: "stats" for statistics or "clear" to clear cache',
              enum: ['stats', 'clear'],
              default: 'stats'
            }
          }
        }
      },
      {
        name: 'openalex_system_check',
        description: 'Check system status and API connectivity. Returns health status, API reachability, cache status, and version info.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

/**
 * 处理工具调用请求
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'openalex_search': {
        const query = String(args?.query || '');
        const max_results = Number(args?.max_results) || 20;
        const page = Number(args?.page) || 1;
        const sort_by = args?.sort_by ? String(args.sort_by) : undefined;
        const filters = args?.filters || {};

        const results = await openAlexClient.search(query, {
          max_results,
          page,
          sort_by,
          filters
        });
        const optimized = optimizeSearchResults(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(optimized, null, 2)
            }
          ]
        };
      }

      case 'openalex_get_work': {
        const work_id = String(args?.work_id || '');
        const include_abstract = Boolean(args?.include_abstract !== false);

        // 检查缓存
        if (CACHE_ENABLED) {
          const cacheKey = `work_${work_id}_${include_abstract}`;
          const cached = await cacheManager.get(cacheKey);
          if (cached) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    ...cached,
                    _cached: true
                  }, null, 2)
                }
              ]
            };
          }
        }

        // 从 API 获取
        const work = await openAlexClient.getWork(work_id, {
          include_abstract,
          include_authors: true,
          include_topics: true
        });
        const optimized = optimizeWork(work);

        // 保存到缓存
        if (CACHE_ENABLED) {
          const cacheKey = `work_${work_id}_${include_abstract}`;
          await cacheManager.set(cacheKey, optimized, 30);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(optimized, null, 2)
            }
          ]
        };
      }

      case 'openalex_batch_get_works': {
        const work_ids = Array.isArray(args?.work_ids) ? args.work_ids : [];
        const include_abstract = Boolean(args?.include_abstract);

        // 从 API 批量获取
        const results = await openAlexClient.batchGetWorks(work_ids, {
          include_abstract,
          include_authors: true
        });
        const optimized = optimizeBatchResults(results);

        // 保存到缓存
        if (CACHE_ENABLED && optimized.papers) {
          for (const paper of optimized.papers) {
            const cacheKey = `work_${paper.id}_${include_abstract}`;
            await cacheManager.set(cacheKey, paper, 30);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(optimized, null, 2)
            }
          ]
        };
      }

      case 'openalex_detect_fulltext': {
        const work_id = String(args?.work_id || '');

        // 先获取论文信息
        const work = await openAlexClient.getWork(work_id, {
          include_abstract: false,
          include_authors: false,
          include_topics: false
        });
        const optimized = optimizeWork(work);

        // 检测全文可用性
        const detection = await fulltextDownloader.detectFulltext(optimized);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(detection, null, 2)
            }
          ]
        };
      }

      case 'openalex_download_fulltext': {
        const work_id = String(args?.work_id || '');
        const force_download = Boolean(args?.force_download);

        // 先获取论文信息
        const work = await openAlexClient.getWork(work_id, {
          include_abstract: false,
          include_authors: false,
          include_topics: false
        });
        const optimized = optimizeWork(work);

        // 检测全文 URL
        const detection = await fulltextDownloader.detectFulltext(optimized);

        if (!detection.fulltext_available || !detection.oa_url) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  work_id,
                  status: 'unavailable',
                  message: 'Full text is not available for this paper'
                }, null, 2)
              }
            ],
            isError: false
          };
        }

        // 下载全文
        const downloadResult = await fulltextDownloader.downloadFulltext(
          work_id,
          String(detection.oa_url || ''),
          force_download
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(downloadResult, null, 2)
            }
          ]
        };
      }

      case 'openalex_get_fulltext_sections': {
        const work_id = String(args?.work_id || '');
        const sections = Array.isArray(args?.sections) ? args.sections : undefined;

        // 先尝试读取已提取的章节
        try {
          const sectionsData = await fulltextDownloader.getSections(work_id, sections);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  work_id,
                  sections: sectionsData
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          // 章节不存在，需要先下载和提取
          const work = await openAlexClient.getWork(work_id, {
            include_abstract: false,
            include_authors: false,
            include_topics: false
          });
          const optimized = optimizeWork(work);

          const detection = await fulltextDownloader.detectFulltext(optimized);

          if (!detection.fulltext_available || !detection.oa_url) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    work_id,
                    status: 'unavailable',
                    message: 'Full text is not available for this paper'
                  }, null, 2)
                }
              ],
              isError: false
            };
          }

          // 下载并提取
          await fulltextDownloader.downloadFulltext(work_id, String(detection.oa_url || ''), false);
          const extractResult = await fulltextDownloader.extractAndSaveSections(work_id);

          if (extractResult.status === 'failed') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(extractResult, null, 2)
                }
              ],
              isError: true
            };
          }

          const sectionsData = await fulltextDownloader.getSections(work_id, sections);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  work_id,
                  sections: sectionsData
                }, null, 2)
              }
            ]
          };
        }
      }

      case 'openalex_cache_stats': {
        const action = args?.action || 'stats';

        if (action === 'clear') {
          // 清空缓存
          const stats = await cacheManager.getStats();
          // 注意：当前 CacheManager 没有实现 clearAll 方法，这里只返回统计信息
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  message: 'Cache clear requested (not implemented yet)',
                  current_stats: stats
                }, null, 2)
              }
            ]
          };
        } else {
          // 获取统计信息
          const stats = await cacheManager.getStats();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  papers_cached: stats.totalFiles,
                  total_size_bytes: stats.totalSize,
                  total_size_mb: (stats.totalSize / (1024 * 1024)).toFixed(2),
                  oldest_cache: stats.oldestCache,
                  newest_cache: stats.newestCache,
                  cache_dir: path.resolve(__dirname, '..', 'cache', 'papers'),
                  cache_enabled: CACHE_ENABLED
                }, null, 2)
              }
            ]
          };
        }
      }

      case 'openalex_system_check': {
        // 测试 API 连接
        let api_reachable = false;
        let api_error = null;

        try {
          // 发送简单的测试请求
          await openAlexClient.search('test', { max_results: 1 });
          api_reachable = true;
        } catch (error) {
          api_error = error instanceof Error ? error.message : String(error);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: api_reachable ? 'healthy' : 'degraded',
                api_reachable,
                api_error: api_error,
                cache_enabled: CACHE_ENABLED,
                api_key_configured: !!OPENALEX_API_KEY,
                version: '1.0.0',
                abstract_mode: ABSTRACT_MODE
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

/**
 * 启动 MCP 服务器
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 错误处理
  server.onerror = (error) => {
    console.error('[MCP Server Error]:', error);
  };

  // 优雅关闭
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

// 启动服务器
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
