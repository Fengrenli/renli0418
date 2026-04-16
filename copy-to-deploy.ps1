$src = "E:\renli0418"
$dst = "E:\renli0418\deploy-package"
Copy-Item "$src\components\ArchitectureNode.tsx" "$dst\components\ArchitectureNode.tsx" -Force
Copy-Item "$src\components\SceneParser.tsx" "$dst\components\SceneParser.tsx" -Force
Copy-Item "$src\rescan-uploads.js" "$dst\rescan-uploads.js" -Force
Write-Host "Files copied"
