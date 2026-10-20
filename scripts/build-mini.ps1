# 构建微信小程序，并打印产物路径
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\build-mini.ps1
#
# 构建完成后，在微信开发者工具里点「编译」（或 Ctrl+B）即可看到最新页面。
param(
  [switch]$OpenFolder
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root 'apps\uni-mobile'

if (-not (Test-Path (Join-Path $app 'node_modules'))) {
  Write-Host '首次构建，正在安装依赖…' -ForegroundColor Yellow
  Push-Location $app
  npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
  Pop-Location
}

Write-Host "`n==> 编译小程序" -ForegroundColor Cyan

# 本地预填登录账号（可选）：artifacts\dev-login.txt 里写 账号|密码
# 该目录已被 .gitignore 忽略，凭据不会进仓库
$credFile = Join-Path $root 'artifacts\dev-login.txt'
if (Test-Path $credFile) {
  $line = (Get-Content $credFile -Raw).Trim()
  $parts = $line -split '\|', 2
  if ($parts.Count -eq 2 -and $parts[0].Trim()) {
    $env:VITE_DEV_USER = $parts[0].Trim()
    $env:VITE_DEV_PWD = $parts[1]
    Write-Host "    已注入本地预填账号：$($parts[0].Trim())（仅本次构建，不写入仓库）" -ForegroundColor DarkGray
  }
} else {
  Write-Host '    未找到 artifacts\dev-login.txt，登录页不预填密码' -ForegroundColor DarkGray
}

Push-Location $app
npm run build:mp-weixin
$code = $LASTEXITCODE
Pop-Location

if ($code -ne 0) {
  Write-Host "构建失败，退出码 $code" -ForegroundColor Red
  exit $code
}

$dist = Join-Path $app 'dist\build\mp-weixin'
Write-Host ''
Write-Host "产物目录：$dist" -ForegroundColor Green
Write-Host '下一步：微信开发者工具里点右上角 ↻（或 Ctrl+B）重新编译。'
Write-Host '（如果工具里还没导入过这个目录，用「导入项目」选上面的路径。）'

if ($OpenFolder) { Start-Process explorer.exe $dist }
