// Types for DeFi news MCP server

// News article structure
export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  content: string;
  summary: string;
  publishedDate: string;
  source: string;
  score: number;
  timestamp: number; // Unix timestamp for sorting and TTL calculation
}

// Search arguments for targeted website search
export interface TargetedSearchArgs {
  query: string;
  includeDomains?: string[];
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

// Extract content arguments
export interface ExtractContentArgs {
  url: string;
}

// Redis cache keys
export const REDIS_KEYS = {
  NEWS_CACHE_PREFIX: 'defi_news:',
  NEWS_INDEX: 'defi_news:index',
  LAST_FETCH_TIME: 'defi_news:last_fetch',
};

// Tool response format
export interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}
