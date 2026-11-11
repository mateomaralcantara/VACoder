param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder"
)
$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
node ".\scripts\workers\run-orchestrator-worker.mjs"
