import 'dotenv/config';

export interface Config {
  // Server configuration
  port: number;
  host: string;
  
  // Tavily API configuration
  tavilyApiKey: string;
  
  // Redis configuration
  redisHost: string;
  redisPort: number;
  
  // Cache settings
  newsCacheTtlDays: number;
  
  // Target websites for DeFi news
  targetWebsites: string[];
}

export function getConfig(): Config {
  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (!tavilyApiKey) {
    throw new Error('TAVILY_API_KEY environment variable is required');
  }

  // DeFi news target websites
  const targetWebsites = [
    'https://www.theblock.co',
    'https://www.cointelegraph.com',
    'https://crypto.news',
    'https://www.coindesk.com',
    'https://www.thedefiant.io',
    'https://blocktelegraph.io',
    'https://www.cryptotimes.io',
    'https://www.99bitcoins.com',
    'https://www.dlnews.com',
    'https://cryptopanic.com',
    'https://rekt.news/tr',
    'https://blockworks.co',
    'https://crypto-fundraising.info'
  ];

  return {
    // Server configuration
    port: parseInt(process.env.PORT || '4020', 10),
    host: process.env.HOST || '0.0.0.0',
    
    // Tavily API configuration
    tavilyApiKey,
    
    // Redis configuration
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    
    // Cache settings
    newsCacheTtlDays: parseInt(process.env.NEWS_CACHE_TTL_DAYS || '7', 10),
    
    // Target websites
    targetWebsites
  };
}
