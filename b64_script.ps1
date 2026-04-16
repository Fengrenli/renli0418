$bytes = [System.IO.File]::ReadAllBytes("deploy-missing-files.tar.gz")
$b64 = [System.Convert]::ToBase64String($bytes)
$b64 | Out-File -FilePath "b64_full.txt" -Encoding ascii
