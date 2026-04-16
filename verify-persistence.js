async function verifyPersistence() {
  const projectId = 'proj-1775203736057';
  const baseUrl = 'http://127.0.0.1:3800/api';
  
  try {
    console.log('--- Step 1: Initial Fetch ---');
    const res1 = await fetch(`${baseUrl}/project/${projectId}`);
    const data1 = await res1.json();
    const originalAssets = data1.data.digitalAssets || [];
    const originalMembers = data1.data.teamMembers || [];
    console.log('Original Assets count:', originalAssets.length);
    console.log('Original Members count:', originalMembers.length);
    console.log('Original Status:', data1.data.status);

    console.log('\n--- Step 2: Modify Data ---');
    const newMember = { id: 'tm-test-' + Date.now(), name: 'Test User', role: 'Tester' };
    const updatedData = {
      ...data1.data,
      teamMembers: [...originalMembers, newMember],
      status: '进行中',
      progress: 50
    };
    
    const res2 = await fetch(`${baseUrl}/save-project-detailed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    const data2 = await res2.json();
    console.log('Save result:', data2.success ? 'Success' : 'Failed');

    console.log('\n--- Step 3: Verify Persistence ---');
    const res3 = await fetch(`${baseUrl}/project/${projectId}`);
    const data3 = await res3.json();
    console.log('Verifying...');
    console.log('New Members count:', data3.data.teamMembers.length);
    console.log('New Status:', data3.data.status);
    console.log('New Progress:', data3.data.progress);
    
    const success = data3.data.teamMembers.some(m => m.name === 'Test User') && 
                    data3.data.status === '进行中' && 
                    data3.data.progress === 50;
    
    if (success) {
      console.log('\n✅ PERSISTENCE VERIFIED SUCCESSFULLY');
    } else {
      console.log('\n❌ PERSISTENCE VERIFICATION FAILED');
    }

  } catch (err) {
    console.error('Verification failed:', err.message);
  }
}

verifyPersistence();
