export interface RequestRecord {
    id: string;
    timestamp: number;
    url: string;
    method: string;
    headers: Record<string, string>;
    postData: string | null;
    responseStatus: number | null;
    responseHeaders: Record<string, string>;
    responseBody: string | null;
    isLoginRequest: boolean;
    encryptedParams: string[];
}
/**
 * 请求数据存储 - 内存 + 文件双层
 */
declare class RequestStore {
    private requests;
    private outputDir;
    private counter;
    constructor();
    private ensureOutputDir;
    addRequest(data: Omit<RequestRecord, "id" | "timestamp" | "isLoginRequest" | "encryptedParams">): RequestRecord;
    private detectLoginRequest;
    private detectEncryptedParams;
    private looksEncrypted;
    getAll(filter?: {
        method?: string;
        urlPattern?: string;
        loginOnly?: boolean;
    }): RequestRecord[];
    getById(id: string): RequestRecord | undefined;
    findLoginRequests(): RequestRecord[];
    clear(): void;
    private persist;
}
export declare const requestStore: RequestStore;
export {};
