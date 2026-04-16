# UTF-8
$ErrorActionPreference = 'Stop'
$PIC = "C:\Users\Admin\Desktop\material\new\PIC"
New-Item -ItemType Directory -Path $PIC -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '不锈钢') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '五金杂件') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '厨房设备') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '古建木结构') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '定制柜体') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '工程灯具') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '桌椅') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '灯笼') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '玻璃钢') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '瓷砖') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '石材') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '砖瓦') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '软装') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '锅具') -Force | Out-Null
Write-Host "OK: 已按 material-excel 文件名创建 PIC 子目录（或已存在）"
