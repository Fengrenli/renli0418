# Editor Integration Deployment (Baota)

This directory standardizes how to build and deploy `D:\Reditor-main/apps/editor` as a standalone Node service behind `/editor`.

## 1) Build editor release package (Windows build host)

Run in `D:\Reditor-main`:

```powershell
npm install
npx turbo run build --filter=editor
```

Expected output:

- `apps/editor/.next/standalone/apps/editor/server.js`
- `apps/editor/.next/static`
- `apps/editor/public`

Create a server upload bundle with this structure:

```text
rdesign-editor/
  apps/editor/server.js
  apps/editor/.next/static/*
  apps/editor/public/*
  node_modules/*
```

For standalone builds, copy from:

- `.next/standalone/*` to release root
- `.next/static` to `apps/editor/.next/static`
- `public` to `apps/editor/public`

## 2) Upload to Baota server

Recommended target:

- `/www/wwwroot/rdesign-editor/current`

Upload bundle content so that:

- `/www/wwwroot/rdesign-editor/current/apps/editor/server.js` exists

## 3) Configure process manager (PM2)

Use `ecosystem.editor.cjs` from this directory:

```bash
cd /www/wwwroot/rdesign-editor/current
pm2 start /www/wwwroot/renliyesheng/deploy-package/editor/ecosystem.editor.cjs
pm2 save
```

Health check:

```bash
curl "http://127.0.0.1:4302/api/health"
```

## 4) Icon and static asset integrity checks

After upload, run:

```bash
node /www/wwwroot/renliyesheng/deploy-package/editor/verify-editor-assets.mjs /www/wwwroot/rdesign-editor/current
```

The check ensures key editor icons remain available:

- `apps/editor/public/pascal.svg`
- `apps/editor/public/pascal-logo-shape.svg`
- `apps/editor/public/pascal-logo-full.svg`
- `apps/editor/public/globe.svg`
- `apps/editor/public/file-text.svg`
- `apps/editor/public/cursor.svg`

## 5) Desktop package publishing (download only)

Desktop artifacts from `D:\Reditor-main\apps\desktop\release-*` should be uploaded to:

- `/www/wwwroot/renliyesheng/downloads/rdesign/latest/`

Recommended filenames:

- `Rdesign-Setup-x.y.z.exe`
- `Rdesign-x.y.z-Portable.exe`

