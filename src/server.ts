import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "js-reverse-mcp",
    version: "1.0.0",
  });

  logger.info("MCP Server created: js-reverse-mcp v1.0.0");
  return server;
}
