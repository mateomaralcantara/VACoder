param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder"
)
$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
node ".\scripts\run-orchestrator-worker.mjs"
