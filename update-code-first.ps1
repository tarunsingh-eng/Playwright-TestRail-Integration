# Step 1: Load .env credentials into memory
Get-Content .env | ForEach-Object {
	if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
		[Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
	}
}

# Step 2: Push result.xml to TestRail
trcli -y -h $env:TESTRAIL_HOST -u $env:TESTRAIL_USERNAME -p $env:TESTRAIL_API_KEY --project $env:TESTRAIL_PROJECT_NAME parse_junit -f "test-results/results.xml" --title "My first automation run"