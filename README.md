# JS 逆向 MCP 工具 (js-reverse-mcp)

> Chrome 浏览器 JS 逆向分析 MCP 工具 —— 专用于 CTF / Web 安全场景中登录框加密逻辑的动态分析与还原

---

## 一、项目简介

本项目是一个基于 **MCP（Model Context Protocol）** 协议的 JS 逆向分析工具集，通过 Chrome DevTools Protocol（CDP）动态分析目标网页中的 JavaScript 加密逻辑，自动识别加密算法、提取密钥，并生成可用的加密/解密脚本。

**核心能力：**
- 基于 Puppeteer 控制 Chrome 浏览器，动态执行目标页面 JS
- 利用 CDP 协议拦截网络请求、获取脚本源码、Hook 函数调用
- 内置加密算法特征库，支持 AES/DES/RSA/MD5/SHA/SM2/SM4/Base64 等
- 自动生成 Python 和 JavaScript 的加密/解密/暴力破解脚本
- 通过 MCP 协议暴露 31 个标准化工具接口，支持与 AI 助手集成

---

## 二、技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 语言 | TypeScript 5.7 + Node.js ≥18 | 主开发语言 |
| 协议 | @modelcontextprotocol/sdk v1.29 | MCP 协议 SDK |
| 浏览器 | puppeteer-core v23 | Chrome 自动化控制 |
| AST 分析 | acorn + acorn-walk | JS 语法树解析与遍历 |
| 加密分析 | crypto-js + node-forge | 加密算法验证与还原 |
| 代码美化 | js-beautify | 混淆 JS 代码格式化 |
| 模板引擎 | mustache | 脚本生成模板 |
| 数据校验 | zod v3.23 | MCP 消息 Schema 校验 |

---

## 三、项目结构

```
js-reverse-mcp/
├── src/                          # 源码目录
│   ├── index.ts                  # 程序入口 - 注册所有工具模块，启动 stdio 传输
│   ├── server.ts                 # MCP Server 创建与配置
│   │
│   ├── browser/
│   │   └── manager.ts            # 浏览器单例管理器 - Puppeteer 生命周期管理
│   │
│   ├── tools/                    # MCP 工具模块（共 6 个模块，31 个工具）
│   │   ├── navigation.ts         # 浏览器导航工具（5 个工具）
│   │   ├── network.ts            # 网络拦截工具（6 个工具）
│   │   ├── source-analysis.ts    # JS 源码分析工具（6 个工具）
│   │   ├── runtime.ts            # 运行时分析工具（5 个工具）
│   │   ├── crypto-detect.ts      # 加密检测工具（5 个工具）
│   │   └── script-gen.ts         # 脚本生成工具（4 个工具）
│   │
│   ├── analysis/
│   │   └── crypto-patterns.ts    # 加密算法特征库 - 静态模式匹配 + 密文格式识别
│   │
│   ├── generators/
│   │   ├── python-template.ts    # Python 脚本模板生成器（AES/DES/RSA/MD5/自定义）
│   │   └── javascript-template.ts # JavaScript 脚本模板生成器
│   │
│   ├── storage/
│   │   └── request-store.ts      # 请求数据存储 - 内存 + 文件双层持久化
│   │
│   └── utils/
│       └── logger.ts             # 日志工具（所有日志走 stderr，不破坏 MCP stdio）
│
├── build/                        # 编译输出目录（tsc 生成）
├── output/                       # 生成的脚本输出目录
├── mcp-config.json               # MCP 配置文件示例
├── package.json                  # 项目依赖与脚本
└── tsconfig.json                 # TypeScript 编译配置
```

---

## 四、工具清单

### 4.1 浏览器导航工具（navigation.ts）— 5 个

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `browser_launch` | 启动 Chrome 浏览器实例 | `headless`, `chromePath`, `proxy`, `wsEndpoint` |
| `browser_close` | 关闭浏览器，释放资源 | 无 |
| `page_navigate` | 导航到指定 URL | `url`, `waitUntil` |
| `page_screenshot` | 截取页面截图（base64 返回） | `selector`, `fullPage` |
| `page_get_content` | 获取页面 HTML 或元素内容 | `selector` |

### 4.2 网络拦截工具（network.ts）— 6 个

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `network_enable_intercept` | 开启网络请求拦截 | `urlPatterns`（URL 过滤模式列表） |
| `network_disable_intercept` | 关闭网络拦截 | 无 |
| `network_get_requests` | 获取已拦截的请求列表摘要 | `method`, `urlPattern`, `loginOnly` |
| `network_get_request_detail` | 获取单个请求完整详情 | `requestId` |
| `network_find_login_request` | 智能定位登录请求 | `keywords` |
| `network_compare_requests` | 对比多次请求参数差异 | `requestIds`（至少 2 个） |

### 4.3 JS 源码分析工具（source-analysis.ts）— 6 个

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `js_get_all_scripts` | 获取页面所有 JS 脚本列表 | 无 |
| `js_get_script_source` | 获取脚本源码（自动美化） | `scriptId`, `beautify`, `maxLength` |
| `js_search_in_scripts` | 在脚本中搜索关键词/正则 | `keyword`, `isRegex`, `contextLines` |
| `js_get_function_body` | 提取指定函数的完整实现 | `functionName`, `scriptId` |
| `js_trace_call_chain` | 追踪函数调用链 | `functionName`, `depth` |
| `js_get_encryption_context` | 获取加密函数及其依赖上下文 | `functionName` |

### 4.4 运行时分析工具（runtime.ts）— 5 个

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `runtime_evaluate` | 在页面中执行 JS 代码 | `expression`, `awaitPromise` |
| `runtime_call_function` | 调用页面全局函数 | `functionName`, `args` |
| `runtime_get_global_vars` | 获取加密相关全局变量 | `pattern`（正则过滤） |
| `runtime_hook_function` | Hook 函数，记录调用参数和返回值 | `functionName`（支持链式如 `CryptoJS.AES.encrypt`） |
| `runtime_get_hook_logs` | 获取 Hook 调用日志 | `functionName`, `clear` |

### 4.5 加密检测工具（crypto-detect.ts）— 5 个

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `crypto_auto_detect` | 自动扫描检测加密算法 | 无 |
| `crypto_analyze_param` | 分析参数加密方式 | `paramName`, `sampleValues` |
| `crypto_identify_library` | 识别页面使用的加密库 | 无 |
| `crypto_extract_key` | 提取密钥/IV/盐值 | `algorithm` |
| `crypto_verify_algorithm` | 本地验证加密算法是否正确 | `algorithm`, `plaintext`, `expected`, `key`, `iv` |

### 4.6 脚本生成工具（script-gen.ts）— 4 个

| 工具名 | 功能 | 关键参数 |
|--------|------|----------|
| `generate_decrypt_script` | 生成解密脚本（Python/JS） | `language`, `algorithm`, `key`, `iv`, `publicKey` 等 |
| `generate_encrypt_script` | 生成加密脚本 | 同上 |
| `generate_brute_script` | 生成暴力破解脚本 | 同上 + `loginUrl`, `paramName` |
| `script_test_run` | 测试运行 JS 脚本 | `code`, `testInput` |

**支持的算法类型：** AES-CBC、AES-ECB、DES、3DES、RSA、MD5、SHA256、Base64、Custom

---

## 五、环境要求与安装

### 5.1 环境要求

- **Node.js** ≥ 18.0.0
- **Google Chrome** 浏览器（需安装在本机）

### 5.2 安装步骤

```bash
# 1. 克隆项目
git clone <repo-url>
cd js-reverse-mcp

# 2. 安装依赖
npm install

# 3. 编译 TypeScript
npm run build
```

### 5.3 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `CHROME_PATH` | Chrome 可执行文件路径 | `C:\Users\fangz\AppData\Local\Google\Chrome\Application\chrome.exe` |
| `OUTPUT_DIR` | 脚本输出目录 | `./output` |
| `DEBUG` | 设为任意值开启调试日志 | 未设置（关闭） |

---

## 六、使用方法

### 6.1 启动命令

```bash
# 正式运行（需先 build）
npm start
# 等价于: node build/index.js

# 开发调试（直接运行 TS 源码，无需 build）
npm run dev

# 构建项目
npm run build

# 使用 MCP Inspector 调试
npm run inspector
```

### 6.2 配置 MCP 客户端

在 AI 客户端（如 Cursor、Claude Desktop 等）的 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": ["e:\\Qwen\\build\\index.js"],
      "env": {
        "CHROME_PATH": "C:\\Users\\fangz\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
        "OUTPUT_DIR": "e:\\Qwen\\output"
      }
    }
  }
}
```

配置完成后，AI 助手即可通过自然语言调用所有 31 个逆向工具。

---

## 七、实战逆向流程

以下是使用本工具对一个典型登录页面进行 JS 逆向的完整流程：

### 第 1 步：启动浏览器并导航

> "帮我启动 Chrome 并导航到目标登录页"

调用 `browser_launch` → `page_navigate` → `page_screenshot`

### 第 2 步：开启网络拦截

> "开启网络拦截，捕获所有请求"

调用 `network_enable_intercept`，然后在页面上手动执行一次登录操作。

### 第 3 步：定位登录请求

> "帮我找到加密的登录请求"

调用 `network_find_login_request`，自动识别包含密码/加密参数的 POST 请求。

### 第 4 步：自动检测加密算法

> "帮我检测页面使用了什么加密"

调用 `crypto_auto_detect`，扫描所有 JS 代码中的加密特征模式。

### 第 5 步：搜索加密代码

> "在 JS 中搜索 encrypt|CryptoJS|password"

调用 `js_search_in_scripts`，定位加密函数的具体代码位置。

### 第 6 步：提取密钥和参数

> "帮我提取 AES 的 key 和 iv"

调用 `crypto_extract_key`，从源码和 Runtime 中提取硬编码密钥。

### 第 7 步：验证加密算法

> "用 AES-ECB 模式，key 为 xxx，验证加密结果"

调用 `crypto_verify_algorithm`，本地计算对比密文是否匹配。

### 第 8 步：生成脚本

> "生成 Python 的 AES-ECB 解密脚本"

调用 `generate_decrypt_script`，自动保存到 `output/` 目录。

---

## 八、实战案例

以下是对 `https://tync.ecust.edu.cn/admin/#/login` 的逆向分析结果：

### 抓包结果
```
POST /api/venue_book/login/AdminLogin
{"user":"testuser","password":"y8d/dgERxCaiTGAod1+RiQ=="}
```

### 逆向定位的加密代码（app.js）
```javascript
// 硬编码密钥
const M = CryptoJS.enc.Utf8.parse("0123456789ABCDEF");

// 加密函数
function j(e) {
  var t = CryptoJS.enc.Utf8.parse(JSON.stringify(e));
  var n = CryptoJS.AES.encrypt(t, M, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return n.toString();
}

// 登录调用: c = j(password)
```

### 分析结论

| 项目 | 值 |
|------|------|
| 算法 | AES-128-ECB |
| 密钥 | `0123456789ABCDEF`（硬编码 16 字节） |
| 填充 | PKCS7 |
| 编码 | Base64 |
| 安全弱点 | ECB 模式无 IV、密钥硬编码在前端 |

---

## 九、核心模块说明

### 9.1 浏览器管理器（browser/manager.ts）

单例模式管理 Puppeteer 浏览器生命周期：
- 支持启动新实例或连接已有 Chrome（通过 `wsEndpoint`）
- 自动创建 CDP（Chrome DevTools Protocol）会话
- 默认禁用沙箱和跨域限制，方便逆向调试

### 9.2 请求存储（storage/request-store.ts）

内存 + 文件双层持久化：
- 自动检测登录请求（基于 URL 关键词 + 请求体关键词）
- 自动识别加密参数（Base64/Hex 特征检测）
- 请求记录持久化到 `output/.session/requests.json`

### 9.3 加密特征库（analysis/crypto-patterns.ts）

内置 20+ 种加密模式匹配规则：
- **对称加密：** AES（CBC/ECB/PKCS7/Zero/NoPadding）、DES、3DES
- **非对称加密：** JSEncrypt RSA、RSAKey、node-forge RSA
- **哈希算法：** MD5、SHA1、SHA256、HMAC-SHA256
- **编码格式：** Base64、Hex
- **国密算法：** SM2、SM3、SM4
- **密文格式识别器：** 根据长度和编码格式推断可能算法
- **密钥长度推断：** 8→DES、16→AES-128/SM4、24→AES-192/3DES、32→AES-256

### 9.4 脚本生成器（generators/）

支持生成三种类型的脚本：
- **加密/解密脚本：** Python（pycryptodome）和 JavaScript（crypto-js）
- **暴力破解脚本：** 包含加密函数 + 自动化登录请求
- 支持 AES、DES、3DES、RSA、MD5、自定义算法

### 9.5 日志工具（utils/logger.ts）

所有日志输出到 **stderr**（`console.error`），绝不使用 `console.log`，避免破坏 MCP stdio 协议通信。

---

## 十、配置文件说明

### mcp-config.json

```json
{
  "mcpServers": {
    "js-reverse": {
      "command": "node",
      "args": ["e:\\Qwen\\build\\index.js"],
      "env": {
        "CHROME_PATH": "C:\\Users\\fangz\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
        "OUTPUT_DIR": "e:\\Qwen\\output"
      }
    }
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

---

## 十一、注意事项

1. **首次使用必须调用 `browser_launch`**：所有需要浏览器操作的工具都依赖浏览器实例，必须先启动
2. **Chrome 路径配置**：确保 `CHROME_PATH` 环境变量指向正确的 Chrome 安装路径
3. **网络拦截顺序**：需先调用 `network_enable_intercept`，再在页面上进行操作
4. **脚本源码缓存**：`js_get_all_scripts` 会建立脚本缓存，后续的分析/搜索工具依赖此缓存
5. **日志走 stderr**：所有调试日志通过 `console.error` 输出，不会干扰 MCP stdio 通信
6. **输出目录**：生成的脚本和会话数据保存在 `OUTPUT_DIR` 指定的目录中

---

## 十二、许可证

本项目仅供学习和安全研究使用，请遵守相关法律法规。

## 十三、测试用例

<img width="692" height="368" alt="image" src="https://github.com/user-attachments/assets/e5ad6e0f-b14e-4dc6-8aac-2e863a165dc7" />

<img width="692" height="368" alt="image" src="https://github.com/user-attachments/assets/2cc5a853-bced-459e-a23e-5e0553a9b067" />

<img width="692" height="356" alt="image" src="https://github.com/user-attachments/assets/4e005879-ad79-4159-bbd6-3013ba5ed28d" />

<img width="692" height="325" alt="image" src="https://github.com/user-attachments/assets/be2b1d9f-b3d7-4db3-86b2-9e3408d75445" />


