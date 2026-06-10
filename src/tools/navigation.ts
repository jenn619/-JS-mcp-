import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { browserManager } from "../browser/manager.js";
import { logger } from "../utils/logger.js";

export function registerNavigationTools(server: McpServer) {
  // browser_launch - 启动浏览器
  server.tool(
    "browser_launch",
    "启动Chrome浏览器实例，支持headless模式和代理设置",
    {
      headless: z.boolean().optional().describe("是否无头模式，默认false（可视化）"),
      chromePath: z.string().optional().describe("Chrome可执行文件路径"),
      proxy: z.string().optional().describe("代理服务器地址，如 http://127.0.0.1:8080"),
      wsEndpoint: z.string().optional().describe("连接已有Chrome实例的WebSocket地址"),
    },
    async ({ headless, chromePath, proxy, wsEndpoint }) => {
      try {
        const result = await browserManager.launch({ headless, chromePath, proxy, wsEndpoint });
        return { content: [{ type: "text", text: result }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `启动失败: ${error.message}` }], isError: true };
      }
    }
  );

  // browser_close - 关闭浏览器
  server.tool(
    "browser_close",
    "关闭浏览器实例，释放资源",
    {},
    async () => {
      try {
        const result = await browserManager.close();
        return { content: [{ type: "text", text: result }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `关闭失败: ${error.message}` }], isError: true };
      }
    }
  );

  // page_navigate - 导航到URL
  server.tool(
    "page_navigate",
    "导航到指定URL，等待页面加载完成",
    {
      url: z.string().describe("目标URL地址"),
      waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
        .optional()
        .describe("等待条件，默认networkidle2"),
    },
    async ({ url, waitUntil }) => {
      try {
        const page = browserManager.getPage();
        await page.goto(url, {
          waitUntil: waitUntil || "networkidle2",
          timeout: 30000,
        });
        const title = await page.title();
        const currentUrl = page.url();
        return {
          content: [{
            type: "text",
            text: `导航成功\nURL: ${currentUrl}\n标题: ${title}`,
          }],
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `导航失败: ${error.message}` }], isError: true };
      }
    }
  );

  // page_screenshot - 页面截图
  server.tool(
    "page_screenshot",
    "截取当前页面截图，返回base64编码图片",
    {
      selector: z.string().optional().describe("指定元素选择器进行截图，不填则截取整个视口"),
      fullPage: z.boolean().optional().describe("是否截取整个页面（包括滚动区域）"),
    },
    async ({ selector, fullPage }) => {
      try {
        const page = browserManager.getPage();
        let screenshotBuffer: Buffer;

        if (selector) {
          const element = await page.$(selector);
          if (!element) {
            return { content: [{ type: "text", text: `未找到元素: ${selector}` }], isError: true };
          }
          screenshotBuffer = await element.screenshot({ encoding: "binary" }) as Buffer;
        } else {
          screenshotBuffer = await page.screenshot({
            fullPage: fullPage ?? false,
            encoding: "binary",
          }) as Buffer;
        }

        const base64 = screenshotBuffer.toString("base64");
        return {
          content: [{
            type: "image",
            data: base64,
            mimeType: "image/png",
          }],
        };
      } catch (error: any) {
        return { content: [{ type: "text", text: `截图失败: ${error.message}` }], isError: true };
      }
    }
  );

  // page_get_content - 获取页面内容
  server.tool(
    "page_get_content",
    "获取页面HTML内容或指定元素的内容",
    {
      selector: z.string().optional().describe("CSS选择器，不填则返回整个页面HTML"),
    },
    async ({ selector }) => {
      try {
        const page = browserManager.getPage();
        let content: string;

        if (selector) {
          content = await page.$eval(selector, (el) => el.outerHTML);
        } else {
          content = await page.content();
        }

        // 限制返回长度
        if (content.length > 50000) {
          content = content.substring(0, 50000) + "\n... (内容已截断，共" + content.length + "字符)";
        }

        return { content: [{ type: "text", text: content }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `获取内容失败: ${error.message}` }], isError: true };
      }
    }
  );

  logger.info("Navigation tools registered (5 tools)");
}
