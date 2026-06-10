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

## 十、完整依赖清单

### 10.1 直接依赖（dependencies）

| 包名 | 版本 | 说明 |
|------|------|------|
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP 协议 SDK（含 Hono/Express 服务端支持） |
| `zod` | 3.25.76 | TypeScript-first Schema 声明与校验库 |
| `puppeteer-core` | 23.11.1 | Chrome 浏览器自动化控制（高优先级 CDP API） |
| `js-beautify` | 1.15.4 | JS/HTML/CSS 代码美化格式化 |
| `acorn` | 8.16.0 | ECMAScript 语法解析器 |
| `acorn-walk` | 8.3.5 | ECMAScript AST 遍历器 |
| `crypto-js` | 4.2.0 | 加密算法库（AES/DES/MD5/SHA/RSA 等） |
| `node-forge` | 1.4.0 | JS 加密实现（TLS/X.509/RSA/AES 等） |
| `mustache` | 4.2.0 | 无逻辑 Mustache 模板引擎 |

### 10.2 开发依赖（devDependencies）

| 包名 | 版本 | 说明 |
|------|------|------|
| `typescript` | 5.9.3 | TypeScript 编译器 |
| `tsx` | 4.22.4 | TypeScript 直接执行工具（基于 esbuild） |
| `@types/node` | 22.19.20 | Node.js 类型定义 |
| `@types/crypto-js` | 4.2.2 | crypto-js 类型定义 |
| `@types/js-beautify` | 1.14.3 | js-beautify 类型定义 |
| `@types/node-forge` | 1.3.14 | node-forge 类型定义 |
| `@types/mustache` | 4.2.6 | mustache 类型定义 |
| `@types/yauzl` | 2.10.3 | yauzl 类型定义 |

### 10.3 间接依赖（传递依赖）

#### MCP / 网络通信相关

| 包名 | 版本 | 说明 |
|------|------|------|
| `express` | 5.2.1 | HTTP Web 框架（MCP SDK 内部使用） |
| `hono` | 4.12.25 | 轻量 Web 框架（MCP SDK 可选传输） |
| `@hono/node-server` | 1.19.14 | Hono Node.js 适配器 |
| `ws` | 8.21.0 | WebSocket 客户端/服务端 |
| `eventsource` | 2.0.2 | SSE（Server-Sent Events）客户端 |
| `eventsource-parser` | 3.0.2 | SSE 协议解析器 |
| `zod-to-json-schema` | 3.25.2 | Zod Schema 转 JSON Schema |
| `jose` | 6.2.3 | JWT/JWS/JWE 实现（OAuth 支持） |
| `pkce-challenge` | 5.0.1 | PKCE 挑战对生成/验证 |
| `cors` | 2.8.5 | HTTP CORS 中间件 |
| `body-parser` | 2.2.2 | HTTP 请求体解析中间件 |
| `router` | 2.2.0 | 简易中间件路由 |
| `express-rate-limit` | 8.2.1 | Express 请求限速 |

#### Puppeteer / 浏览器自动化相关

| 包名 | 版本 | 说明 |
|------|------|------|
| `chromium-bidi` | 0.11.0 | WebDriver BiDi 协议实现（Puppeteer 内部） |
| `@puppeteer/browsers` | 2.6.1 | 浏览器下载与启动工具 |
| `devtools-protocol` | 0.0.1452057 | Chrome DevTools Protocol 类型定义 |
| `basic-ftp` | 5.3.1 | FTP 客户端（浏览器下载） |
| `extract-zip` | 2.0.1 | ZIP 解压工具 |
| `yauzl` | 2.10.0 | ZIP 文件解析库 |
| `progress` | 2.0.3 | 下载进度条 |
| `mitt` | 3.0.1 | 轻量事件发射器 |
| `typed-query-selector` | 2.12.2 | 类型化 querySelector |

#### 代理 / 网络相关

| 包名 | 版本 | 说明 |
|------|------|------|
| `proxy-agent` | 6.5.0 | 代理协议映射 Agent |
| `http-proxy-agent` | 7.0.2 | HTTP 代理 Agent |
| `https-proxy-agent` | 7.0.6 | HTTPS 代理 Agent |
| `socks-proxy-agent` | 8.0.5 | SOCKS 代理 Agent |
| `socks` | 2.8.9 | SOCKS v4/v4a/v5 客户端 |
| `pac-proxy-agent` | 7.2.0 | PAC 文件代理 Agent |
| `pac-resolver` | 7.0.1 | PAC 文件解析器 |
| `proxy-from-env` | 1.1.0 | 从环境变量获取代理配置 |
| `netmask` | 2.1.1 | IP 网段解析 |
| `ip-address` | 10.2.0 | IPv4/IPv6 地址解析 |
| `smart-buffer` | 4.2.0 | 智能 Buffer 封装 |
| `agent-base` | 7.1.4 | HTTP Agent 基类 |
| `data-uri-to-buffer` | 6.0.2 | Data URI 转 Buffer |
| `get-uri` | 6.0.5 | URI 转可读流 |

#### 构建工具

| 包名 | 版本 | 说明 |
|------|------|------|
| `esbuild` | 0.28.0 | 极速 JS 打包器（tsx 内部使用） |
| `@esbuild/win32-x64` | 0.28.0 | esbuild Windows 64 位二进制 |

#### 工具函数 / 通用库

| 包名 | 版本 | 说明 |
|------|------|------|
| `debug` | 4.4.1 | 调试日志工具 |
| `ms` | 2.1.3 | 毫秒转换工具 |
| `semver` | 7.8.4 | 语义化版本解析 |
| `glob` | 10.4.5 | Glob 模式匹配 |
| `minimatch` | 9.0.9 | Glob 匹配器 |
| `minipass` | 7.1.3 | 最小 PassThrough 流实现 |
| `lru-cache` | 10.4.3 | LRU 缓存 |
| `signal-exit` | 4.1.0 | 进程退出信号处理 |
| `once` | 1.4.0 | 函数单次执行 |
| `pump` | 3.0.4 | 管道流连接 |
| `wrappy` | 1.0.2 | 回调包装工具 |
| `which` | 2.0.2 | 可执行文件查找（类 Unix which） |
| `path-key` | 3.1.1 | 跨平台 PATH 键获取 |
| `cross-spawn` | 7.0.6 | 跨平台 spawn |
| `shebang-command` | 2.0.0 | shebang 命令提取 |
| `shebang-regex` | 3.0.0 | shebang 正则匹配 |
| `isexe` | 2.0.0 | 可执行文件检测 |
| `foreground-child` | 3.3.1 | 前台子进程管理 |
| `package-json-from-dist` | 1.0.1 | 从 dist 加载 package.json |
| `path-scurry` | 1.11.1 | 高效路径遍历 |
| `jackspeak` | 3.4.3 | 严格参数解析器 |
| `require-from-string` | 2.0.2 | 从字符串加载模块 |
| `require-directory` | 2.1.1 | 递归加载目录模块 |

#### HTTP / Web 基础

| 包名 | 版本 | 说明 |
|------|------|------|
| `accepts` | 2.0.0 | HTTP 内容协商 |
| `negotiator` | 1.0.0 | HTTP 内容协商底层 |
| `content-type` | 1.0.5 | Content-Type 解析 |
| `content-disposition` | 1.1.0 | Content-Disposition 解析 |
| `type-is` | 2.1.0 | 请求类型推断 |
| `media-typer` | 1.1.0 | RFC 6838 媒体类型解析 |
| `mime-types` | 3.0.2 | MIME 类型工具 |
| `mime-db` | 1.54.0 | MIME 类型数据库 |
| `cookie` | 0.7.2 | Cookie 解析与序列化 |
| `cookie-signature` | 1.2.2 | Cookie 签名 |
| `etag` | 1.8.1 | ETag 生成 |
| `fresh` | 2.0.0 | HTTP 缓存新鲜度检查 |
| `vary` | 1.1.2 | Vary 头操作 |
| `send` | 1.2.1 | 静态文件发送 |
| `serve-static` | 2.2.1 | 静态文件服务 |
| `range-parser` | 1.2.1 | Range 头解析 |
| `parseurl` | 1.3.3 | URL 解析（带缓存） |
| `encodeurl` | 2.0.0 | URL 编码 |
| `escape-html` | 1.0.3 | HTML 转义 |
| `on-finished` | 2.4.1 | 请求完成回调 |
| `ee-first` | 1.1.1 | 事件优先触发 |
| `unpipe` | 1.0.0 | 解除流管道 |
| `raw-body` | 3.0.2 | 原始请求体获取 |
| `bytes` | 3.1.2 | 字节字符串转换 |
| `statuses` | 2.0.2 | HTTP 状态码工具 |
| `http-errors` | 2.0.1 | HTTP 错误对象 |
| `toidentifier` | 1.0.1 | 字符串转 JS 标识符 |
| `depd` | 2.0.0 | 废弃警告工具 |
| `proxy-addr` | 2.0.7 | 代理地址判定 |
| `forwarded` | 0.2.0 | Forwarded 头解析 |
| `ipaddr.js` | 1.9.1 | IPv4/IPv6 操作库 |
| `merge-descriptors` | 2.0.0 | 属性描述符合并 |
| `object-inspect` | 1.13.4 | 对象字符串表示 |
| `path-to-regexp` | 8.4.2 | Express 风格路径转正则 |
| `qs` | 6.15.2 | 查询字符串解析（支持嵌套） |
| `iconv-lite` | 0.7.2 | 字符编码转换 |
| `safer-buffer` | 2.1.2 | 安全 Buffer polyfill |

#### JS 解析 / AST 相关

| 包名 | 版本 | 说明 |
|------|------|------|
| `esprima` | 4.0.1 | ECMAScript 解析器 |
| `escodegen` | 2.1.0 | ECMAScript 代码生成 |
| `estraverse` | 5.3.0 | ECMAScript AST 遍历 |
| `esutils` | 2.0.3 | ECMAScript 工具函数 |
| `ast-types` | 0.13.4 | Mozilla JS Parser API 实现 |
| `source-map` | 0.6.1 | Source Map 生成与消费 |

#### 加密 / 编码相关

| 包名 | 版本 | 说明 |
|------|------|------|
| `base64-js` | 1.5.1 | 纯 JS Base64 编解码 |
| `ieee754` | 1.2.1 | IEEE754 浮点数读写 |
| `buffer` | 5.7.1 | 浏览器 Buffer API |
| `buffer-crc32` | 0.2.13 | CRC32 算法 |

#### 数据校验 / Schema

| 包名 | 版本 | 说明 |
|------|------|------|
| `ajv` | 8.20.0 | JSON Schema 校验器 |
| `ajv-formats` | 3.0.1 | Ajv 格式校验扩展 |
| `json-schema-traverse` | 1.0.0 | JSON Schema 遍历 |
| `json-schema-typed` | 8.0.2 | JSON Schema TS 定义 |
| `fast-deep-equal` | 3.1.3 | 深度相等比较 |
| `fast-uri` | 3.1.0 | 快速 URI 解析 |

#### 流处理 / 解压

| 包名 | 版本 | 说明 |
|------|------|------|
| `streamx` | 2.27.0 | 改进的 Node.js 流实现 |
| `tar-stream` | 3.2.0 | 流式 tar 解析/生成 |
| `tar-fs` | 3.1.2 | tar 文件系统绑定 |
| `teex` | 1.0.1 | 可读流多路复用 |
| `text-decoder` | 1.2.7 | 流式文本解码器 |
| `b4a` | 1.8.1 | Buffer/TypedArray 桥接 |
| `unbzip2-stream` | 1.4.3 | bzip2 流式解压 |
| `end-of-stream` | 1.4.5 | 流结束检测 |
| `get-stream` | 5.2.0 | 流转换为字符串/Buffer |
| `bare-stream` | 2.13.1 | Bare 运行时流实现 |
| `through` | 2.3.8 | 简易流构造 |
| `fast-fifo` | 1.3.2 | 快速 FIFO 队列 |

#### 终端 / CLI 相关

| 包名 | 版本 | 说明 |
|------|------|------|
| `yargs` | 17.7.2 | 命令行参数解析 |
| `yargs-parser` | 21.1.1 | yargs 参数解析器 |
| `y18n` | 5.0.8 | 国际化库（yargs 使用） |
| `cliui` | 8.0.1 | CLI 多列输出 |
| `wrap-ansi` | 7.0.0 / 8.1.0 | ANSI 终端文本换行 |
| `ansi-regex` | 6.2.2 | ANSI 转义码正则 |
| `ansi-styles` | 6.2.3 | ANSI 终端样式 |
| `color-convert` | 2.0.1 | 颜色格式转换 |
| `color-name` | 1.1.4 | 颜色名称映射 |
| `string-width` | 4.2.3 / 5.1.2 | 字符串显示宽度 |
| `strip-ansi` | 6.0.1 / 7.2.0 | 去除 ANSI 转义码 |
| `is-fullwidth-code-point` | 3.0.0 | 全角字符检测 |
| `eastasianwidth` | 0.2.0 | 东亚字符宽度 |
| `emoji-regex` | 10.4.0 | Emoji 正则 |

#### 配置 / INI / EditorConfig

| 包名 | 版本 | 说明 |
|------|------|------|
| `commander` | 10.0.1 | Node.js CLI 命令框架 |
| `editorconfig` | 1.0.4 | EditorConfig 解析 |
| `@one-ini/wasm` | 0.1.1 | INI 文件 WASM 解析 |
| `ini` | 1.3.8 | INI 编解码 |
| `config-chain` | 1.1.13 | 配置链管理 |
| `proto-list` | 1.2.4 | 原型链工具 |
| `nopt` | 7.2.1 | Node 选项解析 |
| `abbrev` | 2.0.0 | 字符串缩写生成 |

#### 对象 / 函数工具

| 包名 | 版本 | 说明 |
|------|------|------|
| `has-symbols` | 1.1.0 | Symbol 支持检测 |
| `hasown` | 2.0.4 | 安全 hasOwnProperty |
| `gopd` | 1.2.0 | getOwnPropertyDescriptor |
| `call-bind-apply-helpers` | 1.0.2 | call/apply 辅助 |
| `call-bound` | 1.0.4 | 安全绑定调用 |
| `es-define-property` | 1.0.1 | Object.defineProperty 安全版 |
| `es-errors` | 1.3.0 | ES 错误类型 |
| `es-object-atoms` | 1.1.1 | ES 对象原子操作 |
| `math-intrinsics` | 1.1.0 | Math 内部函数 |
| `side-channel` | 1.1.1 | 侧信道存储（WeakMap） |
| `side-channel-map` | 1.0.1 | 侧信道 Map 实现 |
| `side-channel-list` | 1.0.1 | 侧信道链表实现 |
| `side-channel-weakmap` | 1.0.2 | 侧信道 WeakMap 实现 |
| `dunder-proto` | 1.0.1 | \_\_proto\_\_ 安全访问 |
| `get-intrinsic` | 1.3.0 | JS 内置对象获取 |
| `get-proto` | 1.0.1 | 原型获取 |
| `object-assign` | 4.1.1 | Object.assign polyfill |
| `setprototypeof` | 1.2.0 | setPrototypeOf polyfill |
| `inherits` | 2.0.4 | 继承工具 |
| `function-bind` | 1.1.2 | Function.prototype.bind |

#### Bare 运行时（Puppeteer 可选依赖）

| 包名 | 版本 | 说明 |
|------|------|------|
| `bare-events` | 2.9.1 | Bare 事件发射器 |
| `bare-fs` | 4.7.2 | Bare 文件系统操作 |
| `bare-os` | 3.9.1 | Bare 操作系统工具 |
| `bare-path` | 3.0.1 | Bare 路径操作 |
| `bare-url` | 2.4.5 | Bare URL 实现 |
| `events-universal` | 1.0.1 | 通用事件模块 |

#### 其他

| 包名 | 版本 | 说明 |
|------|------|------|
| `balanced-match` | 1.0.2 | 平衡括号匹配 |
| `brace-expansion` | 2.1.1 | 大括号展开（sh/bash 风格） |
| `tslib` | 2.8.1 | TypeScript 运行时辅助库 |
| `undici-types` | 6.21.0 | Undici 类型定义 |
| `js-cookie` | 3.0.8 | 轻量 Cookie 操作库 |
| `@tootallnate/quickjs-emscripten` | 0.23.0 | QuickJS WASM 绑定 |
| `@isaacs/cliui` | 8.0.2 | CLI 多列输出（isaacs 版） |
| `@pkgjs/parseargs` | 0.11.0 | util.parseArgs polyfill |

---

## 十一、配置文件说明

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

## 十二、注意事项

1. **首次使用必须调用 `browser_launch`**：所有需要浏览器操作的工具都依赖浏览器实例，必须先启动
2. **Chrome 路径配置**：确保 `CHROME_PATH` 环境变量指向正确的 Chrome 安装路径
3. **网络拦截顺序**：需先调用 `network_enable_intercept`，再在页面上进行操作
4. **脚本源码缓存**：`js_get_all_scripts` 会建立脚本缓存，后续的分析/搜索工具依赖此缓存
5. **日志走 stderr**：所有调试日志通过 `console.error` 输出，不会干扰 MCP stdio 通信
6. **输出目录**：生成的脚本和会话数据保存在 `OUTPUT_DIR` 指定的目录中

---

## 十三、许可证

本项目仅供学习和安全研究使用，请遵守相关法律法规。


## 十三、测试用例

<img width="692" height="368" alt="image" src="https://github.com/user-attachments/assets/e5ad6e0f-b14e-4dc6-8aac-2e863a165dc7" />

<img width="692" height="368" alt="image" src="https://github.com/user-attachments/assets/2cc5a853-bced-459e-a23e-5e0553a9b067" />

<img width="692" height="356" alt="image" src="https://github.com/user-attachments/assets/4e005879-ad79-4159-bbd6-3013ba5ed28d" />

<img width="692" height="325" alt="image" src="https://github.com/user-attachments/assets/be2b1d9f-b3d7-4db3-86b2-9e3408d75445" />

<img width="1031" height="788" alt="image" src="https://github.com/user-attachments/assets/83551c4f-6837-4704-81d1-75a265e6782a" />

<img width="1920" height="1020" alt="image" src="https://github.com/user-attachments/assets/a699627e-0af9-4773-9648-05073f129390" />




