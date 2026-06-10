import { Browser, Page, CDPSession } from "puppeteer-core";
export interface BrowserOptions {
    headless?: boolean;
    chromePath?: string;
    proxy?: string;
    wsEndpoint?: string;
}
/**
 * 浏览器单例管理器
 */
declare class BrowserManager {
    private browser;
    private page;
    private cdpSession;
    launch(options?: BrowserOptions): Promise<string>;
    close(): Promise<string>;
    getPage(): Page;
    getCDPSession(): CDPSession;
    getBrowser(): Browser;
    isRunning(): boolean;
}
export declare const browserManager: BrowserManager;
export {};
