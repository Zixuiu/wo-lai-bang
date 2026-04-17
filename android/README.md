# 我来帮 - Android APP 构建说明

## 项目结构

```
android/
├── app/
│   ├── build.gradle                    # APP构建配置
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml     # 权限配置
│           ├── java/com/wolaibang/app/
│           │   └── MainActivity.java   # 主Activity（含原生定位）
│           └── res/
│               ├── layout/
│               │   └── activity_main.xml
│               ├── values/
│               │   ├── colors.xml
│               │   ├── strings.xml
│               │   └── styles.xml
│               └── drawable/
│                   └── dialog_background.xml
├── build.gradle                        # 项目构建配置
├── settings.gradle                     # 项目设置
└── gradle.properties                   # Gradle配置
```

## 核心功能

### 1. 原生Android定位
- 使用 Google Play Services Location API
- 自定义权限弹窗（看起来像原生APP）
- 通过 JavaScript 接口与网页通信

### 2. WebView配置
- 全屏显示网页
- 拦截浏览器定位权限请求
- 支持本地文件和远程服务器

## 构建步骤

### 前提条件
1. 安装 Android Studio
2. 安装 JDK 11 或更高版本
3. 配置 Android SDK

### 步骤1：准备HTML文件
将前端文件复制到 Android 项目的 assets 目录：
```bash
# 创建目录
mkdir -p android/app/src/main/assets/www

# 复制前端文件
cp -r frontend/* android/app/src/main/assets/www/
```

### 步骤2：打开项目
1. 打开 Android Studio
2. 选择 "Open an existing Android Studio project"
3. 选择 `android` 文件夹

### 步骤3：同步项目
点击 "Sync Now" 同步 Gradle 配置

### 步骤4：构建APK
1. 选择 Build → Generate Signed Bundle / APK
2. 选择 APK
3. 创建或选择签名密钥
4. 选择 release 版本
5. 点击 Finish

### 步骤5：安装测试
```bash
adb install app-release.apk
```

## 关键代码说明

### Android 调用 JavaScript
```java
// 传递定位结果给网页
webView.evaluateJavascript("onLocationSuccess(" + latitude + ", " + longitude + ")", null);
```

### JavaScript 调用 Android
```javascript
// 请求定位
Android.getLocation();

// 检查权限
Android.hasLocationPermission();
```

### 回调函数
```javascript
// 定位成功回调
window.onLocationSuccess = function(latitude, longitude) {
    console.log('位置：', latitude, longitude);
};

// 定位失败回调
window.onLocationDenied = function() {
    console.log('用户拒绝定位');
};
```

## 权限说明

### AndroidManifest.xml 中声明的权限：
- `INTERNET` - 网络访问
- `ACCESS_FINE_LOCATION` - 精确定位
- `ACCESS_COARSE_LOCATION` - 粗略定位
- `WRITE_EXTERNAL_STORAGE` - 存储（可选）

### 运行时权限：
- Android 6.0+ 需要动态申请定位权限
- 首次使用定位功能时会弹出自定义权限弹窗

## 自定义配置

### 修改APP名称
编辑 `app/src/main/res/values/strings.xml`：
```xml
<string name="app_name">你的APP名称</string>
```

### 修改包名
编辑 `app/build.gradle`：
```gradle
applicationId "com.yourcompany.yourapp"
```

同时修改 `AndroidManifest.xml` 中的 package 属性。

### 修改主题颜色
编辑 `app/src/main/res/values/colors.xml`：
```xml
<color name="colorPrimary">#你的主色</color>
<color name="colorAccent">#你的强调色</color>
```

### 加载远程服务器
编辑 `MainActivity.java`：
```java
// 改为加载远程服务器
webView.loadUrl("https://your-server.com/index.html");
```

## 注意事项

1. **Google Play 服务**：定位功能依赖 Google Play Services，部分国内手机可能不支持
2. **权限处理**：首次使用定位时会弹出系统权限请求，这是正常的
3. **WebView缓存**：如需更新网页内容，清除APP数据或卸载重装
4. **HTTPS**：加载远程服务器建议使用 HTTPS

## 常见问题

### Q: 定位失败？
A: 检查：
- 是否允许定位权限
- 手机定位服务是否开启
- 是否安装了 Google Play Services

### Q: 网页显示空白？
A: 检查：
- HTML文件路径是否正确
- 文件是否复制到 assets/www 目录
- 是否有网络权限

### Q: 如何调试？
A: 
1. 连接手机，开启USB调试
2. 在 Android Studio 中查看 Logcat
3. 使用 Chrome DevTools 调试 WebView：
   ```
   chrome://inspect/#devices
   ```

## 发布到应用市场

### 华为应用市场
1. 注册华为开发者账号
2. 准备应用截图和描述
3. 上传签名后的 APK
4. 等待审核

### 小米应用商店
1. 注册小米开发者账号
2. 完善应用信息
3. 上传 APK
4. 等待审核

### 其他市场
流程类似，都需要：
- 开发者账号
- 应用签名
- 应用截图
- 应用描述
- 隐私政策链接

## 技术栈

- **Android SDK**: API 24+ (Android 7.0)
- **Target SDK**: API 34 (Android 14)
- **依赖库**:
  - AndroidX AppCompat
  - Google Play Services Location
  - Material Design Components

## 联系支持

如有问题，请查看项目文档或联系开发团队。
