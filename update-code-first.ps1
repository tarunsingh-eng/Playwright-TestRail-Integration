# ============================================
# 1. Load .env credentials
# ============================================

Get-Content (Join-Path $PSScriptRoot ".env") | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable(
            $matches[1].Trim(),
            $matches[2].Trim(),
            'Process'
        )
    }
}


# ============================================
# 2. Run Playwright
# ============================================

npx playwright test

# Playwright returns non-zero when tests fail.
# That's expected, so continue to TestRail.
if ($LASTEXITCODE -ne 0) {
    Write-Host "Playwright finished with test failures. Continuing to TestRail..."
}


# ============================================
# 3. Locate JUnit results
# ============================================

$ResultsDir = Join-Path $PSScriptRoot "test-results"
$ResultsFile = Join-Path $ResultsDir "results.xml"

if (-not (Test-Path $ResultsFile)) {
    Write-Host "ERROR: JUnit results not found:"
    Write-Host $ResultsFile
    exit 1
}

 ============================================
# 4. Make TestRail failure comment clean
# ============================================

[xml]$xml = Get-Content $ResultsFile

foreach ($testcase in $xml.SelectNodes("//testcase")) {

    $failure = $testcase.SelectSingleNode("failure")

    if ($null -ne $failure) {

        # KEEP <failure> so TestRail marks the test as Failed
        # but remove all Playwright failure details.
        $failure.InnerText = ""
        $failure.RemoveAttribute("message")
        $failure.RemoveAttribute("type")

        # Find or create <properties>
        $properties = $testcase.SelectSingleNode("properties")

        if ($null -eq $properties) {
            $properties = $xml.CreateElement("properties")
            $testcase.PrependChild($properties) | Out-Null
        }

        # Add clean TestRail comment
        $comment = $xml.CreateElement("property")
        $comment.SetAttribute(
            "name",
            "testrail_result_comment"
        )
        $comment.SetAttribute(
            "value",
            "Test case failed. Screenshot and log attached."
        )

        $properties.AppendChild($comment) | Out-Null
    }
}

$xml.Save($ResultsFile)

Write-Host "JUnit failure messages cleaned."

# ============================================
# 5. Upload results to TestRail
# ============================================

trcli -y `
    -h $env:TESTRAIL_HOST `
    -u $env:TESTRAIL_USERNAME `
    -p $env:TESTRAIL_API_KEY `
    --project $env:TESTRAIL_PROJECT_NAME `
    parse_junit `
    --case-matcher property `
    -f $ResultsFile `
    --run-id 37


# ============================================
# 6. Cleanup
# ============================================

if ($LASTEXITCODE -eq 0) {

    Write-Host ""
    Write-Host "TestRail upload successful."
    Write-Host "Cleaning test-results..."

    Remove-Item $ResultsDir -Recurse -Force

    Write-Host "Cleanup complete."
}
else {

    Write-Host ""
    Write-Host "TestRail upload FAILED."
    Write-Host "Keeping test-results for debugging."

    exit $LASTEXITCODE
}