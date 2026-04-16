// ES module entry point for Alibaba Cloud deployment
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Directly import and run the server
import('./server.ts').catch(err => {
  console.error('Failed to load server:', err);
  process.exit(1);
});
