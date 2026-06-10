import { z } from "zod";
import { browserManager } from "../browser/manager.js";
import { requestStore } from "../storage/request-store.js";
import { CRYPTO_PATTERNS, identifyCiphertextFormat, inferAlgorithmFromKeyLength } from "../analysis/crypto-patterns.js";
import { logger } from "../utils/logger.js";
// 脚本源码缓存引用（与source-analysis共享）
const sourceCache = new Map();
export function registerCryptoDetectTools(server) {
    // crypto_auto_detect - 自动检测加密算法
    server.tool("crypto_auto_detect", "自动扫描页面所有JS代码，检测使用的加密算法和库（支持AES/DES/RSA/MD5/SHA/SM2/SM4/Base64）", {}, async () => {
        try {
            const cdp = browserManager.getCDPSession();
            const detections = [];
            // 启用Debugger获取脚本
            try {
                await cdp.send("Debugger.enable");
            }
            catch { /* already enabled */ }
            // 收集所有脚本源码
            const scripts = [];
            // 从已有缓存 + 重新获取
            const scriptsParsed = [];
            const handler = (event) => { scriptsParsed.push(event); };
            cdp.on("Debugger.scriptParsed", handler);
            await new Promise((resolve) => setTimeout(resolve, 500));
            cdp.off("Debugger.scriptParsed", handler);
            for (const script of scriptsParsed) {
                if (script.url?.includes("extension://") || script.url?.includes("devtools://"))
                    continue;
                try {
                    const { scriptSource } = await cdp.send("Debugger.getScriptSource", { scriptId: script.scriptId });
                    scripts.push({ id: script.scriptId, url: script.url || `inline_${script.scriptId}`, source: scriptSource });
                    sourceCache.set(script.scriptId, scriptSource);
                }
                catch {
                    continue;
                }
            }
            // 对每个脚本进行模式匹配
            for (const script of scripts) {
                for (const pattern of CRYPTO_PATTERNS) {
                    for (const regex of pattern.patterns) {
                        const match = regex.exec(script.source);
                        if (match) {
                            // 获取匹配行上下文
                            const beforeMatch = script.source.substring(Math.max(0, match.index - 50), match.index);
                            const afterMatch = script.source.substring(match.index, Math.min(script.source.length, match.index + 100));
                            const context = (beforeMatch + afterMatch).trim();
                            detections.push({
                                pattern: pattern.name,
                                algorithm: pattern.algorithm,
                                confidence: pattern.confidence,
                                location: script.url,
                                matchedCode: context.substring(0, 150),
                            });
                            break; // 一个pattern匹配一次即可
                        }
                    }
                }
            }
            // 同时检查Runtime中的全局加密对象
            const page = browserManager.getPage();
            const runtimeCheck = await page.evaluate(() => {
                const found = [];
                if (window.CryptoJS)
                    found.push("CryptoJS (全局对象存在)");
                if (window.JSEncrypt)
                    found.push("JSEncrypt (全局对象存在)");
                if (window.forge)
                    found.push("node-forge (全局对象存在)");
                if (window.sm2)
                    found.push("sm2国密 (全局对象存在)");
                if (window.sm4)
                    found.push("sm4国密 (全局对象存在)");
                if (window.md5)
                    found.push("md5函数 (全局对象存在)");
                if (window.SHA256)
                    found.push("SHA256函数 (全局对象存在)");
                if (window.RSAUtils)
                    found.push("RSAUtils (全局对象存在)");
                return found;
            });
            if (detections.length === 0 && runtimeCheck.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "未检测到明显的加密特征。\n可能原因:\n1. 加密代码使用了混淆/自定义命名\n2. 加密逻辑在动态加载的脚本中\n建议: 使用js_search_in_scripts搜索 'encrypt|password|secret' 等关键词",
                        }],
                };
            }
            // 按置信度排序
            detections.sort((a, b) => b.confidence - a.confidence);
            const output = [
                "=== 加密算法检测结果 ===\n",
                ...detections.map((d, i) => `[${i + 1}] ${d.algorithm} (${d.pattern})\n    置信度: ${(d.confidence * 100).toFixed(0)}%\n    位置: ${d.location}\n    代码: ${d.matchedCode}`),
            ];
            if (runtimeCheck.length > 0) {
                output.push("\n--- Runtime全局对象 ---");
                output.push(...runtimeCheck.map((r) => `  ✓ ${r}`));
            }
            return { content: [{ type: "text", text: output.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `检测失败: ${error.message}` }], isError: true };
        }
    });
    // crypto_analyze_param - 分析参数加密方式
    server.tool("crypto_analyze_param", "分析指定请求参数的加密方式，通过密文格式和长度推断可能的算法", {
        paramName: z.string().describe("参数名（如'password'）"),
        sampleValues: z.array(z.string()).optional().describe("密文样本值列表（多个样本有助于分析）"),
    }, async ({ paramName, sampleValues }) => {
        try {
            // 从拦截的请求中收集样本
            let samples = sampleValues || [];
            if (samples.length === 0) {
                const loginRequests = requestStore.findLoginRequests();
                for (const req of loginRequests) {
                    if (req.postData) {
                        try {
                            const json = JSON.parse(req.postData);
                            if (json[paramName])
                                samples.push(json[paramName]);
                        }
                        catch {
                            const params = new URLSearchParams(req.postData);
                            const val = params.get(paramName);
                            if (val)
                                samples.push(val);
                        }
                    }
                }
            }
            if (samples.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: `未找到参数 "${paramName}" 的样本值。请提供sampleValues或先拦截包含该参数的请求。`,
                        }],
                };
            }
            const analysis = [`=== 参数 "${paramName}" 加密分析 ===\n`];
            analysis.push(`样本数量: ${samples.length}\n`);
            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];
                const format = identifyCiphertextFormat(sample);
                analysis.push(`样本${i + 1}: "${sample.substring(0, 80)}${sample.length > 80 ? "..." : ""}"`);
                analysis.push(`  长度: ${sample.length} 字符`);
                analysis.push(`  格式: ${format.format}`);
                analysis.push(`  可能算法: ${format.possibleAlgorithms.join(", ")}`);
                analysis.push(`  置信度: ${(format.confidence * 100).toFixed(0)}%`);
                analysis.push("");
            }
            // 多样本对比分析
            if (samples.length >= 2) {
                const lengths = samples.map((s) => s.length);
                const uniqueLengths = new Set(lengths);
                analysis.push("--- 多样本对比 ---");
                if (uniqueLengths.size === 1) {
                    analysis.push(`所有样本长度相同 (${lengths[0]})，可能是固定块大小的对称加密（AES/DES）`);
                }
                else {
                    analysis.push(`样本长度不同 (${Array.from(uniqueLengths).join(",")})`);
                    if (lengths.every((l) => l % 4 === 0)) {
                        analysis.push("所有长度为4的倍数，可能是Base64编码的块加密");
                    }
                }
                const allSame = samples.every((s) => s === samples[0]);
                if (allSame) {
                    analysis.push("⚠️ 所有样本值完全相同 - 可能是静态加密（无随机IV/盐）或Hash");
                }
                else {
                    analysis.push("✓ 样本值不同 - 可能使用了随机IV/盐或时间戳参与加密");
                }
            }
            return { content: [{ type: "text", text: analysis.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `分析失败: ${error.message}` }], isError: true };
        }
    });
    // crypto_identify_library - 识别加密库
    server.tool("crypto_identify_library", "识别页面使用的加密库名称和版本", {}, async () => {
        try {
            const page = browserManager.getPage();
            const libs = await page.evaluate(() => {
                const detected = [];
                // CryptoJS
                if (window.CryptoJS) {
                    const cjs = window.CryptoJS;
                    const methods = Object.keys(cjs).filter((k) => typeof cjs[k] === "object" || typeof cjs[k] === "function");
                    detected.push({
                        name: "CryptoJS",
                        version: cjs.lib?.WordArray ? "3.x/4.x" : "unknown",
                        methods: methods.slice(0, 20),
                    });
                }
                // JSEncrypt
                if (window.JSEncrypt) {
                    detected.push({
                        name: "JSEncrypt",
                        version: window.JSEncrypt.version || "unknown",
                        methods: ["encrypt", "decrypt", "setPublicKey", "setPrivateKey"],
                    });
                }
                // node-forge
                if (window.forge) {
                    const f = window.forge;
                    const methods = Object.keys(f).slice(0, 15);
                    detected.push({ name: "node-forge", version: f.version || "unknown", methods });
                }
                // sm-crypto
                if (window.sm2) {
                    detected.push({
                        name: "sm-crypto (SM2)",
                        version: "unknown",
                        methods: Object.keys(window.sm2).slice(0, 10),
                    });
                }
                if (window.sm4) {
                    detected.push({
                        name: "sm-crypto (SM4)",
                        version: "unknown",
                        methods: Object.keys(window.sm4).slice(0, 10),
                    });
                }
                return detected;
            });
            if (libs.length === 0) {
                return {
                    content: [{
                            type: "text",
                            text: "未在全局作用域检测到已知加密库。\n可能原因: 加密库通过模块化方式(import/require)引入，未暴露到window。\n建议: 使用js_search_in_scripts搜索加密库特征代码。",
                        }],
                };
            }
            const output = libs.map((lib) => [
                `📦 ${lib.name} (${lib.version})`,
                `   可用方法: ${lib.methods.join(", ")}`,
            ].join("\n"));
            return { content: [{ type: "text", text: `检测到 ${libs.length} 个加密库:\n\n${output.join("\n\n")}` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `识别失败: ${error.message}` }], isError: true };
        }
    });
    // crypto_extract_key - 提取密钥
    server.tool("crypto_extract_key", "尝试从JS源码和Runtime中提取加密密钥、IV、盐值等关键参数", {
        algorithm: z.string().optional().describe("指定算法类型辅助搜索，如'AES','RSA'"),
    }, async ({ algorithm }) => {
        try {
            const page = browserManager.getPage();
            const cdp = browserManager.getCDPSession();
            const findings = ["=== 密钥/参数提取结果 ===\n"];
            // 1. 从Runtime获取
            const runtimeKeys = await page.evaluate((algo) => {
                const keys = [];
                // 搜索window上的密钥相关属性
                const keyPatterns = /key|iv|salt|secret|public|private|nonce|aesKey|desKey|rsaKey/i;
                for (const prop of Object.getOwnPropertyNames(window)) {
                    if (keyPatterns.test(prop)) {
                        try {
                            const val = window[prop];
                            if (typeof val === "string" && val.length >= 8 && val.length <= 2048) {
                                keys.push({ name: prop, value: val.substring(0, 200), source: "window全局" });
                            }
                        }
                        catch { /* skip */ }
                    }
                }
                return keys;
            }, algorithm);
            if (runtimeKeys.length > 0) {
                findings.push("--- Runtime全局变量 ---");
                for (const k of runtimeKeys) {
                    findings.push(`  ${k.name} = "${k.value}" (来源: ${k.source})`);
                    // 推断算法
                    const keyLen = k.value.length;
                    if (/^[0-9a-fA-F]+$/.test(k.value)) {
                        const algs = inferAlgorithmFromKeyLength(keyLen / 2);
                        findings.push(`    → 可能是: ${algs.join("/")} 的密钥 (${keyLen / 2}字节Hex)`);
                    }
                    else {
                        const algs = inferAlgorithmFromKeyLength(keyLen);
                        findings.push(`    → 可能是: ${algs.join("/")} 的密钥 (${keyLen}字节UTF8)`);
                    }
                }
            }
            // 2. 从源码中搜索硬编码密钥
            findings.push("\n--- 源码中的硬编码密钥 ---");
            const keyRegexes = [
                { name: "AES Key (16/24/32字符)", regex: /(?:key|aesKey|secretKey|secret)\s*[:=]\s*["']([^"']{16,32})["']/gi },
                { name: "IV (16字符)", regex: /(?:iv|IV|offset)\s*[:=]\s*["']([^"']{16})["']/gi },
                { name: "RSA Public Key", regex: /(-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----)/g },
                { name: "RSA Public Key (Hex)", regex: /(?:publicKey|pubKey|rsaKey)\s*[:=]\s*["']([0-9a-fA-F]{128,})["']/gi },
            ];
            for (const [, source] of sourceCache.entries()) {
                for (const { name, regex } of keyRegexes) {
                    let match;
                    while ((match = regex.exec(source)) !== null) {
                        findings.push(`  ${name}: "${match[1].substring(0, 200)}${match[1].length > 200 ? "..." : ""}"`);
                    }
                    regex.lastIndex = 0;
                }
            }
            // 3. 尝试从CryptoJS.enc.Utf8.parse调用中提取
            for (const [, source] of sourceCache.entries()) {
                const parseRegex = /CryptoJS\.enc\.Utf8\.parse\s*\(\s*["']([^"']+)["']\s*\)/g;
                let match;
                while ((match = parseRegex.exec(source)) !== null) {
                    findings.push(`  CryptoJS Key/IV: "${match[1]}" (${match[1].length}字节)`);
                    const algs = inferAlgorithmFromKeyLength(match[1].length);
                    findings.push(`    → 可能是: ${algs.join("/")} 的参数`);
                }
            }
            return { content: [{ type: "text", text: findings.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `提取失败: ${error.message}` }], isError: true };
        }
    });
    // crypto_verify_algorithm - 验证加密算法
    server.tool("crypto_verify_algorithm", "使用本地加密库验证猜测的算法是否正确（输入明文+参数，对比是否能得到相同密文）", {
        algorithm: z.enum(["AES-CBC", "AES-ECB", "DES", "3DES", "MD5", "SHA256", "Base64"]).describe("算法类型"),
        plaintext: z.string().describe("明文（如原始密码）"),
        expected: z.string().describe("期望的密文（从拦截的请求中获取）"),
        key: z.string().optional().describe("密钥（对称加密需要）"),
        iv: z.string().optional().describe("IV向量（CBC模式需要）"),
        encoding: z.enum(["base64", "hex"]).optional().describe("输出编码方式，默认base64"),
    }, async ({ algorithm, plaintext, expected, key, iv, encoding }) => {
        try {
            // 动态导入CryptoJS进行本地验证
            const CryptoJS = await import("crypto-js");
            let result = "";
            const outputEncoding = encoding || "base64";
            switch (algorithm) {
                case "MD5":
                    result = CryptoJS.MD5(plaintext).toString();
                    break;
                case "SHA256":
                    result = CryptoJS.SHA256(plaintext).toString();
                    break;
                case "Base64":
                    result = Buffer.from(plaintext).toString("base64");
                    break;
                case "AES-CBC":
                case "AES-ECB": {
                    if (!key)
                        return { content: [{ type: "text", text: "AES加密需要提供key参数" }], isError: true };
                    const keyParsed = CryptoJS.enc.Utf8.parse(key);
                    const options = {
                        mode: algorithm === "AES-ECB" ? CryptoJS.mode.ECB : CryptoJS.mode.CBC,
                        padding: CryptoJS.pad.Pkcs7,
                    };
                    if (iv && algorithm === "AES-CBC") {
                        options.iv = CryptoJS.enc.Utf8.parse(iv);
                    }
                    const encrypted = CryptoJS.AES.encrypt(plaintext, keyParsed, options);
                    result = outputEncoding === "hex" ? encrypted.ciphertext.toString() : encrypted.toString();
                    break;
                }
                case "DES": {
                    if (!key)
                        return { content: [{ type: "text", text: "DES加密需要提供key参数" }], isError: true };
                    const keyParsed = CryptoJS.enc.Utf8.parse(key);
                    const options = { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 };
                    if (iv)
                        options.iv = CryptoJS.enc.Utf8.parse(iv);
                    const encrypted = CryptoJS.DES.encrypt(plaintext, keyParsed, options);
                    result = outputEncoding === "hex" ? encrypted.ciphertext.toString() : encrypted.toString();
                    break;
                }
                case "3DES": {
                    if (!key)
                        return { content: [{ type: "text", text: "3DES加密需要提供key参数" }], isError: true };
                    const keyParsed = CryptoJS.enc.Utf8.parse(key);
                    const encrypted = CryptoJS.TripleDES.encrypt(plaintext, keyParsed, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
                    result = outputEncoding === "hex" ? encrypted.ciphertext.toString() : encrypted.toString();
                    break;
                }
            }
            const match = result === expected;
            const output = [
                `=== 算法验证结果 ===`,
                `算法: ${algorithm}`,
                `明文: "${plaintext}"`,
                `密钥: "${key || "N/A"}"`,
                `IV: "${iv || "N/A"}"`,
                `编码: ${outputEncoding}`,
                ``,
                `计算结果: ${result}`,
                `期望结果: ${expected}`,
                ``,
                match ? "✅ 验证通过！算法和参数正确" : "❌ 验证失败 - 结果不匹配，请检查算法/密钥/IV/编码/填充方式",
            ];
            return { content: [{ type: "text", text: output.join("\n") }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: `验证失败: ${error.message}` }], isError: true };
        }
    });
    logger.info("Crypto detection tools registered (5 tools)");
}
//# sourceMappingURL=crypto-detect.js.map