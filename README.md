# DeFi News MCP Server

A Model Context Protocol (MCP) server that provides tools for searching and retrieving DeFi news from targeted websites. The server periodically fetches and caches news from reputable DeFi news sources and provides tools for searching and retrieving this information.

## Features

- Periodically fetches and caches DeFi news from targeted websites
- Provides tools for searching DeFi news with fallback to live search
- Offers full content extraction for referenced web links
- Caches news articles in Redis with a configurable TTL (default: 7 days)
- Avoids redundant content through deduplication
- Implements the Model Context Protocol for integration with LLM applications

## Tools

### 1. search_with_fallback_targetted_websites

Search for information from targeted DeFi news websites with fallback to general search when needed.

**Parameters:**
- `query` (string, required): The search query for DeFi-related information
- `max_results` (number, optional, default: 5): Maximum number of results to return (1-20)
- `search_depth` (string, optional, default: "basic"): The depth of the search ("basic" or "advanced")

**Example:**
```json
{
  "query": "latest ethereum updates",
  "max_results": 10,
  "search_depth": "advanced"
}
```

### 2. get_full_content

Get the full content of a web page from a URL.

**Parameters:**
- `url` (string, required): The URL of the web page to extract content from

**Example:**
```json
{
  "url": "https://www.coindesk.com/business/2023/07/16/ethereum-staking-withdrawals-reach-1-million-eth/"
}
```

### 3. get_latest_defi_news

Get the latest DeFi news from the cache.

**Parameters:**
- `limit` (number, optional, default: 10): Maximum number of news articles to return (1-50)

**Example:**
```json
{
  "limit": 20
}
```

## API Endpoints

- `GET /health`: Health check endpoint
- `GET /api/tools`: List available tools
- `POST /api/search`: Search for DeFi news
- `POST /api/extract`: Extract full content from a URL
- `GET /api/news`: Get latest DeFi news
- `POST /api/trigger-fetch`: Manually trigger a news fetch
- `ALL /mcp`: MCP HTTP endpoint

## Configuration

Configuration is done through environment variables:

```
TAVILY_API_KEY=your_tavily_api_key
PORT=4020
HOST=0.0.0.0

# Services
REDIS_HOST=localhost
REDIS_PORT=6379

# Cache settings
NEWS_CACHE_TTL_DAYS=7
```

## Target Websites

The server targets the following DeFi news websites:

- theblock.co
- cointelegraph.com
- crypto.news
- coindesk.com
- thedefiant.io
- blocktelegraph.io
- cryptotimes.io
- 99bitcoins.com
- dlnews.com
- cryptopanic.com
- rekt.news
- blockworks.co
- crypto-fundraising.info

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables (copy from .env.example and modify as needed)

3. Build the project:
   ```
   npm run build
   ```

4. Start the server:
   ```
   npm start
   ```

5. For development:
   ```
   npm run dev
   ```

## Requirements

- Node.js 18+
- Redis server running locally or accessible via network
