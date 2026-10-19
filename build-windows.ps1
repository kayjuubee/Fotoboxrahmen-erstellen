$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    throw 'Zum Bauen wird Go 1.24 oder neuer benötigt: https://go.dev/dl/ . Die fertige EXE benötigt keine Go-Installation.'
}
go test ./...
if ($LASTEXITCODE -ne 0) { throw 'Tests fehlgeschlagen.' }
New-Item -ItemType Directory -Force dist | Out-Null
$previousOS = $env:GOOS
$previousArch = $env:GOARCH
$previousCGO = $env:CGO_ENABLED
try {
    $env:GOOS = 'windows'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'
    go build -trimpath -ldflags '-s -w -H=windowsgui' -o dist/Rahmenstudio.exe .
    if ($LASTEXITCODE -ne 0) { throw 'Windows-Build fehlgeschlagen.' }
} finally {
    $env:GOOS = $previousOS
    $env:GOARCH = $previousArch
    $env:CGO_ENABLED = $previousCGO
}
Write-Host 'Fertig: dist\Rahmenstudio.exe (Windows 10/11, 64 Bit)'
