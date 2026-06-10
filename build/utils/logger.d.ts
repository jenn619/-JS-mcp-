/**
 * Logger utility - 所有日志必须走stderr，不能用console.log（会破坏MCP stdio协议）
 */
export declare const logger: {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
};
