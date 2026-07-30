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
        "Set-FormaInstallPath"
    )) {
    Assert-True (
        $null -ne (Get-Command $functionName -CommandType Function -ErrorAction SilentlyContinue)
    ) "install.ps1 must define $functionName."
}

$newInstallDir = "C:\Users\forma\.local\bin"
$initialPath = "C:\Tools;C:\Other"
$expectedPath = "C:\Tools;C:\Other;$newInstallDir"

$updatedPath = Update-FormaPathValue `
    -PathValue $initialPath `
    -InstallDir $newInstallDir
Assert-Equal $updatedPath $expectedPath "The install directory must be appended to PATH."

$idempotentPath = Update-FormaPathValue `
    -PathValue "$newInstallDir\;$newInstallDir;C:\Other" `
    -InstallDir $newInstallDir
Assert-Equal (
    $idempotentPath
) "$newInstallDir;C:\Other" "PATH normalization must deduplicate the install directory."

$emptyPath = Update-FormaPathValue `
    -PathValue "" `
    -InstallDir $newInstallDir
Assert-Equal $emptyPath $newInstallDir "An empty PATH must receive the install directory."

$runningOnWindows = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT
if ($runningOnWindows) {
    $originalUserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $originalProcessPath = $env:Path
    try {
        [Environment]::SetEnvironmentVariable(
            "Path",
            "C:\Tools",
            "User"
        )
        $env:Path = "C:\Windows\System32"

        $pathResult = Set-FormaInstallPath -InstallDir $newInstallDir

        Assert-True $pathResult.UserChanged "The persistent User PATH must be updated."
        Assert-True $pathResult.ProcessChanged "The current process PATH must be updated."
        Assert-Equal (
            [Environment]::GetEnvironmentVariable("Path", "User")
        ) "C:\Tools;$newInstallDir" "The User PATH must contain the install directory."
        Assert-Equal (
            $env:Path
        ) "C:\Windows\System32;$newInstallDir" "The current process PATH must be immediately usable."
    } finally {
        [Environment]::SetEnvironmentVariable("Path", $originalUserPath, "User")
        $env:Path = $originalProcessPath
    }
}

Write-Host "Windows installer tests passed."
