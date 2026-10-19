# 一键发布：测试 → 构建 → 打包 → 上传 → 滚动发布 → 冒烟验证
#
# 用法：
#   pwsh scripts/release.ps1                # 完整流程
#   pwsh scripts/release.ps1 -SkipTests     # 跳过测试
#   pwsh scripts/release.ps1 -DryRun        # 只构建打包，不上传
#
# 依赖：Node 24、Windows 自带 OpenSSH（C:\Windows\System32\OpenSSH\ssh.exe）、
#       以及部署私钥（默认 artifacts/deploy_key）。
param(
  [string]$Host_ = '182.92.126.12',
  [string]$User  = 'root',
  [string]$KeyPath = 'artifacts\deploy_key',
  [switch]$SkipTests,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$ssh  = "$env:WINDIR\System32\OpenSSH\ssh.exe"
$scp  = "$env:WINDIR\System32\OpenSSH\scp.exe"
$bundle = 'artifacts\release.tar.gz'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

Step '1/7 后端编译'
npm run build --workspace=@gearflow/server
if ($LASTEXITCODE -ne 0) { throw '后端编译失败' }

if (-not $SkipTests) {
  Step '2/7 单元测试'
  node --test apps/server/test/*.test.cjs
  if ($LASTEXITCODE -ne 0) { throw '测试未通过，发布中止' }
} else {
  Step '2/7 单元测试（已跳过）'
}

Step '3/7 前端构建'
npm run build --workspace=@gearflow/customer-web
if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }

Step '4/7 打包'
New-Item -ItemType Directory -Force -Path artifacts | Out-Null
if (Test-Path $bundle) { Remove-Item $bundle -Force }
tar -czf $bundle --exclude=node_modules --exclude=.git --exclude=artifacts `
    --exclude=backups --exclude=certs --exclude=certbot-www `
    package.json package-lock.json apps packages infra
$size = [math]::Round((Get-Item $bundle).Length / 1MB, 1)
Write-Host "    产物 $bundle ($size MB)"

if ($DryRun) {
  Step 'DryRun：跳过上传与发布'
  return
}

Step '5/7 上传'
& $scp -i $KeyPath -o StrictHostKeyChecking=accept-new $bundle "${User}@${Host_}:/opt/gearflow-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { throw '上传失败' }

Step '6/7 滚动发布'
$remote = @'
set -e
cd /opt/gearflow
tar -xzf /opt/gearflow-deploy.tar.gz
docker compose -f infra/docker-compose.prod.yml up -d --build
'@
& $ssh -i $KeyPath "${User}@${Host_}" $remote
if ($LASTEXITCODE -ne 0) { throw '远程发布失败' }

Step '7/7 冒烟验证'
Start-Sleep -Seconds 6
$health = & $ssh -i $KeyPath "${User}@${Host_}" "curl -fsS -m 10 http://127.0.0.1/api/health"
Write-Host "    本机健康检查: $health"
$code = (& curl.exe -sS -o NUL -w '%{http_code}' --max-time 15 https://timomo.store/ 2>&1)
Write-Host "    外网 HTTPS: $code"

Write-Host "`n发布完成。" -ForegroundColor Green
