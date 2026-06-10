/**
 * Logger utility - 所有日志必须走stderr，不能用console.log（会破坏MCP stdio协议）
 */
export const logger = {
    info(message, ...args) {
        console.error(`[INFO] ${message}`, ...args);
    },
    warn(message, ...args) {
        console.error(`[WARN] ${message}`, ...args);
    },
    error(message, ...args) {
        console.error(`[ERROR] ${message}`, ...args);
    },
    debug(message, ...args) {
        if (process.env.DEBUG) {
            console.error(`[DEBUG] ${message}`, ...args);
        }
    }
};
//# sourceMappingURL=logger.js.map