---
name: "web-preview"
description: "UniApp H5 Web Preview Skill - Automatically builds and serves the wo-laibang-app project for web preview. MANDATORY: Invoke IMMEDIATELY as FIRST action when user asks to preview, run, serve, start, launch the web app, or open the project in browser. NEVER skip invoking this skill when user wants to see the web preview."
---

# Web Preview Skill

This skill automatically builds and serves the **wo-laibang-app** UniApp project for web preview.

## Project Context

**Tech Stack:**
- UniApp + Vue.js 3
- Vite as build tool
- Pinia for state management
- Python http.server for serving build output

**Project Structure:**
- Source code: `/workspace/src/`
- Build output: `/workspace/dist/`
- Entry point: `/workspace/index.html`
- Main config: `/workspace/vite.config.js`
- Package config: `/workspace/package.json`

**Preview URL:**
- Local server: `http://localhost:5173`

## When to Use (触发范围)

**⚠️ MANDATORY: 当用户要求预览、运行、启动、打开浏览器查看项目时，必须在 FIRST ACTION 调用此技能！**

**🚫 NEVER: 不要在没有调用此 skill 的情况下跳过 web 预览步骤！**

包括但不限于以下场景：
- "Web preview" (Web 预览)
- "Run the project" (运行项目)
- "Start the app" (启动应用)
- "Open in browser" (在浏览器中打开)
- "Serve the project" (服务项目)
- "Launch web preview" (启动 web 预览)
- "预览一下" (预览)
- "运行一下" (运行)
- "打开看看" (打开看看)
- "启动服务" (启动服务)
- 用户修改了代码后要求查看效果
- 用户说"帮我运行起来"

## Workflow (工作流程)

### 1. Clean Previous Build (清理旧构建)

如果存在旧的预览服务器，先停止它：
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
```

### 2. Build the Project (构建项目)

```bash
cd /workspace && npm run build:h5
```

**Expected output:**
```
> wo-laibang-app@1.0.0 dev:h5
> vite build

The CJS build of Vite's Node API is deprecated...
Compiler version: 5.08（vue3）
Compiling...
NODE_ENV=production is not supported in the .env file...
欢迎将web站点部署到uniCloud前端网页托管平台...
```

### 3. Copy Static Files (复制静态文件)

Vite 的 uni-app 插件会把静态文件放在 `build/h5/static/`，需要复制到 `dist/` 根目录：

```bash
cd /workspace/dist && cp -r build/h5/static .
```

**Expected result:** `/workspace/dist/static/` 目录应该包含：
- `icons/` - SVG 图标文件
- `tabbar/` - TabBar 图片
- `css/` - 公共样式

### 4. Start Preview Server (启动预览服务器)

```bash
cd /workspace/dist && python3 -m http.server 5173
```

### 5. Verify Server (验证服务器)

检查服务器日志确保所有资源都能正常访问：

**应该看到的成功日志：**
```
127.0.0.1 - - [date] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [date] "GET /assets/index-xxx.js HTTP/1.1" 200 -
127.0.0.1 - - [date] "GET /assets/uni-xxx.css HTTP/1.1" 200 -
127.0.0.1 - - [date] "GET /static/icons/xxx.svg HTTP/1.1" 200 -
```

**可能出现的 404 错误：**
- `/favicon.ico` - 可以忽略，不影响功能
- 其他静态资源 404 - 需要检查是否复制了 static 文件

### 6. Provide Preview URL (提供预览地址)

使用 OpenPreview 工具打开浏览器：
```
预览地址: http://localhost:5173
```

## Common Issues & Solutions

### Issue 1: Port Already in Use (端口被占用)

**症状:**
```
OSError: [Errno 98] Address already in use
```

**解决方案:**
```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
# 然后重新启动服务器
```

### Issue 2: Static Files Not Found (静态文件找不到)

**症状:**
服务器日志中出现大量 404:
```
GET /static/icons/xxx.svg HTTP/1.1" 404 -
```

**解决方案:**
```bash
cd /workspace/dist && cp -r build/h5/static .
```

### Issue 3: Build Fails (构建失败)

**症状:**
Vite 编译错误或卡在 "Compiling..."

**解决方案:**
1. 检查代码是否有语法错误
2. 清理缓存: `cd /workspace && rm -rf .vite node_modules/.vite`
3. 重新安装依赖: `npm install --legacy-peer-deps`
4. 重新构建: `npm run build:h5`

### Issue 4: Dependencies Broken (依赖损坏)

**症状:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/workspace/node_modules/vite/dist/node/cli.js'
```

**解决方案:**
```bash
cd /workspace && rm -rf node_modules && npm install --legacy-peer-deps
```

## Implementation Details

### Build Process

1. **Vite Configuration:**
   - Plugin: `@dcloudio/vite-plugin-uni`
   - Source dir: `src/`
   - Output dir: `dist/`
   - Alias: `@` → `src/`

2. **NPM Scripts:**
   ```json
   {
     "dev:h5": "vite --host 0.0.0.0 --port 5173",
     "build:h5": "vite build",
     "preview": "vite preview"
   }
   ```

3. **Dependencies:**
   - `@dcloudio/uni-app`: 3.0.0-alpha-5000820260420001
   - `@dcloudio/uni-h5`: 3.0.0-alpha-5000820260420001
   - `@dcloudio/vite-plugin-uni`: 3.0.0-alpha-5000820260420001
   - `vite`: ^5.4.0
   - `vue`: ^3.4.21
   - `pinia`: ^2.1.7

### Server Process

1. **Use Python http.server** (跨平台，无需额外安装)
2. **Port**: 5173
3. **Working directory**: `/workspace/dist/`
4. **Static files**: `/workspace/dist/static/`

## Important Notes

1. **Always use `--legacy-peer-deps`** when running `npm install` to avoid dependency conflicts with uni-app packages
2. **Always copy static files** after build, or icons will show 404
3. **Check server logs** to verify all resources load correctly
4. **Provide the preview URL** to the user after server starts
5. **Use `OpenPreview` tool** to automatically open browser

## Response Template

完成所有步骤后，使用以下模板回复用户：

```
✅ Web 预览已启动！

构建信息:
- 项目: wo-laibang-app
- 技术栈: UniApp + Vue 3 + Vite
- 构建状态: 成功
- 预览地址: http://localhost:5173

资源加载状态:
- ✅ JS/CSS 资源: 正常
- ✅ 静态图标: 正常
- ✅ 页面路由: 正常

你现在可以在浏览器中打开 http://localhost:5173 查看效果了！
```
