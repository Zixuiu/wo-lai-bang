package com.wolaibang.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.os.Looper;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private WebView webView;
    private FusedLocationProviderClient fusedLocationClient;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    
    // 远程服务器地址（内网穿透地址）
    private static final String REMOTE_SERVER = "https://q41vxzlbsf.fy.takin.cc";
    // 是否启用资源本地化
    private static final boolean ENABLE_LOCAL_RESOURCE = true;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 初始化定位客户端
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        // 初始化WebView
        webView = findViewById(R.id.webview);
        
        // 配置WebView设置 - 优化缓存
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK); // 优先使用缓存
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        
        // 启用数据库缓存
        webSettings.setDatabaseEnabled(true);
        webSettings.setAppCacheEnabled(true);
        webSettings.setAppCachePath(getCacheDir().getAbsolutePath());
        
        // 图片延迟加载，先加载文字
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setBlockNetworkImage(false);
        
        // 添加JavaScript接口
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        // 设置WebViewClient - 拦截资源请求
        webView.setWebViewClient(new LocalResourceWebViewClient());

        // 设置WebChromeClient处理权限请求
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }
        });

        // 加载本地HTML
        loadLocalHtml();
    }
    
    /**
     * 加载本地HTML文件
     */
    private void loadLocalHtml() {
        // 将前端资源复制到assets目录
        copyFrontendToAssets();
        
        // 加载本地index.html
        webView.loadUrl("file:///android_asset/www/index.html");
    }
    
    /**
     * 将前端资源复制到assets目录（首次运行时）
     * 实际打包时，应该直接将frontend目录放入 app/src/main/assets/www/
     */
    private void copyFrontendToAssets() {
        // 这个方法在开发时手动复制资源到 assets/www/ 目录
        // 生产环境应该在 build.gradle 中配置自动复制
    }

    /**
     * 自定义WebViewClient，实现资源本地化
     */
    private class LocalResourceWebViewClient extends WebViewClient {
        
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // 旧版 API - 显示自定义错误页面
            showErrorPage(view);
        }
        
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            // 新版 API (Android 6.0+) - 显示自定义错误页面
            showErrorPage(view);
        }
        
        private void showErrorPage(final WebView view) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String errorHtml = getCustomErrorPage();
                    view.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null);
                }
            });
        }
        
        private String getCustomErrorPage() {
            return "<!DOCTYPE html>" +
                "<html lang=\"zh-CN\">" +
                "<head>" +
                "<meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\">" +
                "<title>网络连接失败</title>" +
                "<style>" +
                "* { margin: 0; padding: 0; box-sizing: border-box; }" +
                "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }" +
                ".container { background: white; border-radius: 20px; padding: 40px 30px; text-align: center; max-width: 320px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }" +
                ".icon { width: 80px; height: 80px; margin: 0 auto 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; }" +
                "h1 { color: #333; font-size: 20px; margin-bottom: 12px; font-weight: 600; }" +
                "p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }" +
                ".btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 14px 32px; border-radius: 25px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 500; }" +
                ".btn:active { opacity: 0.9; transform: scale(0.98); }" +
                ".offline-hint { margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; }" +
                ".offline-hint span { color: #999; font-size: 12px; }" +
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class=\"container\">" +
                "<div class=\"icon\">📱</div>" +
                "<h1>网络连接失败</h1>" +
                "<p>请检查您的网络设置，或尝试切换到其他网络环境</p>" +
                "<button class=\"btn\" onclick=\"location.reload()\">重新加载</button>" +
                "<div class=\"offline-hint\"><span>我来帮 App</span></div>" +
                "</div>" +
                "</body>" +
                "</html>";
        }
        
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            
            // 如果是本地文件，继续加载
            if (url.startsWith("file://")) {
                return false;
            }
            
            // 如果是远程页面，拦截并加载本地版本
            if (ENABLE_LOCAL_RESOURCE && url.startsWith(REMOTE_SERVER)) {
                String localUrl = convertToLocalUrl(url);
                if (localUrl != null) {
                    view.loadUrl(localUrl);
                    return true;
                }
            }
            
            view.loadUrl(url);
            return true;
        }
        
        /**
         * 拦截资源请求，优先从本地加载
         */
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (!ENABLE_LOCAL_RESOURCE) {
                return super.shouldInterceptRequest(view, request);
            }
            
            String url = request.getUrl().toString();
            
            // 只处理远程服务器的资源
            if (!url.startsWith(REMOTE_SERVER) && !url.startsWith("http")) {
                return super.shouldInterceptRequest(view, request);
            }
            
            // 尝试从本地加载资源
            WebResourceResponse localResource = loadLocalResource(url);
            if (localResource != null) {
                Log.d(TAG, "从本地加载资源: " + url);
                return localResource;
            }
            
            // 本地没有，走网络请求
            return super.shouldInterceptRequest(view, request);
        }
        
        /**
         * 尝试从本地加载资源
         */
        private WebResourceResponse loadLocalResource(String url) {
            try {
                String localPath = getLocalResourcePath(url);
                if (localPath == null) return null;
                
                InputStream inputStream = getAssets().open(localPath);
                String mimeType = getMimeType(url);
                
                return new WebResourceResponse(mimeType, "UTF-8", inputStream);
            } catch (IOException e) {
                return null;
            }
        }
        
        /**
         * 获取本地资源路径
         */
        private String getLocalResourcePath(String url) {
            // 解析URL路径
            String path = url.replace(REMOTE_SERVER, "");
            if (path.startsWith("/")) {
                path = path.substring(1);
            }
            
            // 映射到本地assets路径
            String localPath = "www/" + path;
            
            // 检查文件是否存在
            try {
                getAssets().open(localPath).close();
                return localPath;
            } catch (IOException e) {
                return null;
            }
        }
        
        /**
         * 获取MIME类型
         */
        private String getMimeType(String url) {
            if (url.endsWith(".css")) return "text/css";
            if (url.endsWith(".js")) return "application/javascript";
            if (url.endsWith(".html") || url.endsWith(".htm")) return "text/html";
            if (url.endsWith(".png")) return "image/png";
            if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
            if (url.endsWith(".gif")) return "image/gif";
            if (url.endsWith(".svg")) return "image/svg+xml";
            if (url.endsWith(".json")) return "application/json";
            return "text/plain";
        }
        
        /**
         * 将远程URL转换为本地URL
         */
        private String convertToLocalUrl(String remoteUrl) {
            String path = remoteUrl.replace(REMOTE_SERVER, "");
            if (path.startsWith("/")) {
                path = path.substring(1);
            }
            
            // 检查本地是否存在
            try {
                getAssets().open("www/" + path).close();
                return "file:///android_asset/www/" + path;
            } catch (IOException e) {
                return null;
            }
        }
    }

    /**
     * Android桥接类
     */
    public class AndroidBridge {
        
        /**
         * 获取当前位置
         */
        @JavascriptInterface
        public void getLocation() {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, 
                        Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    fetchLocation();
                } else {
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.ACCESS_FINE_LOCATION, 
                                       Manifest.permission.ACCESS_COARSE_LOCATION},
                            LOCATION_PERMISSION_REQUEST_CODE);
                }
            });
        }

        /**
         * 检查是否有定位权限
         */
        @JavascriptInterface
        public boolean hasLocationPermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this, 
                    Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }

        /**
         * 显示Toast消息
         */
        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
        
        /**
         * 预加载资源到本地缓存
         */
        @JavascriptInterface
        public void prefetchResources(String[] urls) {
            // 可以在这里实现资源预加载逻辑
        }
    }

    /**
     * 获取当前位置
     */
    @SuppressLint("MissingPermission")
    private void fetchLocation() {
        LocationRequest locationRequest = new LocationRequest.Builder(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10000)
                .setWaitForAccurateLocation(false)
                .setMinUpdateIntervalMillis(5000)
                .setMaxUpdateDelayMillis(15000)
                .build();

        fusedLocationClient.requestLocationUpdates(locationRequest, 
                new LocationCallback() {
                    @Override
                    public void onLocationResult(@NonNull LocationResult locationResult) {
                        Location location = locationResult.getLastLocation();
                        if (location != null) {
                            double latitude = location.getLatitude();
                            double longitude = location.getLongitude();
                            
                            String jsCode = String.format(
                                "onLocationSuccess(%f, %f)", 
                                latitude, longitude
                            );
                            webView.evaluateJavascript(jsCode, null);
                            
                            fusedLocationClient.removeLocationUpdates(this);
                        }
                    }
                }, 
                Looper.getMainLooper()
        );
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, 
                                          @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                fetchLocation();
            } else {
                webView.evaluateJavascript("onLocationDenied()", null);
                Toast.makeText(this, "需要定位权限才能提供本地服务", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
