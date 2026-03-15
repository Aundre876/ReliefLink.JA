# Clean install: remove node_modules and lockfile, then npm install.
# Run from project root. If you get EPERM, close Cursor/IDE and run PowerShell as Administrator.
Set-Location $PSScriptRoot\..

if (Test-Path "node_modules") {
  Write-Host "Removing node_modules..."
  Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
  if (Test-Path "node_modules") {
    Write-Error "Could not remove node_modules (EPERM). Close Cursor/VS Code and other terminals, then run this script again as Administrator."
    exit 1
  }
}

if (Test-Path "package-lock.json") {
  Write-Host "Removing package-lock.json..."
  Remove-Item -Force "package-lock.json"
}

Write-Host "Running npm install..."
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. Run: npx expo start"
