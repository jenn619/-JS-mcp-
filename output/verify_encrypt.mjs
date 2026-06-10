import CryptoJS from "crypto-js";

// ===== 逆向分析结果 =====
// 来源: app.1d5eaa5c.js (position ~9500)
// 
// 原始代码:
//   M = T.a.enc.Utf8.parse("0123456789ABCDEF");
//   function j(e) {
//     var t = T.a.enc.Utf8.parse(JSON.stringify(e));
//     var n = T.a.AES.encrypt(t, M, { mode: T.a.mode.ECB, padding: T.a.pad.Pkcs7 });
//     return n.toString();
//   }
//   // login函数中: c = j(password)

const KEY = CryptoJS.enc.Utf8.parse("0123456789ABCDEF"); // 16字节 = AES-128
const PLAINTEXT_PASSWORD = "test123";
const EXPECTED_CIPHERTEXT = "y8d/dgERxCaiTGAod1+RiQ=="; // 从抓包获取

// === 加密验证 ===
function encrypt(plaintext) {
  const data = CryptoJS.enc.Utf8.parse(JSON.stringify(plaintext));
  const encrypted = CryptoJS.AES.encrypt(data, KEY, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

// === 解密函数 ===
function decrypt(ciphertext) {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, KEY, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
}

// 验证
const encrypted = encrypt(PLAINTEXT_PASSWORD);
console.log("=== 加密验证 ===");
console.log(`明文密码: ${PLAINTEXT_PASSWORD}`);
console.log(`计算密文: ${encrypted}`);
console.log(`期望密文: ${EXPECTED_CIPHERTEXT}`);
console.log(`验证结果: ${encrypted === EXPECTED_CIPHERTEXT ? "✅ 完全匹配！" : "❌ 不匹配"}`);

console.log("\n=== 解密验证 ===");
const decrypted = decrypt(EXPECTED_CIPHERTEXT);
console.log(`密文: ${EXPECTED_CIPHERTEXT}`);
console.log(`解密结果: ${decrypted}`);
console.log(`验证结果: ${decrypted === PLAINTEXT_PASSWORD ? "✅ 解密正确！" : "❌ 解密失败"}`);
