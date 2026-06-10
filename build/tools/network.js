import { z } from "zod";
import { browserManager } from "../browser/manager.js";
import { requestStore } from "../storage/request-store.js";
import { logger } from "../utils/logger.js";
let interceptEnabled = false;
export function registerNetworkTools(server) {
    // network_enable_intercept - 开启网络拦截
    server.tool("network_enable_intercept", "开启网络请求拦截，捕获所有HTTP请求（特别是登录请求）", {
        urlPatterns: z.array(z.string()).optional().describe("URL过滤模式列表，如['*login*','*auth*']，不填则拦截所有请求"),
    }, async ({ urlPatterns }) => {
        try {
            const cdp = browserManager.getCDPSession();
            // 清除之前的数据
            requestStore.clear();
            // 启用Fetch domain进行请求拦截
            const patterns = urlPatterns
                ? urlPatterns.map((p) => ({ urlPattern: p, requestStage: "Response" }))
                : [{ urlPattern: "*", requestStage: "Response" }];
            await cdp.send("Fetch.enable", { patterns });
            // 监听请求
            cdp.on("Fetch.requestPaused", async (event) => {
                try {
                    let responseBody = null;
                    // 尝试获取响应体
                    if (event.responseStatusCode) {
                        try {
                            const bodyResult = await cdp.send("Fetch.getResponseBody", {
                                requestId: event.requestId,
                            });
                            responseBody = bodyResult.base64Encoded
                                ? Buffer.from(bodyResult.body, "base64").toString("utf-8")
                                : bodyResult.body;
                        }
                        catch {
                            // 部分请求可能没有响应体
                        }
                    }
                    // 存储请求记录
                    requestStore.addRequest({
                        url: event.request.url,
                        method: event.request.method,
                        headers: event.request.headers || {},
                        postData: event.request.postData || null,
                        responseStatus: event.responseStatusCode || null,
                        responseHeaders: parseHeadersArray(event.responseHeaders || []),
                        responseBody,
                    });
                    // 继续请求
                    await cdp.send("Fetch.continueResponse", {
                        requestId: event.requestId,
                    });
                }
                catch (error) {
                    // 尝试继续请求以避免页面卡住
                    try {
                        await cdp.send("Fetch.continueResponse", { requestId: event.requestId });
                    }
                    catch { /* ignore */ }
                }
            });
            interceptEnabled = true;
            return {
                content: [{
                        type: "text",
                        text: `网络拦截已开启\n过滤模式: ${urlPatterns ? urlPatterns.join(", ") : "全部请求"}\n提示: 现在可以在页面上进行登录操作，请求会被自动捕获`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `开启拦截失败: ${error.message}` }], isError: true };
        }
    });
    // network_disable_intercept - 关闭网络拦截
    server.tool("network_disable_intercept", "关闭网络请求拦截", {}, async () => {
        try {
            const cdp = browserManager.getCDPSession();
            await cdp.send("Fetch.disable");
            interceptEnabled = false;
            return { content: [{ type: "text", text: "网络拦截已关闭" }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `关闭失败: ${error.message}` }], isError: true };
        }
    });
    // network_get_requests - 获取已拦截的请求列表
    server.tool("network_get_requests", "获取已拦截的所有请求列表摘要", {
        method: z.string().optional().describe("按HTTP方法过滤，如POST"),
        urlPattern: z.string().optional().describe("按URL正则过滤"),
        loginOnly: z.boolean().optional().describe("仅返回疑似登录请求"),
    }, async ({ method, urlPattern, loginOnly }) => {
        try {
            const records = requestStore.getAll({ method, urlPattern, loginOnly });
            if (records.length === 0) {
                return { content: [{ type: "text", text: "暂无拦截到的请求。请先开启拦截并在页面上进行操作。" }] };
            }
            const summary = records.map((r) => {
                const flags = [];
                if (r.isLoginRequest)
                    flags.push("🔐登录请求");
                if (r.encryptedParams.length > 0)
                    flags.push(`🔒加密参数: ${r.encryptedParams.join(",")}`);
                return `[${r.id}] ${r.method} ${r.url}\n  状态: ${r.responseStatus || "pending"} ${flags.join(" ")}`;
            });
            return {
                content: [{
                        type: "text",
                        text: `已拦截 ${records.length} 个请求:\n\n${summary.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取请求失败: ${error.message}` }], isError: true };
        }
    });
    // network_get_request_detail - 获取请求详情
    server.tool("network_get_request_detail", "获取单个请求的完整详情，包括请求头、请求体、响应", {
        requestId: z.string().describe("请求ID（从network_get_requests获取）"),
    }, async ({ requestId }) => {
        try {
            const record = requestStore.getById(requestId);
            if (!record) {
                return { content: [{ type: "text", text: `未找到请求: ${requestId}` }], isError: true };
            }
            const detail = [
                `=== 请求详情 ===`,
                `ID: ${record.id}`,
                `时间: ${new Date(record.timestamp).toLocaleString()}`,
                `URL: ${record.url}`,
                `方法: ${record.method}`,
                `是否登录请求: ${record.isLoginRequest ? "是" : "否"}`,
                `加密参数: ${record.encryptedParams.length > 0 ? record.encryptedParams.join(", ") : "无"}`,
                ``,
                `--- 请求头 ---`,
                Object.entries(record.headers).map(([k, v]) => `${k}: ${v}`).join("\n"),
                ``,
                `--- 请求体 ---`,
                record.postData || "(无)",
                ``,
                `--- 响应状态 ---`,
                `${record.responseStatus || "未知"}`,
                ``,
                `--- 响应头 ---`,
                Object.entries(record.responseHeaders).map(([k, v]) => `${k}: ${v}`).join("\n"),
                ``,
                `--- 响应体 ---`,
                record.responseBody ? record.responseBody.substring(0, 5000) : "(无)",
            ];
            return { content: [{ type: "text", text: detail.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取详情失败: ${error.message}` }], isError: true };
        }
    });
    // network_find_login_request - 智能定位登录请求
    server.tool("network_find_login_request", "智能定位登录请求，自动识别包含密码/加密参数的POST请求", {
        keywords: z.array(z.string()).optional().describe("额外关键词用于匹配，如['encrypt','cipher']"),
    }, async ({ keywords }) => {
        try {
            let loginRequests = requestStore.findLoginRequests();
            // 额外关键词过滤
            if (keywords && keywords.length > 0 && loginRequests.length === 0) {
                const allRequests = requestStore.getAll({ method: "POST" });
                loginRequests = allRequests.filter((r) => {
                    const content = `${r.url} ${r.postData || ""}`.toLowerCase();
                    return keywords.some((kw) => content.includes(kw.toLowerCase()));
                });
            }
            if (loginRequests.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "未找到登录请求。请确保：\n1. 已开启网络拦截(network_enable_intercept)\n2. 已在页面上执行了登录操作",
                        }],
                };
            }
            const results = loginRequests.map((r) => {
                return [
                    `=== 登录请求 [${r.id}] ===`,
                    `URL: ${r.url}`,
                    `方法: ${r.method}`,
                    `加密参数: ${r.encryptedParams.join(", ") || "无"}`,
                    `请求体: ${r.postData || "(空)"}`,
                    `响应状态: ${r.responseStatus}`,
                ].join("\n");
            });
            return {
                content: [{
                        type: "text",
                        text: `找到 ${loginRequests.length} 个登录请求:\n\n${results.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `查找失败: ${error.message}` }], isError: true };
        }
    });
    // network_compare_requests - 对比请求差异
    server.tool("network_compare_requests", "对比多次请求的参数差异，帮助分析哪些参数是动态加密的", {
        requestIds: z.array(z.string()).describe("要对比的请求ID列表（至少2个）"),
    }, async ({ requestIds }) => {
        try {
            const records = requestIds
                .map((id) => requestStore.getById(id))
                .filter((r) => r !== undefined);
            if (records.length < 2) {
                return { content: [{ type: "text", text: "需要至少2个有效请求进行对比" }], isError: true };
            }
            // 解析所有请求体参数
            const allParams = {};
            for (const record of records) {
                const params = parsePostData(record.postData);
                for (const [key, value] of Object.entries(params)) {
                    if (!allParams[key])
                        allParams[key] = [];
                    allParams[key].push(value);
                }
            }
            // 分析差异
            const analysis = ["=== 参数差异分析 ===\n"];
            for (const [key, values] of Object.entries(allParams)) {
                const unique = new Set(values);
                if (unique.size === 1) {
                    analysis.push(`📌 ${key}: 固定值 = "${values[0].substring(0, 50)}"`);
                }
                else {
                    const allEncrypted = values.every((v) => isLikelyEncrypted(v));
                    const flag = allEncrypted ? "🔒可能加密" : "🔄动态变化";
                    analysis.push(`${flag} ${key}:`);
                    values.forEach((v, i) => analysis.push(`  请求${i + 1}: "${v.substring(0, 80)}"`));
                }
            }
            return { content: [{ type: "text", text: analysis.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `对比失败: ${error.message}` }], isError: true };
        }
    });
    logger.info("Network tools registered (6 tools)");
}
function parseHeadersArray(headers) {
    const result = {};
    if (Array.isArray(headers)) {
        for (const h of headers) {
            result[h.name] = h.value;
        }
    }
    return result;
}
function parsePostData(postData) {
    if (!postData)
        return {};
    try {
        const json = JSON.parse(postData);
        const result = {};
        for (const [k, v] of Object.entries(json)) {
            result[k] = String(v);
        }
        return result;
    }
    catch {
        try {
            const params = new URLSearchParams(postData);
            const result = {};
            for (const [k, v] of params.entries()) {
                result[k] = v;
            }
            return result;
        }
        catch {
            return {};
        }
    }
}
function isLikelyEncrypted(value) {
    if (value.length < 16)
        return false;
    if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length >= 24)
        return true;
    if (/^[0-9a-fA-F]+$/.test(value) && value.length >= 32)
        return true;
    return false;
}
//# sourceMappingURL=network.js.map