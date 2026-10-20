
# build-msi.ps1 - Build LazeAway Windows Installer (.msi + .exe)
# Run in C:\Users\flana\LazeAway as Administrator PowerShell

Write-Host "=== LazeAway MSI Builder ===" -ForegroundColor Cyan

# 1. Check Node
$nodeVersion = node --version
Write-Host "Node version: $nodeVersion"
if (-not $nodeVersion) { Write-Host "Install Node 20+ first!" -ForegroundColor Red; exit 1 }

# 2. Clean
Write-Host "`nCleaning..." -ForegroundColor Yellow
Remove-Item -Recurse -Force dist, dist-electron, release, .tmp -ErrorAction SilentlyContinue

# 3. Install deps
Write-Host "`nInstalling deps (this rebuilds serialport)..." -ForegroundColor Yellow
npm ci
if ($LASTEXITCODE -ne 0) { npm install }

# 4. Typecheck + Build
Write-Host "`nBuilding..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

# 5. Build MSI + NSIS
Write-Host "`nBuilding Windows installers (NSIS .exe + MSI)..." -ForegroundColor Yellow
npx electron-builder --win nsis msi --x64

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "Check release folder:"
    Get-ChildItem release | Where-Object { $_.Name -like "*.msi" -or $_.Name -like "*.exe" } | Format-Table Name, Length
    Write-Host "`nYour MSI is: release/LazeAway-1.0.0.msi (or similar)"
    Write-Host "Your EXE is: release/LazeAway-1.0.0-Setup.exe"
} else {
    Write-Host "`nBuild failed - check errors above" -ForegroundColor Red
}
