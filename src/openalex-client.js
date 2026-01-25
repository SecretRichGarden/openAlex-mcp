/**
 * OpenAlex API 客户端模块
 * 提供与 OpenAlex API 交互的基础功能
 */

import fetch from 'node-fetch';
import { sleep } from './utils.js';

/**
 * OpenAlex API 客户端类
 * 用于与 OpenAlex API 进行交互，支持可选的 API 密钥认证
 */
export class OpenAlexClient {
  /**
   * 创建 OpenAlex API 客户端实例
   * @param {string} [apiKey] - 可选的 OpenAlex API 密钥
   */
  constructor(apiKey) {
    this.baseUrl = 'https://api.openalex.org';
    this.apiKey = apiKey;
    this.userAgent = 'openalex-mcp-server/1.0.0 (mailto:your-email@example.com)';

    // 速率限制：最多 10 请求/秒
    this.rateLimitDelay = 100;
    this.lastRequestTime = 0;
  }

  /**
   * 发送 GET 请求到 OpenAlex API
   * @private
   * @param {string} endpoint - API 端点路径（相对于 baseUrl）
   * @param {Object.<string, any>} [params={}] - 查询参数对象
   * @returns {Promise<any>} API 响应的 JSON 数据
   * @throws {Error} 当 HTTP 请求失败时抛出错误
   * @example
   * const data = await client._request('/works/W123456789');
   * const results = await client._request('/works', { filter: 'title.search:quantum' });
   */
  async _request(endpoint, params = {}) {
    // 速率限制：确保不超过 10 请求/秒
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await sleep(this.rateLimitDelay - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();

    // 指数退避重试
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 4000, 8000, 16000];
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this._executeRequest(endpoint, params);
      } catch (error) {
        lastError = error;

        // 检查是否需要重试
        if (error instanceof Error) {
          const statusCode = this._extractStatusCode(error.message);

          // 429 (Rate Limit)、500、502、503、504 可以重试
          if (statusCode && (statusCode === 429 || statusCode >= 500)) {
            if (attempt < maxRetries - 1) {
              const delay = retryDelays[attempt];
              console.error(`OpenAlex API 请求失败 (尝试 ${attempt + 1}/${maxRetries}): ${error.message}. ${delay}ms 后重试...`);
              await sleep(delay);
              continue;
            }
          }
        }

        // 不需要重试的错误直接抛出
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * 执行单次 HTTP 请求
   * @private
   * @param {string} endpoint - API 端点路径
   * @param {Object.<string, any>} params - 查询参数对象
   * @returns {Promise<any>} API 响应的 JSON 数据
   */
  async _executeRequest(endpoint, params = {}) {
    // 构建 URL
    const url = new URL(endpoint, this.baseUrl);

    // 添加查询参数
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    // 如果提供了 API 密钥，添加到查询参数
    if (this.apiKey) {
      url.searchParams.append('api_key', this.apiKey);
    }

    // 设置请求头
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json'
    };

    try {
      // 发送 GET 请求
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers
      });

      // 检查 HTTP 状态码
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAlex API 请求失败: HTTP ${response.status} ${response.statusText}. ` +
          `详情: ${errorText}`
        );
      }

      // 解析并返回 JSON 响应
      const data = await response.json();
      return data;

    } catch (error) {
      // 如果是网络错误或其他异常，包装并重新抛出
      if (error instanceof Error && error.message.includes('OpenAlex API 请求失败')) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAlex API 网络请求错误: ${errorMessage}`);
    }
  }

  /**
   * 从错误消息中提取 HTTP 状态码
   * @private
   * @param {string} errorMessage - 错误消息
   * @returns {number|null} HTTP 状态码
   */
  _extractStatusCode(errorMessage) {
    const match = errorMessage.match(/HTTP (\d{3})/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * 搜索论文
   * @param {string} query - 搜索关键词（必需）
   * @param {Object} [options={}] - 可选参数
   * @param {number} [options.max_results=20] - 每页结果数（最大200）
   * @param {number} [options.page=1] - 页码
   * @param {string} [options.sort_by] - 排序字段，例如 'cited_by_count:desc'
   * @param {Object} [options.filters] - 过滤器对象
   * @param {number} [options.filters.publication_year] - 发表年份
   * @param {boolean} [options.filters.is_oa] - 是否为开放获取
   * @param {string} [options.filters.type] - 文献类型
   * @returns {Promise<Object>} 搜索结果
   * @example
   * const results = await client.search('machine learning', { max_results: 10, sort_by: 'cited_by_count:desc' });
   */
  async search(query, options = {}) {
    const {
      max_results = 20,
      page = 1,
      sort_by,
      filters = {}
    } = options;

    // 构建查询参数
    const params = {};

    // 添加分页参数
    if (max_results > 0 && max_results <= 200) {
      params['per-page'] = max_results;
    }
    if (page > 1) {
      params.page = page;
    }

    // 添加排序
    if (sort_by) {
      params.sort = sort_by;
    }

    // 添加过滤器
    const filterParts = [`title.search:${query}`];
    if (filters.publication_year) {
      filterParts.push(`publication_year:${filters.publication_year}`);
    }
    if (filters.is_oa !== undefined) {
      filterParts.push(`is_oa:${filters.is_oa}`);
    }
    if (filters.type) {
      filterParts.push(`type:${filters.type}`);
    }

    params.filter = filterParts.join(',');

    // 使用 select 参数只获取必要字段
    params.select = 'id,title,authorships,publication_year,primary_location,cited_by_count,open_access,doi,concepts';

    return await this._request('/works', params);
  }

  /**
   * 获取单篇论文详情
   * @param {string} workId - 论文 ID（支持 OpenAlex ID、DOI、PMID）
   * @param {Object} [options={}] - 可选参数
   * @param {boolean} [options.include_abstract=true] - 是否包含摘要
   * @param {boolean} [options.include_authors=true] - 是否包含作者信息
   * @param {boolean} [options.include_topics=true] - 是否包含主题信息
   * @returns {Promise<Object>} 论文详情
   * @example
   * const work = await client.getWork('W3128609807');
   * const work2 = await client.getWork('10.1038/nature12373', { include_abstract: true });
   */
  async getWork(workId, options = {}) {
    const {
      include_abstract = true,
      include_authors = true,
      include_topics = true
    } = options;

    // 构建 select 参数
    const selectParts = ['id', 'title', 'publication_year', 'type', 'cited_by_count', 'doi', 'pmid', 'primary_location', 'open_access', 'best_oa_location', 'referenced_works', 'concepts'];

    if (include_abstract) {
      selectParts.push('abstract_inverted_index');
    }
    if (include_authors) {
      selectParts.push('authorships');
    }
    if (include_topics) {
      selectParts.push('topics');
    }

    const params = {
      select: selectParts.join(',')
    };

    // 判断 ID 类型并构建相应的请求
    let endpoint;
    if (workId.startsWith('10.')) {
      // DOI 格式
      endpoint = `/works/https://doi.org/${workId}`;
    } else if (workId.match(/^\d+$/) && workId.length <= 8) {
      // PMID 格式（纯数字且不超过8位）
      endpoint = `/works/https://pubmed.ncbi.nlm.nih.gov/${workId}`;
    } else {
      // OpenAlex ID 格式（W123 或完整 URL）
      endpoint = `/works/${workId}`;
    }

    return await this._request(endpoint, params);
  }

  /**
   * 批量获取多篇论文信息
   * @param {string[]} workIds - 论文 ID 数组（最多 50 个）
   * @param {Object} [options={}] - 可选参数
   * @param {boolean} [options.include_abstract=false] - 是否包含摘要
   * @param {boolean} [options.include_authors=true] - 是否包含作者信息
   * @returns {Promise<Object>} 批量查询结果
   * @example
   * const results = await client.batchGetWorks(['W3128609807', 'W2741809807']);
   */
  async batchGetWorks(workIds, options = {}) {
    if (!Array.isArray(workIds) || workIds.length === 0) {
      throw new Error('workIds 必须是非空数组');
    }

    if (workIds.length > 50) {
      throw new Error('批量查询最多支持 50 个论文 ID');
    }

    const {
      include_abstract = false,
      include_authors = true
    } = options;

    // 构建 select 参数
    const selectParts = ['id', 'title', 'publication_year', 'type', 'cited_by_count', 'doi', 'pmid', 'primary_location', 'open_access', 'concepts'];

    if (include_abstract) {
      selectParts.push('abstract_inverted_index');
    }
    if (include_authors) {
      selectParts.push('authorships');
    }

    const params = {
      select: selectParts.join(','),
      'per-page': Math.min(workIds.length, 200),
      filter: `openalex:${workIds.join('|')}`
    };

    return await this._request('/works', params);
  }
}
