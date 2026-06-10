#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerSourceAnalysisTools } from "./tools/source-analysis.js";
import { registerRuntimeTools } from "./tools/runtime.js";
import { registerCryptoDetectTools } from "./tools/crypto-detect.js";
import { registerScriptGenTools } from "./tools/script-gen.js";
import { logger } from "./utils/logger.js";

async function main() {
  const server = createServer();

  // 注册所有工具模块
  registerNavigationTools(server);
  registerNetworkTools(server);
  registerSourceAnalysisTools(server);
  registerRuntimeTools(server);
  registerCryptoDetectTools(server);
  registerScriptGenTools(server);

  // 启动stdio传输
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("JS Reverse MCP Server running on stdio");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
