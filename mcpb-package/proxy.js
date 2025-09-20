#!/usr/bin/env node

console.error('=== PROXY STARTED ===');
console.error('Node version:', process.version);
console.error('Working directory:', process.cwd());
console.error('Arguments:', process.argv);

// Exit after 5 seconds so we can see the logs
setTimeout(() => {
    console.error('=== PROXY EXITING ===');
    process.exit(0);
}, 5000);