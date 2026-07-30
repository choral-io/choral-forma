$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$installerPath = Join-Path $repositoryRoot "install.ps1"

function Assert-Equal {
    param(
        [AllowNull()]
        [object] $Actual,
        [AllowNull()]
        [object] $Expected,
        [string] $Message
    )

    if ($Actual -ne $Expected) {
        throw "$Message`nExpected: $Expected`nActual:   $Actual"
    }
}

function Assert-True {
    param(
        [bool] $Condition,
        [string] $Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

$tokens = $null
$parseErrors = $null
$installerAst = [System.Management.Automation.Language.Parser]::ParseFile(
    $installerPath,
    [ref] $tokens,
    [ref] $parseErrors
)
Assert-Equal $parseErrors.Count 0 "install.ps1 must parse without errors."

$installDirParameter = $installerAst.ParamBlock.Parameters |
    Where-Object { $_.Name.VariablePath.UserPath -eq "InstallDir" }
Assert-True ($null -ne $installDirParameter) "install.ps1 must declare InstallDir."
Assert-True (
    $installDirParameter.DefaultValue.Extent.Text.Contains('.local\bin')
) "The default Windows install directory must be %USERPROFILE%\.local\bin."

$noModifyPathParameter = $installerAst.ParamBlock.Parameters |
    Where-Object { $_.Name.VariablePath.UserPath -eq "NoModifyPath" }
Assert-True ($null -ne $noModifyPathParameter) "install.ps1 must support -NoModifyPath."

$pathMutationGuard = $installerAst.FindAll(
    {
        param($node)
        if ($node -isnot [System.Management.Automation.Language.IfStatementAst]) {
            return $false
        }
        return (
            $node.Extent.Text.Contains('$NoModifyPath') -and
            $node.Extent.Text.Contains("Set-FormaInstallPath")
        )
    },
    $true
) | Select-Object -First 1
Assert-True (
    $null -ne $pathMutationGuard
) "-NoModifyPath must guard the persistent and current-process PATH mutation."

$functionDefinitions = $installerAst.FindAll(
    {
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    },
    $true
)
foreach ($functionDefinition in $functionDefinitions) {
    . ([scriptblock]::Create($functionDefinition.Extent.Text))
}

foreach ($functionName in @(
        "Update-FormaPathValue",
        "Set-FormaInstallPath",
        "Remove-LegacyFormaInstall"
    )) {
    Assert-True (
        $null -ne (Get-Command $functionName -CommandType Function -ErrorAction SilentlyContinue)
    ) "install.ps1 must define $functionName."
}

$newInstallDir = "C:\Users\forma\.local\bin"
$legacyInstallDirs = @(
    "C:\Users\forma\AppData\Local\Programs\Choral\Forma\bin",
    "C:\Users\forma\AppData\Local\Programs\ChoralForma\bin"
)
$initialPath = "C:\Tools;$($legacyInstallDirs[0]);C:\Other"
$expectedPath = "C:\Tools;$newInstallDir;C:\Other"

$updatedPath = Update-FormaPathValue `
    -PathValue $initialPath `
    -InstallDir $newInstallDir `
    -LegacyInstallDirs $legacyInstallDirs
Assert-Equal $updatedPath $expectedPath "The legacy PATH entry must be replaced in place."

$idempotentPath = Update-FormaPathValue `
    -PathValue "$newInstallDir\;$($legacyInstallDirs[0]);$($legacyInstallDirs[1]);$newInstallDir;C:\Other" `
    -InstallDir $newInstallDir `
    -LegacyInstallDirs $legacyInstallDirs
Assert-Equal (
    $idempotentPath
) "$newInstallDir;C:\Other" "PATH normalization must remove all legacy entries and remain idempotent."

$emptyPath = Update-FormaPathValue `
    -PathValue "" `
    -InstallDir $newInstallDir `
    -LegacyInstallDirs $legacyInstallDirs
Assert-Equal $emptyPath $newInstallDir "An empty PATH must receive the install directory."

$cleanupRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    "forma-installer-test-" + [System.Guid]::NewGuid().ToString("N")
)
$cleanupLegacyDir = Join-Path $cleanupRoot "ChoralForma\bin"
try {
    New-Item -ItemType Directory -Force -Path $cleanupLegacyDir | Out-Null
    Set-Content -Path (Join-Path $cleanupLegacyDir "forma.exe") -Value "owned"
    Set-Content -Path (Join-Path $cleanupLegacyDir "keep.txt") -Value "unknown"

    Remove-LegacyFormaInstall -LegacyInstallDir $cleanupLegacyDir

    Assert-True (
        -not (Test-Path -LiteralPath (Join-Path $cleanupLegacyDir "forma.exe"))
    ) "The legacy Forma executable must be removed."
    Assert-True (
        Test-Path -LiteralPath (Join-Path $cleanupLegacyDir "keep.txt")
    ) "Unknown files in the legacy directory must be preserved."
    Assert-True (
        Test-Path -LiteralPath $cleanupLegacyDir
    ) "A non-empty legacy directory must be preserved."

    Remove-Item -LiteralPath (Join-Path $cleanupLegacyDir "keep.txt") -Force
    Remove-LegacyFormaInstall -LegacyInstallDir $cleanupLegacyDir
    Assert-True (
        -not (Test-Path -LiteralPath $cleanupLegacyDir)
    ) "An empty legacy bin directory must be removed."
    Assert-True (
        -not (Test-Path -LiteralPath (Split-Path -Parent $cleanupLegacyDir))
    ) "An empty legacy product directory must be removed."
} finally {
    Remove-Item -LiteralPath $cleanupRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$runningOnWindows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
if ($runningOnWindows) {
    $originalUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $originalProcessPath = $env:Path
    try {
        [Environment]::SetEnvironmentVariable(
            "Path",
            "C:\Tools;$($legacyInstallDirs[0]);$($legacyInstallDirs[1])",
            "User"
        )
        $env:Path = "C:\Windows\System32;$($legacyInstallDirs[0]);$($legacyInstallDirs[1])"

        $pathResult = Set-FormaInstallPath `
            -InstallDir $newInstallDir `
            -LegacyInstallDirs $legacyInstallDirs

        Assert-True $pathResult.UserChanged "The persistent User PATH must be updated."
        Assert-True $pathResult.ProcessChanged "The current process PATH must be updated."
        Assert-Equal (
            [Environment]::GetEnvironmentVariable("Path", "User")
        ) "C:\Tools;$newInstallDir" "The User PATH must contain the new install directory."
        Assert-Equal (
            $env:Path
        ) "C:\Windows\System32;$newInstallDir" "The current process PATH must be immediately usable."
    } finally {
        [Environment]::SetEnvironmentVariable("Path", $originalUserPath, "User")
        $env:Path = $originalProcessPath
    }
}

Write-Host "Windows installer tests passed."
