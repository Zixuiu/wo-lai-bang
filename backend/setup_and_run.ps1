# 自动查找Python路径
$pythonPath = $null

# 常见Python安装路径
$commonPaths = @(
    "C:\Users\$env:USERNAME\AppData\Local\Microsoft\WindowsApps\python.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\python.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python310\python.exe",
    "C:\Program Files\Python311\python.exe",
    "C:\Program Files\Python310\python.exe",
    "python.exe"
)

# 查找可用的Python
foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        $pythonPath = $path
        break
    }
}

# 如果找不到，尝试从环境变量查找
if (-not $pythonPath) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $pythonPath = $pythonCmd.Source
    }
}

# 检查Python是否存在
if ($pythonPath -and (Test-Path $pythonPath)) {
    Write-Host "找到Python: $pythonPath" -ForegroundColor Green

    # 安装依赖
    Write-Host "正在安装依赖..." -ForegroundColor Yellow
    & $pythonPath -m pip install -r requirements.txt --user 2>&1

    # 启动应用
    Write-Host "启动后端服务..." -ForegroundColor Green
    Write-Host "服务将运行在 http://localhost:5000" -ForegroundColor Cyan
    Write-Host "按Ctrl+C停止服务" -ForegroundColor Gray
    Write-Host ""
    & $pythonPath app.py
} else {
    Write-Host "未找到Python，请从Microsoft Store安装Python 3.11" -ForegroundColor Red
    Write-Host "访问: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "按任意键退出..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
