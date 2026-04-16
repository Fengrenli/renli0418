@echo off
setlocal ENABLEDELAYEDEXPANSION

set "PROJECT_ROOT=E:\renli0418"
set "BASE_DIR=C:\Users\Admin\Desktop\material\new"

echo.
echo ================================
echo   Brand Materials Pipeline
echo ================================
echo.
echo Folders under %BASE_DIR%:
dir /b /ad "%BASE_DIR%"
echo.
echo NOTE: Folder name is OutputSlug. It must match OSS: materials / FOLDER / category / code.png
echo       Use the same FOLDER name as in the bucket (e.g. xiaolongkan, houtang).
echo.

set /p FOLDER_NAME=1) Folder name under material\new (e.g. houtang): 
if "%FOLDER_NAME%"=="" (
  echo [ERROR] Folder name is required.
  pause
  exit /b 1
)

set /p DB_BRAND_NAME=2) Brand name in database brands.name (empty = same as folder): 

set "EXCEL_DIR=%BASE_DIR%\%FOLDER_NAME%\material-excel"
set "PIC_DIR=%BASE_DIR%\%FOLDER_NAME%\PIC"

if "%DB_BRAND_NAME%"=="" set "DB_BRAND_NAME=%FOLDER_NAME%"

if not exist "%EXCEL_DIR%" (
  echo [ERROR] Excel dir not found: "%EXCEL_DIR%"
  pause
  exit /b 1
)

if not exist "%PIC_DIR%" (
  echo [ERROR] PIC dir not found: "%PIC_DIR%"
  pause
  exit /b 1
)

echo.
echo Using folder: %FOLDER_NAME%
echo Using DB brand name: %DB_BRAND_NAME%
echo.

echo [STEP 1/2] Generate brand CSV + SQL bundles...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\brand_rebuild.ps1" ^
  -OutputSlug "%FOLDER_NAME%" ^
  -BrandName "%DB_BRAND_NAME%" ^
  -ExcelDir "%EXCEL_DIR%" ^
  -PicDir "%PIC_DIR%" ^
  -ProjectRoot "%PROJECT_ROOT%"
if errorlevel 1 (
  echo [ERROR] brand_rebuild.ps1 failed at build step.
  pause
  exit /b 1
)

echo.
echo =========================================================
echo Import materials_cleaned_for_rds_*.csv in DMS, then press Y.
echo =========================================================
set /p RUN_DB=Run DB bind + image now? (Y/N): 
if /I not "%RUN_DB%"=="Y" (
  echo Skipped DB. Run this bat again later.
  pause
  exit /b 0
)

echo.
echo [STEP 2/2] DB bind + image + verify...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\brand_rebuild.ps1" ^
  -OutputSlug "%FOLDER_NAME%" ^
  -BrandName "%DB_BRAND_NAME%" ^
  -ExcelDir "%EXCEL_DIR%" ^
  -PicDir "%PIC_DIR%" ^
  -ProjectRoot "%PROJECT_ROOT%" ^
  -RunDb
if errorlevel 1 (
  echo [ERROR] brand_rebuild.ps1 failed at RunDb step.
  pause
  exit /b 1
)

echo.
echo [DONE] folder=%FOLDER_NAME% db_brand=%DB_BRAND_NAME%
pause
exit /b 0