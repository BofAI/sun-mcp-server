#!/usr/bin/env node

import { startServer } from './server';

startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
