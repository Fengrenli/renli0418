import fs from 'fs';
import path from 'path';

async function uploadToProject(projectId) {
  const filePath = 'test_asset_manual.glb';
  fs.writeFileSync(filePath, 'dummy content');
  
  const formData = new FormData();
  const file = new Blob(['dummy content'], { type: 'model/gltf-binary' });
  formData.append('file', file, 'test_asset_manual.glb');
  
  const baseUrl = 'http://127.0.0.1:3800/api';
  try {
    console.log(`Uploading to ${projectId}...`);
    const res = await fetch(`${baseUrl}/upload?projectId=${projectId}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log('Upload result:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('Verifying in project detail...');
      const res2 = await fetch(`${baseUrl}/project/${projectId}`);
      const data2 = await res2.json();
      const hasAsset = data2.data.digitalAssets.some(a => a.name === 'test_asset_manual.glb');
      if (hasAsset) {
        console.log('✅ ASSET VERIFIED IN DETAIL API');
      } else {
        console.log('❌ ASSET MISSING IN DETAIL API');
      }
    }
  } catch (err) {
    console.error('Upload failed:', err.message);
  }
}

uploadToProject('proj-1775203993102');
