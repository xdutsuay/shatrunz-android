$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $repoRoot '.tooling'
$localSdk = Join-Path $toolRoot 'android-sdk'
$localRustup = Join-Path $toolRoot 'rustup'
$localCargo = Join-Path $toolRoot 'cargo'
$localWasmPack = Join-Path $localCargo 'bin\wasm-pack.exe'

if (-not $env:ANDROID_HOME -and (Test-Path -LiteralPath $localSdk)) {
    $env:ANDROID_HOME = $localSdk
}
if (-not $env:ANDROID_HOME) {
    throw 'Set ANDROID_HOME to an installed Android SDK, or install the project-local SDK under .tooling/android-sdk.'
}
if (-not $env:ANDROID_SDK_ROOT) {
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}

if (-not $env:ANDROID_USER_HOME -and (Test-Path -LiteralPath (Join-Path $toolRoot 'android-user'))) {
    $env:ANDROID_USER_HOME = Join-Path $toolRoot 'android-user'
}
if (-not $env:RUSTUP_HOME -and (Test-Path -LiteralPath $localRustup)) {
    $env:RUSTUP_HOME = $localRustup
}
if (-not $env:CARGO_HOME -and (Test-Path -LiteralPath $localCargo)) {
    $env:CARGO_HOME = $localCargo
}
if ($env:CARGO_HOME) {
    $env:PATH = "$(Join-Path $env:CARGO_HOME 'bin');$env:PATH"
}

$pinnedToolchain = Join-Path $localRustup 'toolchains\1.94.1-x86_64-pc-windows-msvc\bin'
if (Test-Path -LiteralPath $pinnedToolchain) {
    $env:PATH = "$pinnedToolchain;$env:PATH"
}
if (-not $env:WASM_PACK -and (Test-Path -LiteralPath $localWasmPack)) {
    $env:WASM_PACK = $localWasmPack
}

$wrapper = Join-Path $repoRoot 'android\gradlew.bat'
if (-not (Test-Path -LiteralPath $wrapper)) {
    throw 'The checked-in Gradle wrapper is missing from android/.'
}

Push-Location (Join-Path $repoRoot 'android')
try {
    & $wrapper :app:assembleDebug
    if ($LASTEXITCODE -ne 0) {
        throw "Android debug build failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

Write-Output (Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk')
