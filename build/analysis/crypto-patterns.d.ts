/**
 * 加密算法特征库 - 用于静态分析JS代码中的加密模式
 */
export interface CryptoPattern {
    name: string;
    algorithm: string;
    category: "symmetric" | "asymmetric" | "hash" | "encoding";
    patterns: RegExp[];
    confidence: number;
    details?: string;
}
export declare const CRYPTO_PATTERNS: CryptoPattern[];
/**
 * 密文格式识别器
 */
export declare function identifyCiphertextFormat(value: string): {
    format: string;
    possibleAlgorithms: string[];
    confidence: number;
};
/**
 * 密钥长度推断算法
 */
export declare function inferAlgorithmFromKeyLength(keyBytes: number): string[];
