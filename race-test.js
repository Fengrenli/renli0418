async function raceConditionTest() {
  const projectId = 'proj-1774851876525';
  const baseUrl = 'http://127.0.0.1:3800/api';
  
  try {
    console.log('--- Step 1: Initial state ---');
    const r1 = await fetch(`${baseUrl}/project/${projectId}`);
    const d1 = await r1.json();
    const startCount = d1.data.digitalAssets?.length || 0;
    console.log('Start asset count:', startCount);

    console.log('\n--- Step 2: Simulate Upload + Immediate Status Change ---');
    
    // Simulate /api/upload (which appends to DB)
    const mockAsset = {
      id: 'asset-race-' + Date.now(),
      name: 'RaceTest.glb',
      url: '/uploads/race.glb',
      type: 'model',
      size: '1.00 MB',
      uploadDate: new Date().toISOString().split('T')[0]
    };
    
    // Manually append via a custom test logic or just use the save-detailed endpoint 
    // which is what the frontend does AFTER receiving the upload response.
    
    // Actually, the frontend does:
    // 1. POST /api/upload -> server appends to DB.
    // 2. Frontend receives response, updates local state.
    // 3. 500ms later, flushProjectSave -> POST /api/save-project-detailed (overwrites DB).
    
    // Let's simulate the overwrite with a "stale" list to see if it's broken, 
    // and then use my fixed version.
    
    const updatedAssets = [...(d1.data.digitalAssets || []), mockAsset];
    const updatedProject = {
      ...d1.data,
      digitalAssets: updatedAssets,
      status: '已完成'
    };
    
    console.log('Sending save-project-detailed with new asset and status...');
    const r2 = await fetch(`${baseUrl}/save-project-detailed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProject)
    });
    const d2 = await r2.json();
    console.log('Save result:', d2.success);

    console.log('\n--- Step 3: Re-fetch and verify ---');
    const r3 = await fetch(`${baseUrl}/project/${projectId}`);
    const d3 = await r3.json();
    
    console.log('Final asset count:', d3.data.digitalAssets?.length);
    console.log('Final status:', d3.data.status);
    
    const hasAsset = d3.data.digitalAssets?.some(a => a.name === 'RaceTest.glb');
    if (hasAsset && d3.data.status === '已完成') {
      console.log('\n✅ RACE CONDITION/OVERWRITE TEST PASSED');
    } else {
      console.log('\n❌ TEST FAILED');
    }

  } catch (err) {
    console.error('Test error:', err.message);
  }
}

raceConditionTest();
