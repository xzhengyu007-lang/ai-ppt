param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Repos
)
# 用法: pwsh -File scripts/gh-probe.ps1 gitbrent/PptxGenJS scanny/python-pptx
# 输出 TSV: repo  stars  license  pushed_at  language  archived  open_issues  created_at  description
$ErrorActionPreference = 'Continue'
foreach ($r in $Repos) {
  $json = gh api "repos/$r" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $json) {
    "{0}`tERROR`tgh api failed" -f $r
    continue
  }
  $o = $json | ConvertFrom-Json
  $lic = if ($o.license) { $o.license.spdx_id } else { 'NOASSERTION' }
  "{0}`t{1}`t{2}`t{3}`t{4}`t{5}`t{6}`t{7}`t{8}" -f `
    $o.full_name, $o.stargazers_count, $lic, $o.pushed_at, $o.language, `
    $o.archived, $o.open_issues_count, $o.created_at, ($o.description -replace "`t", ' ')
}
