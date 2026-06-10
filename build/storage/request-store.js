import { logger } from "../utils/logger.js";
import * as fs from "fs";
import * as path from "path";
const LOGIN_URL_KEYWORDS = ["login", "signin", "sign-in", "auth", "account", "user/login", "api/login", "session"];
const LOGIN_BODY_KEYWORDS = ["password", "passwd", "pwd", "pass", "token", "credential"];
/**
 * 请求数据存储 - 内存 + 文件双层
 */
class RequestStore {
    requests = new Map();
    outputDir;
    counter = 0;
    constructor() {
        this.outputDir = process.env.OUTPUT_DIR || path.join(process.cwd(), "output");
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        const sessionDir = path.join(this.outputDir, ".session");
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
    }
    addRequest(data) {
        const id = `req_${++this.counter}_${Date.now()}`;
        const record = {
            ...data,
            id,
            timestamp: Date.now(),
            isLoginRequest: this.detectLoginRequest(data),
            encryptedParams: this.detectEncryptedParams(data.postData),
        };
        this.requests.set(id, record);
        this.persist();
        logger.debug(`Request stored: ${id} ${data.method} ${data.url}`);
        return record;
    }
    detectLoginRequest(data) {
        if (data.method !== "POST")
            return false;
        const urlLower = data.url.toLowerCase();
        const hasLoginUrl = LOGIN_URL_KEYWORDS.some((kw) => urlLower.includes(kw));
        if (data.postData) {
            const bodyLower = data.postData.toLowerCase();
            const hasLoginBody = LOGIN_BODY_KEYWORDS.some((kw) => bodyLower.includes(kw));
            return hasLoginUrl || hasLoginBody;
        }
        return hasLoginUrl;
    }
    detectEncryptedParams(postData) {
        if (!postData)
            return [];
        const encrypted = [];
        try {
            // 尝试JSON解析
            const json = JSON.parse(postData);
            for (const [key, value] of Object.entries(json)) {
                if (typeof value === "string" && this.looksEncrypted(value)) {
                    encrypted.push(key);
                }
            }
        }
        catch {
            // 尝试URL编码解析
            try {
                const params = new URLSearchParams(postData);
                for (const [key, value] of params.entries()) {
                    if (this.looksEncrypted(value)) {
                        encrypted.push(key);
                    }
                }
            }
            catch {
                // ignore
            }
        }
        return encrypted;
    }
    looksEncrypted(value) {
        if (value.length < 16)
            return false;
        // Base64特征
        if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0 && value.length >= 24)
            return true;
        // Hex特征
        if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0 && value.length >= 32)
            return true;
        // 包含特殊加密标记
        if (value.includes("==") && value.length > 20)
            return true;
        return false;
    }
    getAll(filter) {
        let records = Array.from(this.requests.values());
        if (filter?.method) {
            records = records.filter((r) => r.method === filter.method);
        }
        if (filter?.urlPattern) {
            const regex = new RegExp(filter.urlPattern, "i");
            records = records.filter((r) => regex.test(r.url));
        }
        if (filter?.loginOnly) {
            records = records.filter((r) => r.isLoginRequest);
        }
        return records.sort((a, b) => b.timestamp - a.timestamp);
    }
    getById(id) {
        return this.requests.get(id);
    }
    findLoginRequests() {
        return this.getAll({ loginOnly: true });
    }
    clear() {
        this.requests.clear();
        this.counter = 0;
    }
    persist() {
        try {
            const filePath = path.join(this.outputDir, ".session", "requests.json");
            const data = Array.from(this.requests.values());
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
        }
        catch (error) {
            logger.error("Failed to persist requests:", error);
        }
    }
}
export const requestStore = new RequestStore();
//# sourceMappingURL=request-store.js.map