$body = @{
    id = "proj-1775203736057"
    name = "小龙坎朝鲜店"
    digitalAssets = @(
        @{
            id = "asset-test-001"
            name = "test-model.glb"
            type = "model"
            url = "/uploads/proj-1775203736057/test-model.glb"
            size = "2.5 MB"
            uploadDate = "2026-04-09"
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "请求体:"
Write-Host $body
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3800/api/save-project-detailed" -Method POST -ContentType "application/json" -Body $body
    Write-Host "响应状态: $($response.StatusCode)"
    Write-Host "响应内容:"
    Write-Host $response.Content
} catch {
    Write-Host "错误: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $errorBody = $reader.ReadToEnd()
        Write-Host "错误响应: $errorBody"
    }
}
