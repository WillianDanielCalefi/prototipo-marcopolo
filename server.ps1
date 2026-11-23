$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

$rootPath = [System.IO.Path]::GetFullPath($PSScriptRoot) + [System.IO.Path]::DirectorySeparatorChar
$baseUrl = "http://localhost:8000/"
$brapiToken = $env:BRAPI_TOKEN
$testSymbols = @("PETR4", "VALE3", "MGLU3", "ITUB4")
$mimeTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".html" = "text/html; charset=utf-8"
  ".ico" = "image/x-icon"
  ".jpeg" = "image/jpeg"
  ".jpg" = "image/jpeg"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".svg" = "image/svg+xml"
  ".webp" = "image/webp"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($baseUrl)
$httpClient = [System.Net.Http.HttpClient]::new()
$httpClient.Timeout = [TimeSpan]::FromSeconds(30)

function Write-Response {
  param(
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [string]$Body,
    [string]$ContentType = "application/json; charset=utf-8",
    [hashtable]$Headers = @{}
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.Headers["Cache-Control"] = "no-store"
  foreach ($header in $Headers.GetEnumerator()) {
    $Context.Response.Headers[$header.Key] = $header.Value
  }
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Write-JsonResponse {
  param(
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [object]$Payload,
    [hashtable]$Headers = @{}
  )

  $body = ConvertTo-Json -InputObject $Payload -Depth 10 -Compress
  Write-Response -Context $Context -StatusCode $StatusCode -Body $body -Headers $Headers
}

function Handle-ApiRequest {
  param([System.Net.HttpListenerContext]$Context)

  $request = $Context.Request
  if ($request.HttpMethod -ne "GET") {
    Write-JsonResponse -Context $Context -StatusCode 405 -Payload @{
      error = $true
      message = "Metodo nao permitido."
      code = "METHOD_NOT_ALLOWED"
    }
    return
  }

  $requestedSymbols = $request.QueryString["symbols"]
  if ([string]::IsNullOrWhiteSpace($requestedSymbols)) {
    Write-JsonResponse -Context $Context -StatusCode 400 -Payload @{
      error = $true
      message = "Informe os ativos no parametro symbols."
      code = "BAD_REQUEST"
    }
    return
  }

  $symbols = @($requestedSymbols.Split(",") | ForEach-Object { $_.Trim().ToUpperInvariant() })
  $invalidSymbols = @($symbols | Where-Object { $_ -notmatch "^[A-Z0-9][A-Z0-9.-]{0,14}$" })
  if ($symbols.Count -gt 10 -or $invalidSymbols.Count -gt 0) {
    Write-JsonResponse -Context $Context -StatusCode 400 -Payload @{
      error = $true
      message = "O parametro symbols contem ativos invalidos ou excede o limite local de 10 ativos."
      code = "BAD_REQUEST"
    }
    return
  }

  if ([string]::IsNullOrWhiteSpace($brapiToken)) {
    $unsupportedSymbols = @($symbols | Where-Object { $_ -notin $testSymbols })
    if ($unsupportedSymbols.Count -gt 0) {
      Write-JsonResponse -Context $Context -StatusCode 401 -Payload @{
        error = $true
        message = "Configure BRAPI_TOKEN no ambiente do servidor para consultar esses ativos."
        code = "BRAPI_TOKEN_MISSING"
      }
      return
    }
  }

  $route = $request.Url.AbsolutePath
  $queryParts = @("symbols=$([System.Uri]::EscapeDataString(($symbols -join ',')))")
  if ($route -eq "/api/market/historical") {
    $range = $request.QueryString["range"]
    if ([string]::IsNullOrWhiteSpace($range)) {
      $range = "1mo"
    }
    if ($range -notin @("1mo", "3mo")) {
      Write-JsonResponse -Context $Context -StatusCode 400 -Payload @{
        error = $true
        message = "O periodo deve ser 1mo ou 3mo."
        code = "BAD_REQUEST"
      }
      return
    }
    $queryParts += "range=$([System.Uri]::EscapeDataString($range))"
    $queryParts += "interval=1d"
    $queryParts += "sortOrder=asc"
    $upstreamPath = "/historical"
  } else {
    $upstreamPath = "/quote"
  }

  $upstreamUri = "https://brapi.dev/api/v2/stocks$upstreamPath`?$($queryParts -join '&')"
  $upstreamRequest = [System.Net.Http.HttpRequestMessage]::new(
    [System.Net.Http.HttpMethod]::Get,
    $upstreamUri
  )
  if (-not [string]::IsNullOrWhiteSpace($brapiToken)) {
    $upstreamRequest.Headers.Authorization =
      [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $brapiToken)
  }

  $upstreamResponse = $null
  try {
    $upstreamResponse = $httpClient.SendAsync($upstreamRequest).GetAwaiter().GetResult()
    $body = $upstreamResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $headers = @{}
    $retryAfter = $upstreamResponse.Headers.RetryAfter
    if ($null -ne $retryAfter) {
      if ($null -ne $retryAfter.Delta) {
        $headers["Retry-After"] = [string][Math]::Ceiling($retryAfter.Delta.TotalSeconds)
      } elseif ($null -ne $retryAfter.Date) {
        $headers["Retry-After"] = $retryAfter.Date.ToUniversalTime().ToString("r")
      }
    }

    $contentType = "application/json; charset=utf-8"
    if ($null -ne $upstreamResponse.Content.Headers.ContentType) {
      $contentType = $upstreamResponse.Content.Headers.ContentType.ToString()
    }
    Write-Response -Context $Context `
      -StatusCode ([int]$upstreamResponse.StatusCode) `
      -Body $body `
      -ContentType $contentType `
      -Headers $headers
  } finally {
    if ($null -ne $upstreamResponse) {
      $upstreamResponse.Dispose()
    }
    $upstreamRequest.Dispose()
  }
}

function Handle-StaticRequest {
  param([System.Net.HttpListenerContext]$Context)

  if ($Context.Request.HttpMethod -ne "GET") {
    Write-Response -Context $Context -StatusCode 405 -Body "Method not allowed" -ContentType "text/plain; charset=utf-8"
    return
  }

  $requestPath = [System.Uri]::UnescapeDataString($Context.Request.Url.AbsolutePath)
  if ($requestPath -eq "/") {
    $requestPath = "/index.html"
  }
  $relativePath = $requestPath.TrimStart("/")
  $segments = $relativePath -split "[/\\]"
  if (@($segments | Where-Object { $_.StartsWith(".") }).Count -gt 0) {
    Write-Response -Context $Context -StatusCode 404 -Body "Not found" -ContentType "text/plain; charset=utf-8"
    return
  }

  $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootPath, $relativePath))
  if (-not $filePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Response -Context $Context -StatusCode 404 -Body "Not found" -ContentType "text/plain; charset=utf-8"
    return
  }

  $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
  if (-not $mimeTypes.ContainsKey($extension) -or -not [System.IO.File]::Exists($filePath)) {
    Write-Response -Context $Context -StatusCode 404 -Body "Not found" -ContentType "text/plain; charset=utf-8"
    return
  }

  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  $Context.Response.StatusCode = 200
  $Context.Response.ContentType = $mimeTypes[$extension]
  $Context.Response.ContentLength64 = $bytes.Length
  $Context.Response.Headers["Cache-Control"] = "no-store"
  $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Context.Response.Close()
}

function Handle-Request {
  param([System.Net.HttpListenerContext]$Context)

  $path = $Context.Request.Url.AbsolutePath
  if ($path -eq "/api/market/quote" -or $path -eq "/api/market/historical") {
    try {
      Handle-ApiRequest -Context $Context
    } catch {
      Write-Error ("Market proxy request failed: " + $_.Exception.Message)
      if (-not $Context.Response.OutputStream.CanWrite) {
        return
      }
      Write-JsonResponse -Context $Context -StatusCode 502 -Payload @{
        error = $true
        message = "Nao foi possivel consultar a brapi. Tente novamente mais tarde."
        code = "UPSTREAM_ERROR"
      }
    }
    return
  }

  try {
    Handle-StaticRequest -Context $Context
  } catch {
    Write-Error ("Static file request failed: " + $_.Exception.Message)
    if ($Context.Response.OutputStream.CanWrite) {
      Write-Response -Context $Context -StatusCode 500 -Body "Internal server error" -ContentType "text/plain; charset=utf-8"
    }
  }
}

try {
  $listener.Start()
  if ([string]::IsNullOrWhiteSpace($brapiToken)) {
    Write-Host "BRAPI_TOKEN is not set; only the documented public test tickers can be queried."
  } else {
    Write-Host "BRAPI_TOKEN is configured for server-side requests."
  }
  Write-Host "Serving the application at $baseUrl (Ctrl+C to stop)."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    Handle-Request -Context $context
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
  $httpClient.Dispose()
}
