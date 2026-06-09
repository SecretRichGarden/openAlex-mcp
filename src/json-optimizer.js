/**
 * JSON 格式优化器模块
 * 将 OpenAlex API 返回的原始数据转换为简洁格式，提升 LLM 上下文利用效率
 */

import { rebuildAbstract, simplifyOpenAlexId } from './utils.js';

/**
 * 优化单篇论文数据
 * 将 OpenAlex 原始响应转换为简化格式
 * @param {Object} rawWork - OpenAlex API 返回的原始论文数据
 * @returns {Object} 优化后的论文数据
 * @example
 * const optimized = optimizeWork(rawApiResponse);
 */
export function optimizeWork(rawWork) {
  if (!rawWork || typeof rawWork !== 'object') {
    return null;
  }

  // 提取和简化基础字段
  const optimized = {
    id: simplifyOpenAlexId(rawWork.id),
    title: rawWork.title || '',
    doi: rawWork.doi || null,
    pmid: rawWork.ids?.pmid || null,
    publication_year: rawWork.publication_year || null,
    type: rawWork.type || null,
    cited_by_count: rawWork.cited_by_count || 0,
    concepts: (rawWork.concepts || []).slice(0, 5).map(c => ({
      id: simplifyOpenAlexId(c.id),
      display_name: c.display_name,
      score: c.score
    }))
  };

  // 提取发表期刊/会议信息
  if (rawWork.primary_location) {
    const source = rawWork.primary_location.source;
    if (source) {
      optimized.venue = {
        id: simplifyOpenAlexId(source.id),
        display_name: source.display_name,
        type: source.type,
        issn: source.issn || null,
        is_oa: source.is_oa || false
      };
    }

    // 提取卷期页码
    if (rawWork.primary_location.volume) {
      optimized.volume = rawWork.primary_location.volume;
    }
    if (rawWork.primary_location.issue) {
      optimized.issue = rawWork.primary_location.issue;
    }
    if (rawWork.primary_location.pages) {
      optimized.pages = rawWork.primary_location.pages;
    }
  }

  // 扁平化作者信息
  if (rawWork.authorships && rawWork.authorships.length > 0) {
    optimized.authors = rawWork.authorships.map(authorship => ({
      id: authorship.author ? simplifyOpenAlexId(authorship.author.id) : null,
      display_name: authorship.author?.display_name || authorship.raw_author_name || '',
      institution: authorship.institutions?.[0]?.display_name || null,
      country: authorship.institutions?.[0]?.country_code || null,
      is_corresponding: authorship.is_corresponding || null
    }));
  }

  // 提取开放访问信息
  if (rawWork.open_access) {
    optimized.open_access = {
      is_oa: rawWork.open_access.is_oa || false,
      oa_status: rawWork.open_access.oa_status || null,
      oa_url: rawWork.open_access.oa_url || null
    };
  }

  // 重建摘要文本
  if (rawWork.abstract_inverted_index) {
    optimized.abstract = rebuildAbstract(rawWork.abstract_inverted_index);
  }

  // 提取主题/领域信息
  if (rawWork.topics && rawWork.topics.length > 0) {
    optimized.topics = rawWork.topics.slice(0, 3).map(topic => ({
      id: simplifyOpenAlexId(topic.id),
      display_name: topic.display_name,
      subfield: topic.subfield?.display_name || null,
      field: topic.field?.display_name || null,
      domain: topic.domain?.display_name || null
    }));
  }

  // 提取参考文献和被引信息
  if (rawWork.referenced_works && rawWork.referenced_works.length > 0) {
    optimized.referenced_works_count = rawWork.referenced_works.length;
  }

  // 提取最佳位置（OA URL）
  if (rawWork.best_oa_location) {
    optimized.best_pdf_url = rawWork.best_oa_location.pdf_url || null;
  }

  return optimized;
}

/**
 * 优化搜索结果列表
 * @param {Object} rawResults - OpenAlex API 返回的原始搜索结果
 * @returns {Object} 优化后的搜索结果
 * @example
 * const optimized = optimizeSearchResults(rawSearchResponse);
 */
export function optimizeSearchResults(rawResults) {
  if (!rawResults || typeof rawResults !== 'object') {
    return {
      meta: {
        total_count: 0,
        page: 1,
        per_page: 20
      },
      papers: []
    };
  }

  // 提取元数据
  const meta = {
    total_count: rawResults.meta?.count || 0,
    page: rawResults.meta?.page || 1,
    per_page: rawResults.meta?.per_page || 20
  };

  // 优化每篇论文
  const papers = (rawResults.results || rawResults.results || []).map(work => optimizeWork(work));

  return {
    meta,
    papers: papers.filter(p => p !== null)
  };
}

/**
 * 优化批量查询结果
 * @param {Object} rawResults - OpenAlex API 返回的批量查询结果
 * @returns {Object} 优化后的批量查询结果
 */
export function optimizeBatchResults(rawResults) {
  return optimizeSearchResults(rawResults);
}
