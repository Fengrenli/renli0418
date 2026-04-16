const fs = require('fs');

const filePath = './server.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 查找生产环境的静态文件服务部分并替换
const oldPattern = /} else \{\s*\/\/ Serve static files in production from dist output\s*const distDir = path\.join\(__dirname, 'dist'\);\s*app\.use\('\/assets', express\.static\(path\.join\(distDir, 'assets'\)\)\);\s*\/\/ Serve uploads directory\s*app\.use\('\/uploads', express\.static\(path\.join\(__dirname, 'uploads'\)\)\);\s*\/\/ Serve compiled frontend files\s*app\.use\(express\.static\(distDir\)\);/;

const newCode = `} else {
  // Serve static files in production from dist output
  const distDir = path.join(__dirname, 'dist');
  
  // Serve assets with proper MIME types
  app.use('/assets', express.static(path.join(distDir, 'assets'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (path.endsWith('.json')) {
        res.setHeader('Content-Type', 'application/json');
      }
    }
  }));
  
  // Serve uploads directory
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.glb') || path.endsWith('.gltf')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      } else if (path.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
      }
    }
  }));
  
  // Serve compiled frontend files with proper MIME types
  app.use(express.static(distDir, {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    }
  }));`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newCode);
  fs.writeFileSync(filePath, content);
  console.log('✅ server.ts 修复成功！');
} else {
  console.log('⚠️  未找到匹配的模式，尝试简单替换...');
  // 简单替换
  const simpleOld = "app.use('/assets', express.static(path.join(distDir, 'assets')));";
  const simpleNew = `app.use('/assets', express.static(path.join(distDir, 'assets'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));`;
  
  if (content.includes(simpleOld)) {
    content = content.replace(simpleOld, simpleNew);
    
    // 同时替换主静态文件服务
    const mainOld = "app.use(express.static(distDir));";
    const mainNew = `app.use(express.static(distDir, {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    }
  }));`;
    content = content.replace(mainOld, mainNew);
    
    fs.writeFileSync(filePath, content);
    console.log('✅ server.ts 简单替换成功！');
  } else {
    console.log('❌ 未找到需要替换的代码');
  }
}
