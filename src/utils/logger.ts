/**
 * Logger utility - 所有日志必须走stderr，不能用console.log（会破坏MCP stdio协议）
 */

export const logger = {
  info(message: string, ...args: unknown[]) {
    console.error(`[INFO] ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    console.error(`[WARN] ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]) {
    console.error(`[ERROR] ${message}`, ...args);
  },
  debug(message: string, ...args: unknown[]) {
    if (process.env.DEBUG) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  }
};
