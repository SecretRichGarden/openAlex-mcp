/**
 * 全文下载器模块
 * 提供论文全文下载、文本提取和章节识别功能
 */

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 全文下载器类
 * 支持检测、下载和提取 OA 论文的全文内容
 */
export class FulltextDownloader {
  /**
   * 创建全文下载器实例
   * @param {string} [cacheDir='cache/fulltext'] - 缓存目录路径（相对于项目根目录）
   */
  constructor(cacheDir = 'cache/fulltext') {
    this.cacheDir = path.resolve(__dirname, '..', cacheDir);
    this._ensureCacheDirExists();
  }

  /**
   * 确保缓存目录存在
   * @private
   * @returns {Promise<void>}
   */
  async _ensureCacheDirExists() {
    try {
      await fs.access(this.cacheDir);
    } catch (error) {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 获取缓存文件路径
   * @private
   * @param {string} workId - 论文 ID
   * @param {string} extension - 文件扩展名
   * @returns {string} 缓存文件路径
   */
  _getCachePath(workId, extension) {
    const safeId = workId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeId}.${extension}`);
  }

  /**
   * 检测论文是否有可用的 OA 全文 URL
   * @param {Object} workData - 论文数据（优化后的格式）
   * @returns {Promise<Object>} 检测结果
   * @example
   * const result = await downloader.detectFulltext(workData);
   * // { work_id, is_oa, oa_status, oa_url, fulltext_available }
   */
  async detectFulltext(workData) {
    if (!workData || !workData.id) {
      throw new Error('无效的论文数据');
    }

    const result = {
      work_id: workData.id,
      is_oa: false,
      oa_status: null,
      oa_url: null,
      fulltext_available: false
    };

    // 检查开放访问信息
    if (workData.open_access) {
      result.is_oa = workData.open_access.is_oa || false;
      result.oa_status = workData.open_access.oa_status || null;
      result.oa_url = workData.open_access.oa_url || null;
    }

    // 检查是否有最佳 PDF URL
    if (workData.best_pdf_url) {
      result.oa_url = workData.best_pdf_url;
      result.fulltext_available = true;
    } else if (result.oa_url) {
      result.fulltext_available = true;
    }

    return result;
  }

  /**
   * 下载论文全文 PDF
   * @param {string} workId - 论文 ID
   * @param {string} oaUrl - OA 全文 URL
   * @param {boolean} [forceDownload=false] - 是否强制重新下载
   * @returns {Promise<Object>} 下载状态
   * @example
   * const result = await downloader.downloadFulltext('W3128609807', 'https://arxiv.org/pdf/2301.xxxxx.pdf');
   * // { work_id, status, cache_path, file_size }
   */
  async downloadFulltext(workId, oaUrl, forceDownload = false) {
    if (!workId || !oaUrl) {
      throw new Error('workId 和 oaUrl 是必需参数');
    }

    const pdfPath = this._getCachePath(workId, 'pdf');

    // 检查是否已缓存
    if (!forceDownload) {
      try {
        await fs.access(pdfPath);
        const stats = await fs.stat(pdfPath);
        return {
          work_id: workId,
          status: 'cached',
          cache_path: pdfPath,
          file_size: stats.size
        };
      } catch (error) {
        // 文件不存在，继续下载
      }
    }

    // 将 PMC 文章页面 URL 转换为 PDF 直链
    const pdfUrl = this._resolvePdfUrl(oaUrl);

    try {
      // 下载 PDF
      const response = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'openalex-mcp-server/1.0.0'
        },
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`下载失败: HTTP ${response.status} ${response.statusText}`);
      }

      // 校验 Content-Type，确保是 PDF
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
        console.warn(`警告: URL 返回的不是 PDF 文件: ${contentType}`);
      }

      // 保存到缓存
      await this._ensureCacheDirExists();
      const buffer = await response.buffer();
      await fs.writeFile(pdfPath, buffer);

      return {
        work_id: workId,
        status: 'downloaded',
        cache_path: pdfPath,
        file_size: buffer.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        work_id: workId,
        status: 'failed',
        cache_path: null,
        file_size: 0,
        error: errorMessage
      };
    }
  }

  /**
   * 将 OA URL 转换为可直接下载 PDF 的 URL
   * @private
   * @param {string} url - 原始 OA URL
   * @returns {string} PDF 直链 URL
   */
  _resolvePdfUrl(url) {
    // PMC 文章页面 → Europe PMC PDF 直链（NCBI PMC 有 reCAPTCHA 反爬，Europe PMC 无此限制）
    const pmcMatch = url.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/(?:PMC)?(\d+)/);
    if (pmcMatch) {
      return `https://europepmc.org/backend/ptpmcrender.fcgi?accid=PMC${pmcMatch[1]}&blobtype=pdf`;
    }
    return url;
  }

  /**
   * 从 PDF 中提取文本内容
   * @param {string} pdfPath - PDF 文件路径
   * @returns {Promise<string>} 提取的文本内容
   * @example
   * const text = await downloader.extractText('/path/to/paper.pdf');
   */
  async extractText(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`PDF 文本提取失败: ${errorMessage}`);
    }
  }

  /**
   * 尝试识别并提取论文章节
   * @param {string} text - 论文全文文本
   * @returns {Object} 提取的章节内容
   * @example
   * const sections = await downloader.extractSections(fullText);
   * // { abstract: '', introduction: '', methods: '', results: '', discussion: '' }
   */
  extractSections(text) {
    const sections = {
      abstract: null,
      introduction: null,
      methods: null,
      results: null,
      discussion: null,
      conclusion: null,
      references: null
    };

    // 常见的章节标题模式（不区分大小写）
    const patterns = {
      abstract: /(?:^|\n)\s*(?:abstract|摘要|resumen)\s*\n/i,
      introduction: /(?:^|\n)\s*(?:introduction|引言|introducción)\s*\n/i,
      methods: /(?:^|\n)\s*(?:materials?\s+and\s+methods?|methodology|methods|方法|material\s+y\s+métodos)\s*\n/i,
      results: /(?:^|\n)\s*(?:results|结果|resultados)\s*\n/i,
      discussion: /(?:^|\n)\s*(?:discussion|讨论|discusión)\s*\n/i,
      conclusion: /(?:^|\n)\s*(?:conclusion[s]?|结论|conclusión)\s*\n/i,
      references: /(?:^|\n)\s*(?:references|bibliography|参考文献|referencias)\s*\n/i
    };

    // 找到所有章节的位置
    const matches = [];
    for (const [section, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        matches.push({
          section,
          index: match.index + match[0].length
        });
      }
    }

    // 按位置排序
    matches.sort((a, b) => a.index - b.index);

    // 提取每个章节的内容
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];

      if (next) {
        sections[current.section] = text.substring(current.index, next.index).trim();
      } else {
        sections[current.section] = text.substring(current.index).trim();
      }
    }

    // 移除空值
    for (const key of Object.keys(sections)) {
      if (!sections[key] || sections[key].length === 0) {
        delete sections[key];
      }
    }

    return sections;
  }

  /**
   * 提取并保存论文章节
   * @param {string} workId - 论文 ID
   * @returns {Promise<Object>} 提取结果
   * @example
   * const result = await downloader.extractAndSaveSections('W3128609807');
   */
  async extractAndSaveSections(workId) {
    const pdfPath = this._getCachePath(workId, 'pdf');
    const textPath = this._getCachePath(workId, 'txt');
    const sectionsPath = this._getCachePath(workId, 'sections.json');

    try {
      // 检查 PDF 是否存在
      await fs.access(pdfPath);

      // 提取文本
      let text;
      try {
        await fs.access(textPath);
        text = await fs.readFile(textPath, 'utf8');
      } catch (error) {
        text = await this.extractText(pdfPath);
        await fs.writeFile(textPath, text, 'utf8');
      }

      // 提取章节
      const sections = this.extractSections(text);
      await fs.writeFile(sectionsPath, JSON.stringify(sections, null, 2), 'utf8');

      return {
        work_id: workId,
        status: 'success',
        text_path: textPath,
        sections_path: sectionsPath,
        sections: Object.keys(sections)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        work_id: workId,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * 获取已提取的章节内容
   * @param {string} workId - 论文 ID
   * @param {string[]} [sections] - 要获取的章节列表（可选，默认返回所有）
   * @returns {Promise<Object>} 章节内容
   * @example
   * const sections = await downloader.getSections('W3128609807', ['abstract', 'introduction']);
   */
  async getSections(workId, sections = null) {
    const sectionsPath = this._getCachePath(workId, 'sections.json');

    try {
      const content = await fs.readFile(sectionsPath, 'utf8');
      const allSections = JSON.parse(content);

      // 如果指定了章节，只返回请求的章节
      if (sections && Array.isArray(sections)) {
        const result = {};
        for (const section of sections) {
          if (allSections[section]) {
            result[section] = allSections[section];
          }
        }
        return result;
      }

      return allSections;

    } catch (error) {
      throw new Error(`无法读取章节文件: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
