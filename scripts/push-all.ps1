# 同时推送到 Gitee 与 GitHub 两个远程仓库
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\push-all.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\push-all.ps1 -Message "feat: 新增功能"
#
# 约定：
#   origin → Gitee（国内推送快，作为主仓库）
#   github → GitHub（镜像，CI 在 GitHub 上跑）
param(
  [string]$Message = '',
  [string]$Branch = 'main'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { $git = 'C:\Program Files\Git\cmd\git.exe' }

# 用专用密钥，避免和 SSH 默认密钥冲突
$key = Join-Path $root 'artifacts\git_key'
if (Test-Path $key) {
  $env:GIT_SSH_COMMAND = "ssh -i `"$key`" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
}

if ($Message) {
  & $git add -A
  & $git commit -m $Message
  if ($LASTEXITCODE -ne 0) { Write-Host '没有可提交的改动，继续推送' -ForegroundColor DarkGray }
}

$remotes = @(& $git remote)
if ($remotes.Count -eq 0) {
  Write-Host '还没有配置远程仓库，先执行：' -ForegroundColor Yellow
  Write-Host '  git remote add origin git@gitee.com:<账号>/gearflow.git'
  Write-Host '  git remote add github git@github.com:<账号>/gearflow.git'
  exit 1
}

$failed = @()
foreach ($remote in @('origin', 'github')) {
  if ($remotes -notcontains $remote) {
    Write-Host "跳过未配置的远程：$remote" -ForegroundColor DarkGray
    continue
  }
  Write-Host "`n==> 推送到 $remote" -ForegroundColor Cyan
  & $git push $remote "${Branch}:${Branch}"
  if ($LASTEXITCODE -ne 0) { $failed += $remote }
}

Write-Host ''
if ($failed.Count -gt 0) {
  Write-Host "推送失败：$($failed -join ', ')" -ForegroundColor Red
  exit 1
}
Write-Host '两个仓库都已推送完成。' -ForegroundColor Green
