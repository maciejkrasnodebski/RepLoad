$ErrorActionPreference = "Stop"

$androidDirectory = $PSScriptRoot
$projectRoot = Split-Path -Parent $androidDirectory
$localBuildTools = Join-Path $env:LOCALAPPDATA "RepLoadBuildTools"

$jdkCandidates = @()
if ($env:JAVA_HOME) {
    $jdkCandidates += $env:JAVA_HOME
}
$jdkCandidates += @(
    (Join-Path $localBuildTools "jdk-17.0.21+9"),
    (Join-Path $env:ProgramFiles "Java"),
    (Join-Path $env:ProgramFiles "Eclipse Adoptium")
)

$jdkPath = $null
foreach ($candidate in $jdkCandidates) {
    if (-not $candidate -or -not (Test-Path $candidate)) {
        continue
    }

    $javaExecutables = @()
    if (Test-Path (Join-Path $candidate "bin\java.exe")) {
        $javaExecutables += Join-Path $candidate "bin\java.exe"
    } else {
        $javaExecutables += Get-ChildItem -Path $candidate -Filter "java.exe" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Directory.Name -eq "bin" } |
            ForEach-Object { $_.FullName }
    }

    foreach ($java in $javaExecutables) {
        $candidateJdk = Split-Path -Parent (Split-Path -Parent $java)
        $releaseFile = Join-Path $candidateJdk "release"
        $releaseVersion = if (Test-Path $releaseFile) {
            Get-Content $releaseFile |
                Where-Object { $_ -match '^JAVA_VERSION=' } |
                Select-Object -First 1
        } else {
            $null
        }

        if ($releaseVersion -match '^JAVA_VERSION="?(\d+)') {
            $majorVersion = [int]$Matches[1]
            if ($majorVersion -ge 17) {
                $jdkPath = $candidateJdk
                break
            }
        }
    }

    if ($jdkPath) {
        break
    }
}

if (-not $jdkPath) {
    throw "RepLoad Android needs JDK 17 or newer. Install a JDK, then set JAVA_HOME to its folder and rerun this script."
}

$sdkCandidates = @(
    $env:ANDROID_SDK_ROOT,
    $env:ANDROID_HOME,
    (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
    (Join-Path $localBuildTools "android-sdk")
) | Where-Object { $_ }

$sdkPath = $sdkCandidates |
    Where-Object {
        (Test-Path (Join-Path $_ "platforms\android-35\android.jar")) -and
        (Test-Path (Join-Path $_ "build-tools\35.0.0\aapt.exe"))
    } |
    Select-Object -First 1

if (-not $sdkPath) {
    throw "Android SDK Platform 35 and Build Tools 35.0.0 are required. Set ANDROID_SDK_ROOT to the SDK folder with those packages installed."
}

$env:JAVA_HOME = $jdkPath
$env:PATH = (Join-Path $jdkPath "bin") + ";" + $env:PATH
$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath

Write-Host "Building RepLoad with JDK $jdkPath and Android SDK $sdkPath"
Push-Location $androidDirectory
try {
    & ".\gradlew.bat" --no-daemon assembleDebug
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle failed to build the APK (exit code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

$builtApk = Join-Path $androidDirectory "app\build\outputs\apk\debug\app-debug.apk"
$outputApk = Join-Path $projectRoot "RepLoad.apk"
if (-not (Test-Path $builtApk)) {
    throw "Gradle completed but the expected APK was not found at $builtApk."
}

Copy-Item -LiteralPath $builtApk -Destination $outputApk -Force
Write-Host "RepLoad APK created: $outputApk"
