import puppeteer, { Browser, Page, CDPSession } from "puppeteer-core";
import { logger } from "../utils/logger.js";

export interface BrowserOptions {
  headless?: boolean;
  chromePath?: string;
  proxy?: string;
  wsEndpoint?: string;
}

/**
 * 浏览器单例管理器
 */
class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cdpSession: CDPSession | null = null;

  async launch(options: BrowserOptions = {}): Promise<string> {
    if (this.browser) {
      return "浏览器已在运行中";
    }

    const chromePath = options.chromePath
      || process.env.CHROME_PATH
      || "C:\\Users\\fangz\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe";

    if (options.wsEndpoint) {
      // 连接已有实例
      this.browser = await puppeteer.connect({
        browserWSEndpoint: options.wsEndpoint,
      });
      logger.info(`Connected to existing browser: ${options.wsEndpoint}`);
    } else {
      const launchArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ];

      if (options.proxy) {
        launchArgs.push(`--proxy-server=${options.proxy}`);
      }

      this.browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: options.headless ?? false,
        args: launchArgs,
        defaultViewport: { width: 1366, height: 768 },
      });
      logger.info(`Browser launched: ${chromePath}, headless=${options.headless ?? false}`);
    }

    // 获取或创建页面
    const pages = await this.browser.pages();
    this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

    // 创建CDP会话
    this.cdpSession = await this.page.createCDPSession();

    return `浏览器已启动 (headless: ${options.headless ?? false})`;
  }

  async close(): Promise<string> {
    if (this.cdpSession) {
      await this.cdpSession.detach().catch(() => {});
      this.cdpSession = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info("Browser closed");
      return "浏览器已关闭";
    }
    return "浏览器未在运行";
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("浏览器未启动，请先调用 browser_launch");
    }
    return this.page;
  }

  getCDPSession(): CDPSession {
    if (!this.cdpSession) {
      throw new Error("浏览器未启动，请先调用 browser_launch");
    }
    return this.cdpSession;
  }

  getBrowser(): Browser {
    if (!this.browser) {
      throw new Error("浏览器未启动，请先调用 browser_launch");
    }
    return this.browser;
  }

  isRunning(): boolean {
    return this.browser !== null;
  }
}

// 全局单例
export const browserManager = new BrowserManager();
