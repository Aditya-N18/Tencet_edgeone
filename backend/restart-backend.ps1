# Free port 8080 and start the Senior Guardian backend API.
# Usage: .\restart-backend.ps1

$port = 8080
$connections = netstat -ano | Select-String ":$port\s+.*LISTENING"

if ($connections) {
    $processId = ($connections.ToString().Trim() -split '\s+')[-1]
    Write-Host "Stopping old backend (PID $processId)..." -ForegroundColor Yellow
    taskkill /PID $processId /F | Out-Null
    Start-Sleep -Seconds 1
}

Write-Host "Starting backend on http://localhost:$port" -ForegroundColor Green
Write-Host "Endpoints: /health  /frame/latest  /pipeline/start  /pipeline/stop" -ForegroundColor Cyan
.\.venv\Scripts\python.exe main.py
