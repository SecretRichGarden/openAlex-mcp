/**
 * 工具函数模块
 * 提供 OpenAlex MCP 服务器所需的通用工具函数
 */

/**
 * 从 OpenAlex 的 abstract_inverted_index 重建完整摘要文本
 * @param {Object.<string, number[]>} invertedIndex - 倒排索引对象，键为单词，值为位置数组
 * @returns {string} 重建的完整摘要文本
 * @example
 * const invertedIndex = {
 *   "This": [0],
 *   "is": [1],
 *   "a": [2],
 *   "test": [3]
 * };
 * rebuildAbstract(invertedIndex); // "This is a test"
 */
export function rebuildAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') {
    return '';
  }

  // 创建一个数组来存储按位置排列的单词
  const words = [];

  // 遍历倒排索引，将每个单词放到对应的位置
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      words[position] = word;
    }
  }

  // 过滤掉空位置并用空格连接
  return words.filter(word => word !== undefined).join(' ');
}

/**
 * 将 OpenAlex 的完整 URL 简化为 ID
 * @param {string} url - OpenAlex URL，例如 "https://openalex.org/W123456"
 * @returns {string} 简化后的 ID，例如 "W123456"
 * @example
 * simplifyOpenAlexId("https://openalex.org/W123456"); // "W123456"
 * simplifyOpenAlexId("W123456"); // "W123456"
 */
export function simplifyOpenAlexId(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // 如果已经是简化格式，直接返回
  if (!url.includes('/')) {
    return url;
  }

  // 提取 URL 最后一部分作为 ID
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * 异步延迟函数
 * @param {number} ms - 延迟的毫秒数
 * @returns {Promise<void>} 延迟后解决的 Promise
 * @example
 * await sleep(1000); // 延迟 1 秒
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证 OpenAlex Work ID 格式
 * @param {string} id - 要验证的 Work ID
 * @returns {boolean} ID 格式是否有效
 * @example
 * validateWorkId("W123456789"); // true
 * validateWorkId("W123"); // true
 * validateWorkId("A123"); // false
 * validateWorkId("123"); // false
 */
export function validateWorkId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // OpenAlex Work ID 格式：以 'W' 开头，后跟数字
  const workIdPattern = /^W\d+$/;
  return workIdPattern.test(id);
}
