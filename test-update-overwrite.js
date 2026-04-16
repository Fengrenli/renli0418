async function testUpdateOverwrite() {
  const projectId = 'proj-1775203993102';
  const baseUrl = 'http://127.0.0.1:3800/api';
  
  try {
    console.log('--- Step 1: Initial state ---');
    const r1 = await fetch(`${baseUrl}/project/${projectId}`);
    const d1 = await r1.json();
    console.log('Current Assets count:', d1.data.digitalAssets.length);
    console.log('Current Progress:', d1.data.progress);

    console.log('\n--- Step 2: Update Progress ---');
    const updatedData = {
      ...d1.data,
      progress: 75,
      status: '进行中'
    };
    
    const r2 = await fetch(`${baseUrl}/save-project-detailed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const d2 = await r2.json();
    console.log('Save result:', d2.success);

    console.log('\n--- Step 3: Verify Assets still exist ---');
    const r3 = await fetch(`${baseUrl}/project/${projectId}`);
    const d3 = await r3.json();
    console.log('Final Assets count:', d3.data.digitalAssets.length);
    console.log('Final Progress:', d3.data.progress);
    
    if (d3.data.digitalAssets.length === d1.data.digitalAssets.length && d3.data.progress === 75) {
      console.log('\n✅ UPDATE OVERWRITE TEST PASSED');
    } else {
      console.log('\n❌ TEST FAILED');
    }

  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testUpdateOverwrite();
