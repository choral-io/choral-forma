param(
    [string] $Version = "latest",
    [string] $Repo = $(if ($env:FORMA_INSTALL_REPO) { $env:FORMA_INSTALL_REPO } else { "choral-io/choral-forma" }),
    [string] $InstallDir = $(if ($env:FORMA_INSTALL_DIR) { $env:FORMA_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".local\bin" }),
    [switch] $NoModifyPath
)

function ConvertTo-FormaComparablePath {
    param(
        [AllowNull()]
        [AllowEmptyString()]
        [string] $Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    $expandedPath = [Environment]::ExpandEnvironmentVariables(
        $Path.Trim().Trim([char] '"')
    )
    $normalizedPath = $expandedPath.Replace("/", "\").TrimEnd([char] "\")
    if ($normalizedPath -match "^[A-Za-z]:$") {
        return "$normalizedPath\"
    }
    return $normalizedPath
}

function Test-FormaPathEqual {
    param(
        [AllowNull()]
        [AllowEmptyString()]
        [string] $Left,
        [AllowNull()]
        [AllowEmptyString()]
        [string] $Right
    )

    return [StringComparer]::OrdinalIgnoreCase.Equals(
        (ConvertTo-FormaComparablePath $Left),
        (ConvertTo-FormaComparablePath $Right)
    )
}

function Update-FormaPathValue {
    param(
        [AllowNull()]
        [AllowEmptyString()]
        [string] $PathValue,
        [string] $InstallDir
    )

    $updatedEntries = [System.Collections.Generic.List[string]]::new()
    $installDirAdded = $false

    foreach ($entry in @($PathValue -split ";")) {
        if ([string]::IsNullOrWhiteSpace($entry)) {
            continue
        }

        if (Test-FormaPathEqual $entry $InstallDir) {
            if (-not $installDirAdded) {
                $updatedEntries.Add($InstallDir)
                $installDirAdded = $true
            }
            continue
        }

        $updatedEntries.Add($entry)
    }

    if (-not $installDirAdded) {
        $updatedEntries.Add($InstallDir)
    }

    return $updatedEntries -join ";"
}

function Set-FormaInstallPath {
    param(
        [string] $InstallDir
    )

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $updatedUserPath = Update-FormaPathValue `
        -PathValue $userPath `
        -InstallDir $InstallDir
    $userChanged = -not [StringComparer]::Ordinal.Equals(
        $userPath,
        $updatedUserPath
    )
    if ($userChanged) {
        [Environment]::SetEnvironmentVariable("Path", $updatedUserPath, "User")
    }

    $processPath = $env:Path
    $updatedProcessPath = Update-FormaPathValue `
        -PathValue $processPath `
        -InstallDir $InstallDir
    $processChanged = -not [StringComparer]::Ordinal.Equals(
        $processPath,
        $updatedProcessPath
    )
    if ($processChanged) {
        $env:Path = $updatedProcessPath
    }

    return [pscustomobject] @{
        UserChanged = $userChanged
        ProcessChanged = $processChanged
    }
}

if ($MyInvocation.InvocationName -eq ".") {
    return
}

$ErrorActionPreference = "Stop"

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "Choral Forma currently provides a Windows x64 release artifact only."
}

$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)

$asset = "forma-windows-x64.zip"
$baseUrl = "https://github.com/$Repo/releases"
if ($Version -eq "latest") {
    $downloadUrl = "$baseUrl/latest/download/$asset"
    $checksumUrl = "$baseUrl/latest/download/$asset.sha256"
} else {
    $downloadUrl = "$baseUrl/download/$Version/$asset"
    $checksumUrl = "$baseUrl/download/$Version/$asset.sha256"
}

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("forma-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

try {
    $archivePath = Join-Path $tmpDir $asset
    $checksumPath = Join-Path $tmpDir "$asset.sha256"
    $extractPath = Join-Path $tmpDir "extract"

    Write-Host "Downloading $asset from $Repo $Version"
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        $null = gh auth status 2>$null
        if ($LASTEXITCODE -eq 0) {
            if ($Version -eq "latest") {
                gh release download --repo $Repo --pattern $asset --pattern "$asset.sha256" --dir $tmpDir
            } else {
                gh release download $Version --repo $Repo --pattern $asset --pattern "$asset.sha256" --dir $tmpDir
            }
        } else {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
            Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumPath
        }
    } else {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
        Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumPath
    }

    $expectedHash = (Get-Content $checksumPath -Raw).Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)[0].ToLowerInvariant()
    $actualHash = (Get-FileHash -Algorithm SHA256 $archivePath).Hash.ToLowerInvariant()
    if ($expectedHash -ne $actualHash) {
        throw "checksum mismatch for $asset"
    }

    Expand-Archive -Path $archivePath -DestinationPath $extractPath -Force
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Copy-Item (Join-Path $extractPath "forma-windows-x64\bin\forma.exe") (Join-Path $InstallDir "forma.exe") -Force

    Write-Host "Installed forma to $(Join-Path $InstallDir "forma.exe")"
    if ($NoModifyPath) {
        Write-Host "PATH was not modified. Ensure $InstallDir is on PATH before running forma."
    } else {
        $pathResult = Set-FormaInstallPath -InstallDir $InstallDir
        if ($pathResult.UserChanged) {
            Write-Host "Added $InstallDir to the user PATH."
        } else {
            Write-Host "$InstallDir is already on the user PATH."
        }

        Write-Host "Run forma --version to verify the installation."
    }
} finally {
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
