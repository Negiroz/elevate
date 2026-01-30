import { spawn } from 'child_process';
import path from 'path';

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
