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

export const CRYPTO_PATTERNS: CryptoPattern[] = [
  // === AES ===
  {
    name: "CryptoJS AES",
    algorithm: "AES",
    category: "symmetric",
    patterns: [
      /CryptoJS\.AES\.encrypt/,
      /CryptoJS\.AES\.decrypt/,
    ],
    confidence: 0.95,
    details: "CryptoJS库AES加密",
  },
  {
    name: "AES Mode CBC",
    algorithm: "AES-CBC",
    category: "symmetric",
    patterns: [
      /CryptoJS\.mode\.CBC/,
      /mode\s*:\s*CryptoJS\.mode\.CBC/,
    ],
    confidence: 0.90,
  },
  {
    name: "AES Mode ECB",
    algorithm: "AES-ECB",
    category: "symmetric",
    patterns: [
      /CryptoJS\.mode\.ECB/,
      /mode\s*:\s*CryptoJS\.mode\.ECB/,
    ],
    confidence: 0.90,
  },
  {
    name: "AES PKCS7 Padding",
    algorithm: "AES-PKCS7",
    category: "symmetric",
    patterns: [
      /CryptoJS\.pad\.Pkcs7/,
      /padding\s*:\s*CryptoJS\.pad\.Pkcs7/,
    ],
    confidence: 0.90,
  },
  {
    name: "AES ZeroPadding",
    algorithm: "AES-ZeroPadding",
    category: "symmetric",
    patterns: [
      /CryptoJS\.pad\.ZeroPadding/,
    ],
    confidence: 0.90,
  },
  {
    name: "AES NoPadding",
    algorithm: "AES-NoPadding",
    category: "symmetric",
    patterns: [
      /CryptoJS\.pad\.NoPadding/,
    ],
    confidence: 0.90,
  },
  // === DES / 3DES ===
  {
    name: "CryptoJS DES",
    algorithm: "DES",
    category: "symmetric",
    patterns: [
      /CryptoJS\.DES\.encrypt/,
      /CryptoJS\.DES\.decrypt/,
    ],
    confidence: 0.95,
  },
  {
    name: "CryptoJS TripleDES",
    algorithm: "3DES",
    category: "symmetric",
    patterns: [
      /CryptoJS\.TripleDES\.encrypt/,
      /CryptoJS\.TripleDES\.decrypt/,
    ],
    confidence: 0.95,
  },
  // === RSA ===
  {
    name: "JSEncrypt RSA",
    algorithm: "RSA",
    category: "asymmetric",
    patterns: [
      /new\s+JSEncrypt/,
      /JSEncrypt\(\)/,
      /setPublicKey\s*\(/,
      /\.encrypt\s*\(.*\)/,
    ],
    confidence: 0.90,
  },
  {
    name: "RSAKey",
    algorithm: "RSA",
    category: "asymmetric",
    patterns: [
      /new\s+RSAKey/,
      /RSAKey\(\)/,
      /setPublic\s*\(/,
    ],
    confidence: 0.90,
  },
  {
    name: "node-forge RSA",
    algorithm: "RSA",
    category: "asymmetric",
    patterns: [
      /forge\.pki\.publicKeyFromPem/,
      /forge\.pki\.privateKeyFromPem/,
      /forge\.util\.encode64/,
    ],
    confidence: 0.85,
  },
  // === Hash ===
  {
    name: "CryptoJS MD5",
    algorithm: "MD5",
    category: "hash",
    patterns: [
      /CryptoJS\.MD5\s*\(/,
      /\.MD5\s*\(/,
    ],
    confidence: 0.95,
  },
  {
    name: "CryptoJS SHA1",
    algorithm: "SHA1",
    category: "hash",
    patterns: [
      /CryptoJS\.SHA1\s*\(/,
    ],
    confidence: 0.95,
  },
  {
    name: "CryptoJS SHA256",
    algorithm: "SHA256",
    category: "hash",
    patterns: [
      /CryptoJS\.SHA256\s*\(/,
      /CryptoJS\.SHA512\s*\(/,
    ],
    confidence: 0.95,
  },
  {
    name: "CryptoJS HmacSHA256",
    algorithm: "HMAC-SHA256",
    category: "hash",
    patterns: [
      /CryptoJS\.HmacSHA256\s*\(/,
      /CryptoJS\.HmacMD5\s*\(/,
    ],
    confidence: 0.95,
  },
  // === Base64 ===
  {
    name: "Base64 Encoding",
    algorithm: "Base64",
    category: "encoding",
    patterns: [
      /btoa\s*\(/,
      /atob\s*\(/,
      /CryptoJS\.enc\.Base64/,
      /Base64\.encode/,
      /\.toString\(CryptoJS\.enc\.Base64\)/,
    ],
    confidence: 0.75,
  },
  {
    name: "Hex Encoding",
    algorithm: "Hex",
    category: "encoding",
    patterns: [
      /CryptoJS\.enc\.Hex/,
      /\.toString\(CryptoJS\.enc\.Hex\)/,
    ],
    confidence: 0.80,
  },
  // === 国密 SM ===
  {
    name: "SM2",
    algorithm: "SM2",
    category: "asymmetric",
    patterns: [
      /sm2\.doEncrypt/,
      /sm2\.doDecrypt/,
      /sm2\.doSignature/,
    ],
    confidence: 0.95,
  },
  {
    name: "SM3",
    algorithm: "SM3",
    category: "hash",
    patterns: [
      /sm3\s*\(/,
      /SM3\s*\(/,
    ],
    confidence: 0.90,
  },
  {
    name: "SM4",
    algorithm: "SM4",
    category: "symmetric",
    patterns: [
      /sm4\.encrypt/,
      /sm4\.decrypt/,
      /SM4\.encrypt/,
    ],
    confidence: 0.95,
  },
  // === node-forge ===
  {
    name: "node-forge Cipher",
    algorithm: "AES (forge)",
    category: "symmetric",
    patterns: [
      /forge\.cipher\.createCipher/,
      /forge\.cipher\.createDecipher/,
    ],
    confidence: 0.85,
  },
  // === 通用加密函数名模式 ===
  {
    name: "Generic Encrypt Function",
    algorithm: "Unknown",
    category: "symmetric",
    patterns: [
      /function\s+encrypt\s*\(/,
      /function\s+encryptPassword\s*\(/,
      /function\s+encryptData\s*\(/,
      /function\s+encodePassword\s*\(/,
      /\.encrypt\s*=\s*function/,
    ],
    confidence: 0.60,
  },
];

/**
 * 密文格式识别器
 */
export function identifyCiphertextFormat(value: string): {
  format: string;
  possibleAlgorithms: string[];
  confidence: number;
} {
  // MD5 - 32位hex
  if (/^[0-9a-fA-F]{32}$/.test(value)) {
    return { format: "Hex-32", possibleAlgorithms: ["MD5"], confidence: 0.85 };
  }

  // SHA1 - 40位hex
  if (/^[0-9a-fA-F]{40}$/.test(value)) {
    return { format: "Hex-40", possibleAlgorithms: ["SHA1"], confidence: 0.85 };
  }

  // SHA256 - 64位hex
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return { format: "Hex-64", possibleAlgorithms: ["SHA256"], confidence: 0.85 };
  }

  // Base64编码
  if (/^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0) {
    const decoded = Buffer.from(value, "base64");
    const len = decoded.length;

    if (len === 16 || len === 32 || len === 48 || len === 64) {
      return { format: "Base64", possibleAlgorithms: ["AES-CBC", "AES-ECB"], confidence: 0.70 };
    }
    if (len >= 128 && len <= 512) {
      return { format: "Base64-Long", possibleAlgorithms: ["RSA"], confidence: 0.65 };
    }
    return { format: "Base64", possibleAlgorithms: ["AES", "DES", "Unknown"], confidence: 0.50 };
  }

  // 长Hex字符串
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    const byteLen = value.length / 2;
    if (byteLen >= 128) {
      return { format: "Hex-Long", possibleAlgorithms: ["RSA"], confidence: 0.60 };
    }
    if (byteLen === 16 || byteLen === 32 || byteLen === 48) {
      return { format: "Hex", possibleAlgorithms: ["AES"], confidence: 0.60 };
    }
    return { format: "Hex", possibleAlgorithms: ["AES", "DES", "Unknown"], confidence: 0.40 };
  }

  return { format: "Unknown", possibleAlgorithms: ["Unknown"], confidence: 0.20 };
}

/**
 * 密钥长度推断算法
 */
export function inferAlgorithmFromKeyLength(keyBytes: number): string[] {
  switch (keyBytes) {
    case 8: return ["DES"];
    case 16: return ["AES-128", "SM4"];
    case 24: return ["AES-192", "3DES"];
    case 32: return ["AES-256"];
    default: return ["Unknown"];
  }
}
