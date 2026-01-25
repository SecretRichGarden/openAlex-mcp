/**
 * OpenAlex API 客户端模块
 * 提供与 OpenAlex API 交互的基础功能
 */

import fetch from 'node-fetch';

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
}
