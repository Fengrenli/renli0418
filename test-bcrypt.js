import bcrypt from 'bcrypt';

async function testBcrypt() {
  try {
    console.log('Testing bcrypt...');
    const hashed = await bcrypt.hash('Renli2026', 10);
    console.log('Hashed:', hashed);
    const match = await bcrypt.compare('Renli2026', hashed);
    console.log('Match:', match);
  } catch (err) {
    console.error('Bcrypt failed:', err.message);
  }
}

testBcrypt();
