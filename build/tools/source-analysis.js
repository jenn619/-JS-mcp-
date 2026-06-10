import { z } from "zod";
import { browserManager } from "../browser/manager.js";
import { logger } from "../utils/logger.js";
import jsBeautify from "js-beautify";
// 脚本缓存
const scriptsCache = new Map();
const sourceCache = new Map();
export function registerSourceAnalysisTools(server) {
    // js_get_all_scripts - 获取所有脚本列表
    server.tool("js_get_all_scripts", "获取当前页面加载的所有JavaScript脚本列表", {}, async () => {
        try {
            const cdp = browserManager.getCDPSession();
            // 清除旧缓存
            scriptsCache.clear();
            sourceCache.clear();
            // 启用Debugger获取脚本
            const scriptsParsed = [];
            const scriptHandler = (event) => {
                const info = {
                    scriptId: event.scriptId,
                    url: event.url || `inline_${event.scriptId}`,
                    startLine: event.startLine,
                    endLine: event.endLine,
                    length: event.length || 0,
                    sourceMapURL: event.sourceMapURL,
                };
                scriptsCache.set(event.scriptId, info);
                scriptsParsed.push(info);
            };
            cdp.on("Debugger.scriptParsed", scriptHandler);
            await cdp.send("Debugger.enable");
            // 等待脚本加载
            await new Promise((resolve) => setTimeout(resolve, 1000));
            cdp.off("Debugger.scriptParsed", scriptHandler);
            // 过滤掉浏览器扩展等无关脚本
            const relevantScripts = scriptsParsed.filter((s) => {
                const url = s.url.toLowerCase();
                return !url.includes("extension://") &&
                    !url.includes("devtools://") &&
                    !url.startsWith("pptr://");
            });
            const summary = relevantScripts.map((s, i) => {
                const type = s.url.startsWith("inline_") ? "内联" : "外部";
                return `[${i + 1}] ID: ${s.scriptId}\n    类型: ${type}\n    URL: ${s.url}\n    大小: ~${s.length} bytes`;
            });
            return {
                content: [{
                        type: "text",
                        text: `找到 ${relevantScripts.length} 个JS脚本:\n\n${summary.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取脚本失败: ${error.message}` }], isError: true };
        }
    });
    // js_get_script_source - 获取脚本源码
    server.tool("js_get_script_source", "获取指定脚本的完整源码（自动美化格式化）", {
        scriptId: z.string().describe("脚本ID（从js_get_all_scripts获取）"),
        beautify: z.boolean().optional().describe("是否美化代码，默认true"),
        maxLength: z.number().optional().describe("最大返回字符数，默认30000"),
    }, async ({ scriptId, beautify, maxLength }) => {
        try {
            const cdp = browserManager.getCDPSession();
            const result = await cdp.send("Debugger.getScriptSource", { scriptId });
            let source = result.scriptSource;
            // 美化代码
            if (beautify !== false) {
                try {
                    source = jsBeautify.js(source, { indent_size: 2 });
                }
                catch {
                    // 美化失败则使用原始代码
                }
            }
            // 缓存源码
            sourceCache.set(scriptId, source);
            const limit = maxLength || 30000;
            if (source.length > limit) {
                source = source.substring(0, limit) + `\n\n... (已截断，总长度: ${source.length} 字符)`;
            }
            return { content: [{ type: "text", text: source }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取源码失败: ${error.message}` }], isError: true };
        }
    });
    // js_search_in_scripts - 在脚本中搜索关键词
    server.tool("js_search_in_scripts", "在所有JS脚本中搜索关键词/正则表达式，定位加密相关代码", {
        keyword: z.string().describe("搜索关键词或正则表达式，如 'encrypt|password|CryptoJS|JSEncrypt|md5|aes|rsa'"),
        isRegex: z.boolean().optional().describe("是否使用正则表达式，默认true"),
        contextLines: z.number().optional().describe("匹配行前后显示的上下文行数，默认5"),
    }, async ({ keyword, isRegex, contextLines }) => {
        try {
            const cdp = browserManager.getCDPSession();
            const ctx = contextLines ?? 5;
            const results = [];
            // 确保Debugger已启用
            try {
                await cdp.send("Debugger.enable");
            }
            catch { /* already enabled */ }
            // 使用CDP搜索
            const searchResult = await cdp.send("Debugger.searchInContent", {
                scriptId: "", // will iterate
                query: keyword,
                isRegex: isRegex !== false,
                caseSensitive: false,
            }).catch(() => null);
            // 遍历所有缓存的脚本进行搜索
            for (const [scriptId, info] of scriptsCache.entries()) {
                // 获取源码（优先用缓存）
                let source = sourceCache.get(scriptId);
                if (!source) {
                    try {
                        const srcResult = await cdp.send("Debugger.getScriptSource", { scriptId });
                        source = srcResult.scriptSource;
                        sourceCache.set(scriptId, source);
                    }
                    catch {
                        continue;
                    }
                }
                const lines = source.split("\n");
                const regex = isRegex !== false ? new RegExp(keyword, "gi") : null;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const match = regex ? regex.test(line) : line.toLowerCase().includes(keyword.toLowerCase());
                    if (regex)
                        regex.lastIndex = 0; // reset for next test
                    if (match) {
                        const start = Math.max(0, i - ctx);
                        const end = Math.min(lines.length - 1, i + ctx);
                        const context = lines.slice(start, end + 1)
                            .map((l, idx) => {
                            const lineNum = start + idx + 1;
                            const marker = (start + idx === i) ? ">>>" : "   ";
                            return `${marker} ${lineNum}: ${l}`;
                        })
                            .join("\n");
                        results.push(`--- 匹配 [${info.url}] 第${i + 1}行 ---\n${context}`);
                        // 限制单脚本最多10个匹配
                        if (results.length >= 30)
                            break;
                    }
                }
                if (results.length >= 30)
                    break;
            }
            if (results.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `未找到匹配 "${keyword}" 的代码。\n提示: 请先调用js_get_all_scripts加载脚本列表`,
                        }],
                };
            }
            return {
                content: [{
                        type: "text",
                        text: `找到 ${results.length} 处匹配:\n\n${results.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `搜索失败: ${error.message}` }], isError: true };
        }
    });
    // js_get_function_body - 提取函数体
    server.tool("js_get_function_body", "根据函数名提取完整的函数实现代码", {
        functionName: z.string().describe("函数名，如 'encrypt', 'getPassword', 'encryptByAES'"),
        scriptId: z.string().optional().describe("限定在指定脚本中搜索"),
    }, async ({ functionName, scriptId }) => {
        try {
            const cdp = browserManager.getCDPSession();
            const results = [];
            const scriptIds = scriptId ? [scriptId] : Array.from(scriptsCache.keys());
            for (const sid of scriptIds) {
                let source = sourceCache.get(sid);
                if (!source) {
                    try {
                        const srcResult = await cdp.send("Debugger.getScriptSource", { scriptId: sid });
                        source = srcResult.scriptSource;
                        sourceCache.set(sid, source);
                    }
                    catch {
                        continue;
                    }
                }
                // 美化代码以便更好解析
                try {
                    source = jsBeautify.js(source, { indent_size: 2 });
                }
                catch { /* use original */ }
                // 使用多种模式匹配函数定义
                const patterns = [
                    new RegExp(`function\\s+${escapeRegex(functionName)}\\s*\\(`, "g"),
                    new RegExp(`(?:var|let|const)\\s+${escapeRegex(functionName)}\\s*=\\s*function`, "g"),
                    new RegExp(`${escapeRegex(functionName)}\\s*[:=]\\s*function`, "g"),
                    new RegExp(`${escapeRegex(functionName)}\\s*[:=]\\s*\\(`, "g"),
                    new RegExp(`${escapeRegex(functionName)}\\s*\\(.*?\\)\\s*\\{`, "g"),
                ];
                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(source)) !== null) {
                        // 从匹配位置开始提取完整函数体
                        const funcBody = extractFunctionBody(source, match.index);
                        if (funcBody) {
                            const info = scriptsCache.get(sid);
                            results.push(`--- [${info?.url || sid}] ---\n${funcBody}`);
                        }
                    }
                }
            }
            if (results.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `未找到函数: ${functionName}\n提示: 请确认函数名拼写正确，或先使用js_search_in_scripts搜索相关关键词`,
                        }],
                };
            }
            return {
                content: [{
                        type: "text",
                        text: `找到 ${results.length} 处 "${functionName}" 定义:\n\n${results.join("\n\n")}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `提取函数失败: ${error.message}` }], isError: true };
        }
    });
    // js_trace_call_chain - 追踪调用链
    server.tool("js_trace_call_chain", "追踪指定函数的调用链（谁调用了它，它又调用了谁）", {
        functionName: z.string().describe("目标函数名"),
        depth: z.number().optional().describe("追踪深度，默认2"),
    }, async ({ functionName, depth }) => {
        try {
            const maxDepth = depth || 2;
            const callers = [];
            const callees = [];
            // 在所有源码中搜索调用关系
            for (const [scriptId, source] of sourceCache.entries()) {
                const lines = source.split("\n");
                const info = scriptsCache.get(scriptId);
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // 查找谁调用了目标函数
                    if (line.includes(`${functionName}(`) && !line.match(new RegExp(`function\\s+${escapeRegex(functionName)}`))) {
                        callers.push(`${info?.url || scriptId} 第${i + 1}行: ${line.trim()}`);
                    }
                }
                // 获取函数体内的调用
                const funcBody = findFunctionInSource(source, functionName);
                if (funcBody) {
                    const funcCallRegex = /(\w+)\s*\(/g;
                    let match;
                    while ((match = funcCallRegex.exec(funcBody)) !== null) {
                        const callee = match[1];
                        if (callee !== functionName && !["if", "for", "while", "switch", "return", "var", "let", "const", "new", "typeof", "function"].includes(callee)) {
                            if (!callees.includes(callee)) {
                                callees.push(callee);
                            }
                        }
                    }
                }
            }
            const result = [
                `=== ${functionName} 调用链分析 ===\n`,
                `--- 调用者（谁调用了 ${functionName}）---`,
                callers.length > 0 ? callers.slice(0, 10).join("\n") : "  (未找到调用者，可能是事件触发)",
                ``,
                `--- 被调用者（${functionName} 调用了谁）---`,
                callees.length > 0 ? callees.slice(0, 20).join(", ") : "  (未找到内部调用)",
            ];
            return { content: [{ type: "text", text: result.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `追踪失败: ${error.message}` }], isError: true };
        }
    });
    // js_get_encryption_context - 获取加密函数上下文
    server.tool("js_get_encryption_context", "获取加密函数及其所有依赖的完整上下文（函数本身+引用的变量/函数）", {
        functionName: z.string().describe("加密函数名"),
    }, async ({ functionName }) => {
        try {
            const cdp = browserManager.getCDPSession();
            const contextParts = [];
            // 1. 获取函数本身
            for (const [scriptId, source] of sourceCache.entries()) {
                const funcBody = findFunctionInSource(source, functionName);
                if (funcBody) {
                    const info = scriptsCache.get(scriptId);
                    contextParts.push(`=== 函数定义 [${info?.url}] ===\n${funcBody}`);
                    // 2. 查找函数内引用的外部变量（可能是key/iv等）
                    const varRefs = extractVariableReferences(funcBody, source);
                    if (varRefs.length > 0) {
                        contextParts.push(`\n=== 引用的变量/常量 ===\n${varRefs.join("\n")}`);
                    }
                    // 3. 查找函数内调用的其他函数
                    const innerCalls = extractInnerFunctionCalls(funcBody);
                    for (const call of innerCalls.slice(0, 5)) {
                        const innerFunc = findFunctionInSource(source, call);
                        if (innerFunc) {
                            contextParts.push(`\n=== 依赖函数: ${call} ===\n${innerFunc}`);
                        }
                    }
                    break;
                }
            }
            // 4. 尝试从Runtime获取函数实际值
            try {
                const evalResult = await cdp.send("Runtime.evaluate", {
                    expression: `typeof ${functionName} !== 'undefined' ? ${functionName}.toString() : 'undefined'`,
                    returnByValue: true,
                });
                if (evalResult.result.value && evalResult.result.value !== "undefined") {
                    contextParts.push(`\n=== Runtime函数代码 ===\n${evalResult.result.value}`);
                }
            }
            catch { /* ignore */ }
            if (contextParts.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `未找到函数 "${functionName}" 的上下文。请先使用js_get_all_scripts加载脚本。`,
                        }],
                };
            }
            return { content: [{ type: "text", text: contextParts.join("\n\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `获取上下文失败: ${error.message}` }], isError: true };
        }
    });
    logger.info("Source analysis tools registered (6 tools)");
}
// === 辅助函数 ===
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extractFunctionBody(source, startIndex) {
    // 从startIndex开始找到第一个{，然后匹配完整的大括号
    let braceStart = source.indexOf("{", startIndex);
    if (braceStart === -1)
        return null;
    // 获取函数签名
    const signature = source.substring(startIndex, braceStart).trim();
    let depth = 0;
    let i = braceStart;
    for (; i < source.length; i++) {
        if (source[i] === "{")
            depth++;
        else if (source[i] === "}") {
            depth--;
            if (depth === 0)
                break;
        }
    }
    if (depth !== 0)
        return null;
    const body = source.substring(startIndex, i + 1);
    // 限制返回长度
    return body.length > 5000 ? body.substring(0, 5000) + "\n... (函数体已截断)" : body;
}
function findFunctionInSource(source, funcName) {
    const patterns = [
        new RegExp(`function\\s+${escapeRegex(funcName)}\\s*\\(`),
        new RegExp(`(?:var|let|const)\\s+${escapeRegex(funcName)}\\s*=\\s*function`),
        new RegExp(`${escapeRegex(funcName)}\\s*[:=]\\s*function`),
    ];
    for (const pattern of patterns) {
        const match = pattern.exec(source);
        if (match) {
            return extractFunctionBody(source, match.index);
        }
    }
    return null;
}
function extractVariableReferences(funcBody, fullSource) {
    const refs = [];
    // 查找 key, iv, salt, secret 等常见加密变量
    const cryptoVarPatterns = /\b(key|iv|salt|secret|publicKey|privateKey|pubKey|aesKey|desKey|token|nonce)\b/gi;
    const matches = new Set();
    let match;
    while ((match = cryptoVarPatterns.exec(funcBody)) !== null) {
        matches.add(match[1]);
    }
    for (const varName of matches) {
        // 在源码中查找变量定义
        const defPattern = new RegExp(`(?:var|let|const)\\s+${varName}\\s*=\\s*(.+?)(?:;|$)`, "m");
        const defMatch = defPattern.exec(fullSource);
        if (defMatch) {
            refs.push(`${varName} = ${defMatch[1].trim()}`);
        }
    }
    return refs;
}
function extractInnerFunctionCalls(funcBody) {
    const calls = [];
    const callRegex = /(\w+)\s*\(/g;
    let match;
    const skip = new Set(["if", "for", "while", "switch", "return", "var", "let", "const", "new", "typeof", "function", "catch", "console"]);
    while ((match = callRegex.exec(funcBody)) !== null) {
        const name = match[1];
        if (!skip.has(name) && !calls.includes(name)) {
            calls.push(name);
        }
    }
    return calls;
}
//# sourceMappingURL=source-analysis.js.map