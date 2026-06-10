import { z } from "zod";
import { browserManager } from "../browser/manager.js";
import { logger } from "../utils/logger.js";
// Hook日志存储
const hookLogs = [];
export function registerRuntimeTools(server) {
    // runtime_evaluate - 执行JS代码
    server.tool("runtime_evaluate", "在页面上下文中执行JavaScript代码（可用于填写表单、触发登录等）", {
        expression: z.string().describe("要执行的JS代码"),
        awaitPromise: z.boolean().optional().describe("是否等待Promise完成，默认false"),
    }, async ({ expression, awaitPromise }) => {
        try {
            const page = browserManager.getPage();
            const result = await page.evaluate(async (code) => {
                try {
                    const fn = new Function(`return (async () => { ${code} })()`);
                    const res = await fn();
                    return { success: true, value: JSON.stringify(res, null, 2) || "undefined" };
                }
                catch (e) {
                    return { success: false, value: e.message };
                }
            }, expression);
            if (result.success) {
                return { content: [{ type: "text", text: `执行成功:\n${result.value}` }] };
            }
            else {
                return { content: [{ type: "text", text: `执行出错: ${result.value}` }], isError: true };
            }
        }
        catch (error) {
            return { content: [{ type: "text", text: `执行失败: ${error.message}` }], isError: true };
        }
    });
    // runtime_call_function - 调用页面中的函数
    server.tool("runtime_call_function", "调用页面中的指定全局函数，传入参数并获取返回值", {
        functionName: z.string().describe("全局函数名"),
        args: z.array(z.any()).optional().describe("函数参数列表"),
    }, async ({ functionName, args }) => {
        try {
            const page = browserManager.getPage();
            const argsStr = JSON.stringify(args || []);
            const result = await page.evaluate(async (funcName, argsJson) => {
                try {
                    const fn = window[funcName] || eval(funcName);
                    if (typeof fn !== "function") {
                        return { success: false, value: `"${funcName}" 不是一个函数` };
                    }
                    const parsedArgs = JSON.parse(argsJson);
                    const res = await fn(...parsedArgs);
                    return { success: true, value: JSON.stringify(res, null, 2) || "undefined" };
                }
                catch (e) {
                    return { success: false, value: e.message };
                }
            }, functionName, argsStr);
            if (result.success) {
                return { content: [{ type: "text", text: `${functionName}(${argsStr}) 返回:\n${result.value}` }] };
            }
            else {
                return { content: [{ type: "text", text: `调用失败: ${result.value}` }], isError: true };
            }
        }
        catch (error) {
            return { content: [{ type: "text", text: `调用失败: ${error.message}` }], isError: true };
        }
    });
    // runtime_get_global_vars - 获取全局加密相关变量
    server.tool("runtime_get_global_vars", "获取页面全局作用域中与加密相关的变量和对象", {
        pattern: z.string().optional().describe("变量名过滤模式（正则），如'crypto|encrypt|key|CryptoJS'"),
    }, async ({ pattern }) => {
        try {
            const page = browserManager.getPage();
            const searchPattern = pattern || "crypto|encrypt|key|aes|rsa|md5|sha|des|CryptoJS|JSEncrypt|forge|sm2|sm4|Base64";
            const result = await page.evaluate((pat) => {
                const regex = new RegExp(pat, "i");
                const found = [];
                // 检查window上的属性
                const checked = new Set();
                for (const key of Object.getOwnPropertyNames(window)) {
                    if (regex.test(key) && !checked.has(key)) {
                        checked.add(key);
                        try {
                            const val = window[key];
                            const type = typeof val;
                            let preview = "";
                            if (type === "function") {
                                preview = val.toString().substring(0, 100) + "...";
                            }
                            else if (type === "object" && val !== null) {
                                preview = JSON.stringify(Object.keys(val).slice(0, 10));
                            }
                            else if (type === "string") {
                                preview = val.substring(0, 100);
                            }
                            else {
                                preview = String(val).substring(0, 100);
                            }
                            found.push({ name: key, type, preview });
                        }
                        catch {
                            found.push({ name: key, type: "inaccessible", preview: "(无法访问)" });
                        }
                    }
                }
                // 额外检查常见加密库
                const knownLibs = [
                    { name: "CryptoJS", check: "CryptoJS" },
                    { name: "JSEncrypt", check: "JSEncrypt" },
                    { name: "forge", check: "forge" },
                    { name: "sm2", check: "sm2" },
                    { name: "sm4", check: "sm4" },
                    { name: "md5", check: "md5" },
                    { name: "SHA256", check: "SHA256" },
                    { name: "Base64", check: "Base64" },
                ];
                for (const lib of knownLibs) {
                    if (!checked.has(lib.name)) {
                        try {
                            const val = eval(lib.check);
                            if (val) {
                                const type = typeof val;
                                let preview = type === "object" ? JSON.stringify(Object.keys(val).slice(0, 10)) : String(val).substring(0, 100);
                                found.push({ name: lib.name, type, preview });
                            }
                        }
                        catch { /* not found */ }
                    }
                }
                return found;
            }, searchPattern);
            if (result.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `未找到匹配 "${searchPattern}" 的全局变量。\n提示: 加密逻辑可能在闭包/模块作用域中，尝试使用js_search_in_scripts搜索。`,
                        }],
                };
            }
            const output = result.map((r) => `${r.name} (${r.type}): ${r.preview}`);
            return {
                content: [{
                        type: "text",
                        text: `找到 ${result.length} 个相关全局变量:\n\n${output.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取变量失败: ${error.message}` }], isError: true };
        }
    });
    // runtime_hook_function - Hook函数
    server.tool("runtime_hook_function", "Hook指定函数，记录每次调用的参数和返回值（用于捕获加密过程的输入输出）", {
        functionName: z.string().describe("要Hook的函数名（支持链式如 'CryptoJS.AES.encrypt'）"),
    }, async ({ functionName }) => {
        try {
            const page = browserManager.getPage();
            // 在页面中注入Hook
            const success = await page.evaluate((funcName) => {
                try {
                    const parts = funcName.split(".");
                    let obj = window;
                    for (let i = 0; i < parts.length - 1; i++) {
                        obj = obj[parts[i]];
                        if (!obj)
                            return { success: false, error: `对象 ${parts.slice(0, i + 1).join(".")} 不存在` };
                    }
                    const lastPart = parts[parts.length - 1];
                    const original = obj[lastPart];
                    if (typeof original !== "function") {
                        return { success: false, error: `${funcName} 不是一个函数` };
                    }
                    // 创建全局Hook日志
                    if (!window.__hookLogs) {
                        window.__hookLogs = [];
                    }
                    obj[lastPart] = function (...args) {
                        const result = original.apply(this, args);
                        const logEntry = {
                            functionName: funcName,
                            timestamp: Date.now(),
                            args: args.map((a) => {
                                try {
                                    if (typeof a === "object" && a !== null && a.toString) {
                                        return a.toString().substring(0, 200);
                                    }
                                    return JSON.stringify(a)?.substring(0, 200) || String(a);
                                }
                                catch {
                                    return "[无法序列化]";
                                }
                            }),
                            returnValue: (() => {
                                try {
                                    if (typeof result === "object" && result !== null && result.toString) {
                                        return result.toString().substring(0, 200);
                                    }
                                    return JSON.stringify(result)?.substring(0, 200) || String(result);
                                }
                                catch {
                                    return "[无法序列化]";
                                }
                            })(),
                        };
                        window.__hookLogs.push(logEntry);
                        return result;
                    };
                    return { success: true, error: null };
                }
                catch (e) {
                    return { success: false, error: e.message };
                }
            }, functionName);
            if (success.success) {
                return {
                    content: [{
                            type: "text",
                            text: `已成功Hook函数: ${functionName}\n现在请触发登录操作，然后使用 runtime_get_hook_logs 查看捕获的调用记录。`,
                        }],
                };
            }
            else {
                return { content: [{ type: "text", text: `Hook失败: ${success.error}` }], isError: true };
            }
        }
        catch (error) {
            return { content: [{ type: "text", text: `Hook失败: ${error.message}` }], isError: true };
        }
    });
    // runtime_get_hook_logs - 获取Hook日志
    server.tool("runtime_get_hook_logs", "获取已Hook函数的调用记录（包含参数和返回值）", {
        functionName: z.string().optional().describe("过滤指定函数名的日志，不填返回全部"),
        clear: z.boolean().optional().describe("获取后是否清除日志，默认false"),
    }, async ({ functionName, clear }) => {
        try {
            const page = browserManager.getPage();
            const logs = await page.evaluate((filterName, shouldClear) => {
                const allLogs = window.__hookLogs || [];
                let filtered = filterName
                    ? allLogs.filter((l) => l.functionName === filterName)
                    : allLogs;
                if (shouldClear) {
                    window.__hookLogs = [];
                }
                return filtered.slice(-50); // 返回最近50条
            }, functionName, clear ?? false);
            if (logs.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `暂无Hook日志。${functionName ? `函数 "${functionName}" 尚未被调用。` : ""}\n提示: 请先Hook函数，然后在页面上触发相关操作。`,
                        }],
                };
            }
            const output = logs.map((log, i) => {
                return [
                    `[${i + 1}] ${log.functionName} @ ${new Date(log.timestamp).toLocaleTimeString()}`,
                    `  参数: ${JSON.stringify(log.args)}`,
                    `  返回: ${log.returnValue}`,
                ].join("\n");
            });
            return {
                content: [{
                        type: "text",
                        text: `Hook日志 (${logs.length} 条):\n\n${output.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取日志失败: ${error.message}` }], isError: true };
        }
    });
    logger.info("Runtime tools registered (5 tools)");
}
//# sourceMappingURL=runtime.js.map