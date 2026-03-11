import { spawn } from 'child_process';
import path from 'path';

// Ensure port is free before starting
import { execSync } from 'child_process';
try {
    execSync('node server/ensure_port.js', { stdio: 'inherit' });
} catch (e) {
    // Ignore error if it fails, try to start anyway
    console.log('Port check finished');
}

const server = spawn('node', ['server/index.js'], {
    stdio: 'inherit',
    shell: true
});

const client = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
});

server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    client.kill();
});

client.on('close', (code) => {
    console.log(`Client process exited with code ${code}`);
    server.kill();
});
