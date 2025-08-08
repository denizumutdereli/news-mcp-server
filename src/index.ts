#!/usr/bin/env node
import cors from "@fastify/cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { tavily } from "@tavily/core";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";

import { getConfig } from "./config/env.js";
import { newsFetcherService } from "./services/news-fetcher.js";
import { redisService } from "./services/redis.js";
import { ExtractContentArgs, NewsArticle, TargetedSearchArgs, ToolResponse } from "./types/index.js";

class DefiNewsMCPServer {
    private server: Server;
    private tvly: any;
    private fastify: any;
    private config = getConfig();
    // Map to store transports by session ID
    private transports: Record<string, StreamableHTTPServerTransport> = {};

    constructor() {
        this.server = new Server(
            {
                name: "defi-news-mcp-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {},
                },
            }
        );

        this.tvly = tavily({ apiKey: this.config.tavilyApiKey });

        this.fastify = Fastify({
            logger: {
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
            }
        });

        this.setupToolHandlers();
        this.setupFastifyRoutes();
        
        // Initialize the news fetcher service
        newsFetcherService.initialize();
        
        // Trigger an initial news fetch
        setTimeout(() => {
            newsFetcherService.triggerFetch().catch(error => {
                console.error("Initial news fetch failed:", error);
            });
        }, 5000); // Wait 5 seconds after server start
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "search_with_fallback_targetted_websites",
                        description: "Search for information from targeted DeFi news websites with fallback to general search when needed",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "The search query for DeFi-related information",
                                },
                                max_results: {
                                    type: "number",
                                    description: "Maximum number of results to return",
                                    default: 5,
                                    minimum: 1,
                                    maximum: 20,
                                },
                                search_depth: {
                                    type: "string",
                                    enum: ["basic", "advanced"],
                                    description: "The depth of the search (basic or advanced)",
                                    default: "basic",
                                },
                            },
                            required: ["query"],
                        },
                    } as Tool,
                    {
                        name: "get_full_content",
                        description: "Get the full content of a web page from a URL",
                        inputSchema: {
                            type: "object",
                            properties: {
                                url: {
                                    type: "string",
                                    description: "The URL of the web page to extract content from",
                                },
                            },
                            required: ["url"],
                        },
                    } as Tool,
                    {
                        name: "get_latest_defi_news",
                        description: "Get the latest DeFi news from the cache",
                        inputSchema: {
                            type: "object",
                            properties: {
                                limit: {
                                    type: "number",
                                    description: "Maximum number of news articles to return",
                                    default: 10,
                                    minimum: 1,
                                    maximum: 50,
                                },
                            },
                            required: [],
                        },
                    } as Tool,
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case "search_with_fallback_targetted_websites":
                        return await this.handleTargetedSearch(args as unknown as TargetedSearchArgs);
                    case "get_full_content":
                        return await this.handleGetFullContent(args as unknown as ExtractContentArgs);
                    case "get_latest_defi_news":
                        return await this.handleGetLatestNews(args as unknown as { limit?: number });
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Tool ${name} error:`, errorMessage);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private setupFastifyRoutes() {
        this.fastify.register(cors, {
            origin: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        });

        this.fastify.get('/health', async (request: any, reply: any) => {
            return { 
                status: 'ok', 
                service: 'defi-news-mcp-server',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            };
        });

        this.fastify.get('/api/tools', async (request: any, reply: any) => {
            try {
                return {
                    tools: [
                        {
                            name: "search_with_fallback_targetted_websites",
                            description: "Search for information from targeted DeFi news websites with fallback to general search when needed",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    query: {
                                        type: "string",
                                        description: "The search query for DeFi-related information",
                                    },
                                    max_results: {
                                        type: "number",
                                        description: "Maximum number of results to return",
                                        default: 5,
                                        minimum: 1,
                                        maximum: 20,
                                    },
                                    search_depth: {
                                        type: "string",
                                        enum: ["basic", "advanced"],
                                        description: "The depth of the search (basic or advanced)",
                                        default: "basic",
                                    },
                                },
                                required: ["query"],
                            },
                        },
                        {
                            name: "get_full_content",
                            description: "Get the full content of a web page from a URL",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    url: {
                                        type: "string",
                                        description: "The URL of the web page to extract content from",
                                    },
                                },
                                required: ["url"],
                            },
                        },
                        {
                            name: "get_latest_defi_news",
                            description: "Get the latest DeFi news from the cache",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    limit: {
                                        type: "number",
                                        description: "Maximum number of news articles to return",
                                        default: 10,
                                        minimum: 1,
                                        maximum: 50,
                                    },
                                },
                                required: [],
                            },
                        },
                    ],
                };
            } catch (error) {
                reply.status(500);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });

        this.fastify.post('/api/search', async (request: any, reply: any) => {
            try {
                const args = request.body as TargetedSearchArgs;
                const result = await this.handleTargetedSearch(args);
                return JSON.parse(result.content[0].text);
            } catch (error) {
                reply.status(400);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });

        this.fastify.post('/api/extract', async (request: any, reply: any) => {
            try {
                const args = request.body as ExtractContentArgs;
                const result = await this.handleGetFullContent(args);
                return JSON.parse(result.content[0].text);
            } catch (error) {
                reply.status(400);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });

        this.fastify.get('/api/news', async (request: any, reply: any) => {
            try {
                const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;
                const result = await this.handleGetLatestNews({ limit });
                return JSON.parse(result.content[0].text);
            } catch (error) {
                reply.status(400);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });

        this.fastify.post('/api/trigger-fetch', async (request: any, reply: any) => {
            try {
                await newsFetcherService.triggerFetch();
                return { success: true, message: 'News fetch triggered successfully' };
            } catch (error) {
                reply.status(500);
                return { error: error instanceof Error ? error.message : String(error) };
            }
        });

        // Unified MCP HTTP endpoint (Streamable HTTP transport)
        this.fastify.all('/mcp', async (request: any, reply: any) => {
            try {
                const sessionIdHeader = request.headers['mcp-session-id'] as string | undefined;
                let transport: StreamableHTTPServerTransport | undefined;

                if (sessionIdHeader && this.transports[sessionIdHeader]) {
                    // Reuse existing transport for this session
                    transport = this.transports[sessionIdHeader];
                } else if (!sessionIdHeader && request.method === 'POST') {
                    // Create a new transport for a new session
                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => randomUUID(),
                        onsessioninitialized: (sid: string) => {
                            this.transports[sid] = transport!;
                            
                            // Clean up transport when closed
                            transport!.onclose = () => {
                                if (sid) {
                                    delete this.transports[sid];
                                    console.log(`Session ${sid} closed and removed`);
                                }
                            };
                        }
                    });
                    
                    // Create a new server instance for this transport
                    const sessionServer = new Server(
                        { name: "defi-news-mcp-server", version: "1.0.0" },
                        { capabilities: { tools: {}, resources: {}, prompts: {} } }
                    );
                    
                    // Set up the same request handlers on this new server instance
                    sessionServer.setRequestHandler(ListToolsRequestSchema, async () => {
                        return {
                            tools: [
                                {
                                    name: "search_with_fallback_targetted_websites",
                                    description: "Search for information from targeted DeFi news websites with fallback to general search when needed",
                                    inputSchema: {
                                        type: "object",
                                        properties: {
                                            query: {
                                                type: "string",
                                                description: "The search query for DeFi-related information",
                                            },
                                            max_results: {
                                                type: "number",
                                                description: "Maximum number of results to return",
                                                default: 5,
                                                minimum: 1,
                                                maximum: 20,
                                            },
                                            search_depth: {
                                                type: "string",
                                                enum: ["basic", "advanced"],
                                                description: "The depth of the search (basic or advanced)",
                                                default: "basic",
                                            },
                                        },
                                        required: ["query"],
                                    },
                                } as Tool,
                                {
                                    name: "get_full_content",
                                    description: "Get the full content of a web page from a URL",
                                    inputSchema: {
                                        type: "object",
                                        properties: {
                                            url: {
                                                type: "string",
                                                description: "The URL of the web page to extract content from",
                                            },
                                        },
                                        required: ["url"],
                                    },
                                } as Tool,
                                {
                                    name: "get_latest_defi_news",
                                    description: "Get the latest DeFi news from the cache",
                                    inputSchema: {
                                        type: "object",
                                        properties: {
                                            limit: {
                                                type: "number",
                                                description: "Maximum number of news articles to return",
                                                default: 10,
                                                minimum: 1,
                                                maximum: 50,
                                            },
                                        },
                                        required: [],
                                    },
                                } as Tool,
                            ],
                        };
                    });

                    sessionServer.setRequestHandler(CallToolRequestSchema, async (request) => {
                        const { name, arguments: args } = request.params;

                        try {
                            switch (name) {
                                case "search_with_fallback_targetted_websites":
                                    return await this.handleTargetedSearch(args as unknown as TargetedSearchArgs);
                                case "get_full_content":
                                    return await this.handleGetFullContent(args as unknown as ExtractContentArgs);
                                case "get_latest_defi_news":
                                    return await this.handleGetLatestNews(args as unknown as { limit?: number });
                                default:
                                    throw new Error(`Unknown tool: ${name}`);
                            }
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            console.error(`Tool ${name} error:`, errorMessage);
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `Error: ${errorMessage}`,
                                    },
                                ],
                                isError: true,
                            };
                        }
                    });

                    // Connect the server to this transport
                    await sessionServer.connect(transport);
                } else if (request.method === 'GET' && !sessionIdHeader) {
                    // If client tries to open an SSE stream BEFORE initialization, politely signal that it's not allowed
                    reply.status(405);
                    reply.send({
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: 'Method Not Allowed: initialize the session with POST first.'
                        },
                        id: null,
                    });
                    return;
                } else {
                    // Invalid request
                    reply.status(400).send({
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: 'Bad Request: No valid session ID provided',
                        },
                        id: null,
                    });
                    return;
                }

                // Hijack the raw response so Fastify doesn't add headers or touch the stream
                reply.hijack();

                // Delegate the current HTTP request to the transport so it can handle GET / POST / SSE semantics
                await transport.handleRequest(request.raw, reply.raw, request.body);
            } catch (error) {
                console.error('MCP HTTP transport error:', error);
                try {
                    reply.raw.writeHead(500, { 'Content-Type': 'application/json' });
                    reply.raw.end(JSON.stringify({ error: 'Failed to handle MCP request' }));
                } catch {}
            }
        });
    }

    private async handleTargetedSearch(args: TargetedSearchArgs) {
        if (!args.query) {
            throw new Error("Query is required");
        }

        console.log(`Handling targeted search: ${args.query}`);

        try {
            // First, try to search in the cached news
            const cachedResults = await redisService.searchNewsArticles(args.query, args.maxResults || 5);
            
            // If we have enough results from the cache, return them
            if (cachedResults.length >= (args.maxResults || 5)) {
                console.log(`Found ${cachedResults.length} results in cache for query: ${args.query}`);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                source: "cache",
                                query: args.query,
                                results: cachedResults.map(article => ({
                                    title: article.title,
                                    url: article.url,
                                    content: article.summary,
                                    publishedDate: article.publishedDate,
                                    source: article.source,
                                }))
                            }, null, 2),
                        },
                    ],
                };
            }
            
            // If we don't have enough results from the cache, fall back to Tavily search
            console.log(`Not enough results in cache, falling back to Tavily search for query: ${args.query}`);
            
            const searchOptions: any = {
                searchDepth: args.searchDepth || "basic",
                maxResults: args.maxResults || 5,
                includeDomains: this.config.targetWebsites,
                includeRawContent: false,
            };

            const response = await this.tvly.search(args.query, searchOptions);
            
            // Process and store the results in the cache for future use
            const articles: NewsArticle[] = [];
            for (const result of response.results) {
                // Skip if the article already exists
                if (await redisService.articleExists(result.title)) {
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
                articles.push(article);
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            source: "tavily",
                            query: args.query,
                            results: response.results.map((result: any) => ({
                                title: result.title,
                                url: result.url,
                                content: result.snippet || result.content.substring(0, 300) + '...',
                                publishedDate: result.publishedDate || new Date().toISOString(),
                                source: new URL(result.url).hostname,
                            }))
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error('Targeted search error:', error);
            throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleGetFullContent(args: ExtractContentArgs) {
        if (!args.url) {
            throw new Error("URL is required");
        }

        console.log(`Handling get full content: ${args.url}`);

        try {
            const response = await this.tvly.extract([args.url]);
            
            if (!response || !response.results || response.results.length === 0) {
                throw new Error("No content found for the provided URL");
            }
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            url: args.url,
                            title: response.results[0].title,
                            content: response.results[0].content,
                            publishedDate: response.results[0].publishedDate,
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error('Get full content error:', error);
            throw new Error(`Content extraction failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleGetLatestNews(args: { limit?: number }) {
        const limit = args.limit || 10;
        
        console.log(`Handling get latest news, limit: ${limit}`);

        try {
            const articles = await redisService.getNewsArticles(limit);
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            count: articles.length,
                            results: articles.map(article => ({
                                title: article.title,
                                url: article.url,
                                content: article.summary,
                                publishedDate: article.publishedDate,
                                source: article.source,
                            }))
                        }, null, 2),
                    },
                ],
            };
        } catch (error) {
            console.error('Get latest news error:', error);
            throw new Error(`Failed to get latest news: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async runStdio() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('DeFi News MCP server running on stdio');
    }

    async runHTTP() {
        // No need to connect a shared transport anymore - we create per-session transports
        const port = this.config.port;
        const host = this.config.host;

        try {
            await this.fastify.listen({ port, host });
            console.log(`🚀 DeFi News MCP server running on http://${host}:${port}`);
            console.log(`📊 Health check: http://${host}:${port}/health`);
            console.log(`🔧 Tools list: http://${host}:${port}/api/tools`);
            console.log(`🔍 Search API: POST http://${host}:${port}/api/search`);
            console.log(`📄 Extract API: POST http://${host}:${port}/api/extract`);
            console.log(`📰 News API: GET http://${host}:${port}/api/news`);
            console.log(`🔄 Trigger Fetch API: POST http://${host}:${port}/api/trigger-fetch`);
            console.log(`🔌 MCP HTTP endpoint: http://${host}:${port}/mcp`);
        } catch (err) {
            this.fastify.log.error(err);
            process.exit(1);
        }
    }

    async run() {
        if (process.argv.includes('--stdio')) {
            await this.runStdio();
        } else {
            await this.runHTTP();
        }
    }
}

const server = new DefiNewsMCPServer();
server.run().catch((error) => {
    console.error("Server failed to start:", error);
    process.exit(1);
});
