# UTF-8
$ErrorActionPreference = 'Stop'
$PIC = "C:\Users\Admin\Desktop\material\new\PIC"
New-Item -ItemType Directory -Path $PIC -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '五金杂件及工程灯具') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '厨房电器及设备') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '墙地瓷砖制品') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '定制中式建筑结构') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '定制活动家具及软装物料') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '定制玻璃钢雕塑') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '定制石材制品') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '定制金属制品') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '灯笼') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $PIC '砖瓦') -Force | Out-Null
Write-Host "OK: PIC 子目录已创建（或已存在）"
