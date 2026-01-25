/**
 * 缓存管理器模块
 * 提供文件系统缓存管理功能，用于缓存论文元数据和全文
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 缓存管理器类
 * 支持论文元数据和全文的缓存管理，避免重复 API 调用
 */
export class CacheManager {
  /**
   * 创建缓存管理器实例
   * @param {string} [cacheDir='cache/papers'] - 缓存目录路径（相对于项目根目录）
   */
  constructor(cacheDir = 'cache/papers') {
    // 从 src 目录回到项目根目录
    this.cacheDir = path.resolve(__dirname, '..', cacheDir);
    this._ensureCacheDirExists();
  }

  /**
   * 确保缓存目录存在，如果不存在则自动创建
   * @private
   * @returns {Promise<void>}
   */
  async _ensureCacheDirExists() {
    try {
      await fs.access(this.cacheDir);
    } catch (error) {
      // 目录不存在，创建它
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成缓存文件路径
   * @private
   * @param {string} key - 缓存键
   * @returns {string} 缓存文件的完整路径
   */
  _getCacheFilePath(key) {
    // 将键转换为安全的文件名（移除特殊字符）
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  /**
   * 检查缓存是否存在且未过期
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 缓存是否有效
   */
  async has(key) {
    try {
      const filePath = this._getCacheFilePath(key);
      await fs.access(filePath);

      // 读取缓存文件检查过期时间
      const content = await fs.readFile(filePath, 'utf8');
      const cache = JSON.parse(content);

      // 检查是否过期
      if (cache.expiresAt && new Date(cache.expiresAt) < new Date()) {
        // 缓存已过期，删除它
        await this.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 从缓存中获取数据
   * @param {string} key - 缓存键
   * @returns {Promise<any|null>} 缓存的数据，如果不存在或已过期则返回 null
   */
  async get(key) {
    try {
      const filePath = this._getCacheFilePath(key);
      const content = await fs.readFile(filePath, 'utf8');
      const cache = JSON.parse(content);

      // 检查是否过期
      if (cache.expiresAt && new Date(cache.expiresAt) < new Date()) {
        // 缓存已过期，删除它并返回 null
        await this.delete(key);
        return null;
      }

      return cache.data;
    } catch (error) {
      // 文件不存在或读取失败
      return null;
    }
  }

  /**
   * 将数据存入缓存
   * @param {string} key - 缓存键
   * @param {any} data - 要缓存的数据
   * @param {number} [expiryDays=30] - 缓存过期天数，默认 30 天
   * @returns {Promise<void>}
   */
  async set(key, data, expiryDays = 30) {
    await this._ensureCacheDirExists();

    const filePath = this._getCacheFilePath(key);

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const cache = {
      key,
      data,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf8');
  }

  /**
   * 删除指定的缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否成功删除
   */
  async delete(key) {
    try {
      const filePath = this._getCacheFilePath(key);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      // 文件不存在或删除失败
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Promise<{totalFiles: number, totalSize: number, oldestCache: string|null, newestCache: string|null}>}
   */
  async getStats() {
    try {
      await this._ensureCacheDirExists();

      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      let totalSize = 0;
      let oldestCache = null;
      let newestCache = null;
      let oldestTime = Infinity;
      let newestTime = 0;

      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        const content = await fs.readFile(filePath, 'utf8');
        try {
          const cache = JSON.parse(content);
          const createdTime = new Date(cache.createdAt).getTime();

          if (createdTime < oldestTime) {
            oldestTime = createdTime;
            oldestCache = cache.createdAt;
          }

          if (createdTime > newestTime) {
            newestTime = createdTime;
            newestCache = cache.createdAt;
          }
        } catch (parseError) {
          // 忽略无效的 JSON 文件
        }
      }

      return {
        totalFiles: jsonFiles.length,
        totalSize,
        oldestCache,
        newestCache
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestCache: null,
        newestCache: null
      };
    }
  }
}
