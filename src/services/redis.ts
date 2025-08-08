import Redis from 'ioredis';
import { getConfig } from '../config/env.js';
import { NewsArticle, REDIS_KEYS } from '../types/index.js';

class RedisService {
  private client: Redis;
  private config = getConfig();
  
  constructor() {
    this.client = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
    });
    
    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    
    this.client.on('connect', () => {
      console.log('Connected to Redis');
    });
  }
  
  // Store a news article in Redis
  async storeNewsArticle(article: NewsArticle): Promise<void> {
    try {
      const key = `${REDIS_KEYS.NEWS_CACHE_PREFIX}${article.id}`;
      const ttl = this.config.newsCacheTtlDays * 24 * 60 * 60; // Convert days to seconds
      
      // Store the article as JSON
      await this.client.set(key, JSON.stringify(article));
      
      // Set expiration time
      await this.client.expire(key, ttl);
      
      // Add to the index set for quick retrieval
      await this.client.zadd(REDIS_KEYS.NEWS_INDEX, article.timestamp, article.id);
      
      // Trim the index if it gets too large (keep the most recent 1000 articles)
      await this.client.zremrangebyrank(REDIS_KEYS.NEWS_INDEX, 0, -1001);
    } catch (error) {
      console.error('Error storing news article in Redis:', error);
      throw error;
    }
  }
  
  // Get a news article from Redis
  async getNewsArticle(id: string): Promise<NewsArticle | null> {
    try {
      const key = `${REDIS_KEYS.NEWS_CACHE_PREFIX}${id}`;
      const article = await this.client.get(key);
      
      if (!article) {
        return null;
      }
      
      return JSON.parse(article) as NewsArticle;
    } catch (error) {
      console.error('Error getting news article from Redis:', error);
      throw error;
    }
  }
  
  // Get multiple news articles from Redis
  async getNewsArticles(limit: number = 20, offset: number = 0): Promise<NewsArticle[]> {
    try {
      // Get the article IDs from the index, sorted by timestamp (newest first)
      const articleIds = await this.client.zrevrange(REDIS_KEYS.NEWS_INDEX, offset, offset + limit - 1);
      
      if (!articleIds.length) {
        return [];
      }
      
      // Get the articles in parallel
      const articles = await Promise.all(
        articleIds.map(id => this.getNewsArticle(id))
      );
      
      // Filter out any null values (in case an article was deleted)
      return articles.filter(article => article !== null) as NewsArticle[];
    } catch (error) {
      console.error('Error getting news articles from Redis:', error);
      throw error;
    }
  }
  
  // Search for news articles in Redis by keyword
  async searchNewsArticles(query: string, limit: number = 20): Promise<NewsArticle[]> {
    try {
      // Get all article IDs from the index
      const articleIds = await this.client.zrevrange(REDIS_KEYS.NEWS_INDEX, 0, -1);
      
      if (!articleIds.length) {
        return [];
      }
      
      // Get all articles
      const articles = await Promise.all(
        articleIds.map(id => this.getNewsArticle(id))
      );
      
      // Filter out null values and search for the query in title and content
      const filteredArticles = articles
        .filter(article => article !== null)
        .filter(article => {
          const lowerQuery = query.toLowerCase();
          return (
            article!.title.toLowerCase().includes(lowerQuery) ||
            article!.content.toLowerCase().includes(lowerQuery) ||
            article!.summary.toLowerCase().includes(lowerQuery)
          );
        }) as NewsArticle[];
      
      // Return the top results
      return filteredArticles.slice(0, limit);
    } catch (error) {
      console.error('Error searching news articles in Redis:', error);
      throw error;
    }
  }
  
  // Store the last fetch time
  async storeLastFetchTime(timestamp: number): Promise<void> {
    try {
      await this.client.set(REDIS_KEYS.LAST_FETCH_TIME, timestamp.toString());
    } catch (error) {
      console.error('Error storing last fetch time in Redis:', error);
      throw error;
    }
  }
  
  // Get the last fetch time
  async getLastFetchTime(): Promise<number> {
    try {
      const timestamp = await this.client.get(REDIS_KEYS.LAST_FETCH_TIME);
      return timestamp ? parseInt(timestamp, 10) : 0;
    } catch (error) {
      console.error('Error getting last fetch time from Redis:', error);
      throw error;
    }
  }
  
  // Check if an article with the same title already exists
  async articleExists(title: string): Promise<boolean> {
    try {
      // Get all article IDs from the index
      const articleIds = await this.client.zrevrange(REDIS_KEYS.NEWS_INDEX, 0, -1);
      
      if (!articleIds.length) {
        return false;
      }
      
      // Get all articles
      const articles = await Promise.all(
        articleIds.map(id => this.getNewsArticle(id))
      );
      
      // Check if any article has the same title
      return articles
        .filter(article => article !== null)
        .some(article => article!.title.toLowerCase() === title.toLowerCase());
    } catch (error) {
      console.error('Error checking if article exists in Redis:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const redisService = new RedisService();
