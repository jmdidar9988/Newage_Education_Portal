# Lightweight PowerShell HTTP Server
# Runs natively on Windows without requiring Node/Python.

param (
    [int]$port = 8080
)

$listener = New-Object System.Net.HttpListener
$started = $false

while (-not $started -and $port -lt 8100) {
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        $started = $true
    } catch {
        $port++
    }
}

if (-not $started) {
    Write-Error "Failed to start HTTP listener on ports 8080-8100."
    exit 1
}

try {
    Write-Host "========================================="
    Write-Host " Newage Education Web Portal Local Server "
    Write-Host " Running at: http://localhost:$port/      "
    Write-Host "========================================="
    Write-Host "Press Ctrl+C to stop the server."
    Write-Host ""

    # Launch browser automatically
    Start-Process "http://localhost:$port/login.html"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/login.html"
        }

        # Clean path and combine with script root directory
        $cleanPath = $urlPath.Replace("/", "\").TrimStart("\")
        $filePath = Join-Path $PSScriptRoot $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Determine Content Type
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "text/plain"
            if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $contentType = "text/css" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "Served: $urlPath [200 OK]"
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found")
            $response.ContentType = "text/plain"
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            Write-Host "Not Found: $urlPath [404]"
        }
        $response.Close()
    }
} catch {
    Write-Error $_
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
