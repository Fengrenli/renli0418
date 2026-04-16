async function finalVerify() {
  const projectId = 'proj-1774851876525'; // 科隆 小龙坎 (has assets)
  const baseUrl = 'http://127.0.0.1:3800/api';
  
  try {
    console.log('--- Checking Digital Assets ---');
    const res1 = await fetch(`${baseUrl}/project/${projectId}`);
    const data1 = await res1.json();
    console.log('API data keys:', Object.keys(data1.data));
    console.log('digitalAssets count:', data1.data.digitalAssets?.length);
    console.log('digitalAssets:', JSON.stringify(data1.data.digitalAssets, null, 2));

    if (data1.data.digitalAssets && data1.data.digitalAssets.length > 0) {
      console.log('✅ DIGITAL ASSETS ARE VISIBLE IN API');
    } else {
      console.log('❌ DIGITAL ASSETS ARE MISSING IN API');
    }

    console.log('\n--- Testing Member Addition ---');
    const newMember = { id: 'tm-final-' + Date.now(), name: 'Final Tester', role: 'Dev' };
    const updatedProject = {
      ...data1.data,
      teamMembers: [...(data1.data.teamMembers || []), newMember]
    };
    
    const res2 = await fetch(`${baseUrl}/save-project-detailed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProject)
    });
    const data2 = await res2.json();
    console.log('Save result:', data2.success ? 'Success' : 'Failed');

    console.log('\n--- Verifying Saved Member ---');
    const res3 = await fetch(`${baseUrl}/project/${projectId}`);
    const data3 = await res3.json();
    const hasMember = data3.data.teamMembers?.some(m => m.name === 'Final Tester');
    
    if (hasMember) {
      console.log('✅ MEMBER PERSISTED SUCCESSFULLY');
    } else {
      console.log('❌ MEMBER PERSISTENCE FAILED');
    }

  } catch (err) {
    console.error('Final verification failed:', err.message);
  }
}

finalVerify();
