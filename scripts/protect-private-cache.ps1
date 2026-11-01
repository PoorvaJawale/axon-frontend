$ErrorActionPreference = 'Stop'
$axonWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($axonWorkspace -ne 'D:\axon-frontend') { throw 'Review the private-folder targets before using this on another workspace.' }
$axonOwner = [Security.Principal.WindowsIdentity]::GetCurrent().User
$axonKeyOwner = (Get-Acl -LiteralPath (Join-Path $axonWorkspace '.cache\recovery-keys')).Owner
if ($axonKeyOwner -ne [Security.Principal.WindowsIdentity]::GetCurrent().Name) { throw 'Run as the existing desktop recovery-key owner; never replace another owner.' }
$axonFolders = @('recovery-keys', 'production-backups', 'production-deployment', 'offsite-transfer', 'recovery', 'staging', 'vercel-auth')
$axonSnapshots = @()
foreach ($axonName in $axonFolders) {
  $axonTarget = [IO.Path]::GetFullPath((Join-Path $axonWorkspace ".cache\$axonName"))
  if (-not $axonTarget.StartsWith("$axonWorkspace\.cache\", [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected target' }
  if (-not (Test-Path -LiteralPath $axonTarget)) { continue }
  if ((Get-Item -LiteralPath $axonTarget).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Private folder must not be a junction or symlink.' }
  $axonOriginalAcl = Get-Acl -LiteralPath $axonTarget
  $axonSnapshots += [pscustomobject]@{path=$axonTarget;sddl=$axonOriginalAcl.Sddl}
}
$axonSnapshotPath = Join-Path $axonWorkspace ('.cache\private-acls-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$axonSnapshots | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $axonSnapshotPath
foreach ($axonSnapshot in $axonSnapshots) {
  # icacls updates the DACL only; Set-Acl can request unavailable SACL privileges.
  $axonOwnerGrant = '*' + $axonOwner.Value + ':(OI)(CI)F'
  & icacls.exe $axonSnapshot.path /inheritance:r /grant:r $axonOwnerGrant '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Private DACL update failed.' }
  $axonVerified = Get-Acl -LiteralPath $axonSnapshot.path
  if (-not $axonVerified.AreAccessRulesProtected -or $axonVerified.Access.Count -ne 3) { throw 'Private ACL verification failed.' }
}
[pscustomobject]@{protectedFolders=$axonSnapshots.Count;ownerSid=$axonOwner.Value;otherLocalUserGroupsRemoved=$true;secretValuesPrinted=$false} | ConvertTo-Json
