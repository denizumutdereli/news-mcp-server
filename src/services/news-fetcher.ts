import { tavily } from '@tavily/core';
import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { getConfig } from '../config/env.js';
import { redisService } from './redis.js';
import { NewsArticle } from '../types/index.js';

class NewsFetcherService {
  private config = getConfig();
  private tvly: any;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  
  constructor() {
    this.tvly = tavily({ apiKey: this.config.tavilyApiKey });
  }
  
  // Initialize the news fetcher service
  initialize(): void {
    // Schedule news fetching every 3 hours
    this.cronJob = cron.schedule('0 */3 * * *', async () => {
      console.log('Running scheduled news fetch...');
      await this.fetchLatestNews();
    });
    
    console.log('News fetcher service initialized');
  }
  
  // Fetch the latest DeFi news
  async fetchLatestNews(): Promise<void> {
    if (this.isRunning) {
      console.log('News fetch already in progress, skipping...');
      return;
    }
    
    this.isRunning = true;
    console.log('Fetching latest DeFi news...');
    
    try {
      // Get the last fetch time
      const lastFetchTime = await redisService.getLastFetchTime();
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Store the current time as the last fetch time
      await redisService.storeLastFetchTime(currentTime);
      
      // Define search queries for DeFi news
      const queries = [
        'latest defi news',
        'defi protocol updates',
        'crypto market news',
        'hack news',
        'stablecoin news',
        'bitcoin news',
        'ethereum updates',
        'altcoin news',
        'crypto regulation',
        'defi hacks',
        'rug pull alerts',
        'smart contract vulnerabilities',
        'crypto exchange updates',
        'dex news',
        'total value locked',
        'protocol upgrades',
        'new token launches',
        'market volatility',
        'price analysis',
        'regulatory crackdown',
        'fundraising',
        'exploit reports',
        'governance proposals',
        'best defi platforms',
        'stablecoin depegging',
        'wallet vulnerabilities',
        'bitcoin etf news',
        'eth etf news',
        'donald trump',
        'elon musk',
        'CEX news',
        'hyperliquid'
      ];
      
      // Process each query
      for (const query of queries) {
        await this.processQuery(query);
      }
      
      console.log('Finished fetching latest DeFi news');
    } catch (error) {
      console.error('Error fetching latest DeFi news:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  // Process a search query and store the results
  private async processQuery(query: string): Promise<void> {
    try {
      console.log(`Processing query: ${query}`);
      
      // Search for news using Tavily with time range filter
      const response = await this.tvly.search(query, {
        searchDepth: 'advanced',
        maxResults: 10,
        includeDomains: this.config.targetWebsites,
        includeRawContent: true,
        time_range: 'week',  // Only fetch news from the last week
        topic: 'news'        // Required for time_range to work
      });
      
      // Process and store each result
      for (const result of response.results) {
        // Skip if the article already exists
        if (await redisService.articleExists(result.title)) {
          console.log(`Article already exists: ${result.title}`);
          continue;
        }
        
        // Create a news article object
        const article: NewsArticle = {
          id: randomUUID(),
          title: result.title,
          url: result.url,
          content: result.content,
          summary: result.snippet || result.content.substring(0, 300) + '...',
          publishedDate: result.publishedDate || new Date().toISOString(),
          source: new URL(result.url).hostname,
          score: result.score || 0.5,
          timestamp: Math.floor(Date.now() / 1000)
        };
        
        // Store the article in Redis
        await redisService.storeNewsArticle(article);
        console.log(`Stored article: ${article.title}`);
      }
    } catch (error) {
      console.error(`Error processing query "${query}":`, error);
    }
  }
  
  // Manually trigger a news fetch
  async triggerFetch(): Promise<void> {
    await this.fetchLatestNews();
  }
  
  // Stop the news fetcher service
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('News fetcher service stopped');
    }
  }
}

// Export a singleton instance
export const newsFetcherService = new NewsFetcherService();
