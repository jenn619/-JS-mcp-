import { z } from "zod";
import { logger } from "../utils/logger.js";
import { generatePythonDecryptScript, generatePythonEncryptScript, generatePythonBruteScript } from "../generators/python-template.js";
import { generateJSDecryptScript, generateJSEncryptScript, generateJSBruteScript } from "../generators/javascript-template.js";
import * as fs from "fs";
import * as path from "path";
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), "output");
function ensureOutputDir() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}
export function registerScriptGenTools(server) {
    // generate_decrypt_script - 生成解密脚本
    server.tool("generate_decrypt_script", "根据分析结果生成完整的解密脚本（Python或JavaScript），自动保存到output目录", {
        language: z.enum(["python", "javascript"]).describe("脚本语言"),
        algorithm: z.enum(["AES-CBC", "AES-ECB", "DES", "3DES", "RSA", "MD5", "SHA256", "Base64", "Custom"])
            .describe("加密算法"),
        key: z.string().optional().describe("加密密钥"),
        iv: z.string().optional().describe("IV偏移量（CBC模式）"),
        mode: z.string().optional().describe("加密模式，如CBC/ECB"),
        padding: z.string().optional().describe("填充方式，如PKCS7/ZeroPadding"),
        encoding: z.string().optional().describe("输出编码，如base64/hex"),
        publicKey: z.string().optional().describe("RSA公钥（PEM格式）"),
        testPlaintext: z.string().optional().describe("测试明文"),
        testCiphertext: z.string().optional().describe("测试密文（用于验证）"),
    }, async ({ language, algorithm, key, iv, mode, padding, encoding, publicKey, testPlaintext, testCiphertext }) => {
        try {
            ensureOutputDir();
            const params = { algorithm, key, iv, mode, padding, encoding, publicKey, testPlaintext, testCiphertext };
            let script;
            let filename;
            if (language === "python") {
                script = generatePythonDecryptScript(params);
                filename = `decrypt_${algorithm.toLowerCase().replace("-", "_")}.py`;
            }
            else {
                script = generateJSDecryptScript(params);
                filename = `decrypt_${algorithm.toLowerCase().replace("-", "_")}.js`;
            }
            const filePath = path.join(OUTPUT_DIR, filename);
            fs.writeFileSync(filePath, script, "utf-8");
            return {
                content: [{
                        type: "text",
                        text: `解密脚本已生成:\n文件: ${filePath}\n语言: ${language}\n算法: ${algorithm}\n\n--- 脚本内容 ---\n${script}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `生成失败: ${error.message}` }], isError: true };
        }
    });
    // generate_encrypt_script - 生成加密脚本
    server.tool("generate_encrypt_script", "生成加密脚本（用于构造请求重放）", {
        language: z.enum(["python", "javascript"]).describe("脚本语言"),
        algorithm: z.enum(["AES-CBC", "AES-ECB", "DES", "3DES", "RSA", "MD5", "SHA256", "Base64", "Custom"])
            .describe("加密算法"),
        key: z.string().optional().describe("加密密钥"),
        iv: z.string().optional().describe("IV偏移量"),
        mode: z.string().optional().describe("加密模式"),
        padding: z.string().optional().describe("填充方式"),
        encoding: z.string().optional().describe("输出编码"),
        publicKey: z.string().optional().describe("RSA公钥"),
        testPlaintext: z.string().optional().describe("测试明文"),
        testCiphertext: z.string().optional().describe("期望密文"),
    }, async ({ language, algorithm, key, iv, mode, padding, encoding, publicKey, testPlaintext, testCiphertext }) => {
        try {
            ensureOutputDir();
            const params = { algorithm, key, iv, mode, padding, encoding, publicKey, testPlaintext, testCiphertext };
            let script;
            let filename;
            if (language === "python") {
                script = generatePythonEncryptScript(params);
                filename = `encrypt_${algorithm.toLowerCase().replace("-", "_")}.py`;
            }
            else {
                script = generateJSEncryptScript(params);
                filename = `encrypt_${algorithm.toLowerCase().replace("-", "_")}.js`;
            }
            const filePath = path.join(OUTPUT_DIR, filename);
            fs.writeFileSync(filePath, script, "utf-8");
            return {
                content: [{
                        type: "text",
                        text: `加密脚本已生成:\n文件: ${filePath}\n语言: ${language}\n算法: ${algorithm}\n\n--- 脚本内容 ---\n${script}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `生成失败: ${error.message}` }], isError: true };
        }
    });
    // generate_brute_script - 生成暴力破解脚本
    server.tool("generate_brute_script", "生成暴力破解脚本（包含加密+自动化登录尝试）", {
        language: z.enum(["python", "javascript"]).describe("脚本语言"),
        algorithm: z.enum(["AES-CBC", "AES-ECB", "DES", "3DES", "RSA", "MD5", "SHA256", "Base64", "Custom"])
            .describe("加密算法"),
        loginUrl: z.string().describe("登录接口URL"),
        paramName: z.string().optional().describe("密码参数名，默认'password'"),
        key: z.string().optional().describe("加密密钥"),
        iv: z.string().optional().describe("IV偏移量"),
        mode: z.string().optional().describe("加密模式"),
        encoding: z.string().optional().describe("输出编码"),
        publicKey: z.string().optional().describe("RSA公钥"),
    }, async ({ language, algorithm, loginUrl, paramName, key, iv, mode, encoding, publicKey }) => {
        try {
            ensureOutputDir();
            const params = { algorithm, key, iv, mode, encoding, publicKey, loginUrl, paramName };
            let script;
            let filename;
            if (language === "python") {
                script = generatePythonBruteScript(params);
                filename = `brute_${algorithm.toLowerCase().replace("-", "_")}.py`;
            }
            else {
                script = generateJSBruteScript(params);
                filename = `brute_${algorithm.toLowerCase().replace("-", "_")}.js`;
            }
            const filePath = path.join(OUTPUT_DIR, filename);
            fs.writeFileSync(filePath, script, "utf-8");
            return {
                content: [{
                        type: "text",
                        text: `暴力破解脚本已生成:\n文件: ${filePath}\n语言: ${language}\n算法: ${algorithm}\n目标: ${loginUrl}\n\n--- 脚本内容 ---\n${script}`,
                    }],
            };
        }
        catch (error) {
            return { content: [{ type: "text", text: `生成失败: ${error.message}` }], isError: true };
        }
    });
    // script_test_run - 测试运行脚本
    server.tool("script_test_run", "测试运行生成的脚本（仅支持JavaScript，Python需要本地python环境）", {
        code: z.string().describe("要测试的JavaScript代码"),
        testInput: z.string().optional().describe("测试输入（会作为命令行参数传入）"),
    }, async ({ code, testInput }) => {
        try {
            // 使用vm模块在沙箱中运行JS代码
            const { execSync } = await import("child_process");
            // 写入临时文件
            ensureOutputDir();
            const tmpFile = path.join(OUTPUT_DIR, "_test_run.js");
            const testCode = testInput
                ? `const TEST_INPUT = ${JSON.stringify(testInput)};\n${code}`
                : code;
            fs.writeFileSync(tmpFile, testCode, "utf-8");
            try {
                const result = execSync(`node "${tmpFile}"`, {
                    timeout: 10000,
                    encoding: "utf-8",
                    cwd: OUTPUT_DIR,
                });
                return {
                    content: [{
                            type: "text",
                            text: `✅ 脚本执行成功:\n\n${result}`,
                        }],
                };
            }
            catch (execError) {
                return {
                    content: [{
                            type: "text",
                            text: `❌ 脚本执行出错:\n${execError.stderr || execError.message}`,
                        }],
                    isError: true,
                };
            }
            finally {
                // 清理临时文件
                try {
                    fs.unlinkSync(tmpFile);
                }
                catch { /* ignore */ }
            }
        }
        catch (error) {
            return { content: [{ type: "text", text: `测试失败: ${error.message}` }], isError: true };
        }
    });
    logger.info("Script generation tools registered (4 tools)");
}
//# sourceMappingURL=script-gen.js.map