
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PORT = process.env.PORT || 3002;

async function checkAndKillPort(port) {
    console.log(`Checking if port ${port} is in use...`);

    try {
        const platform = process.platform;
        let cmd = '';

        if (platform === 'win32') {
            cmd = `netstat -ano | findstr :${port}`;
        } else {
            // lsof -i :3002 -t returns just the PID
            cmd = `lsof -i :${port} -t`;
        }

        const { stdout } = await execAsync(cmd).catch(() => ({ stdout: '' }));

        if (!stdout) {
            console.log(`Port ${port} is free.`);
            return;
        }

        const pids = stdout.trim().split('\n').filter(Boolean);

        if (pids.length > 0) {
            console.log(`Port ${port} is in use by PID(s): ${pids.join(', ')}. Killing process(es)...`);

            for (const pid of pids) {
                try {
                    if (platform === 'win32') {
                        await execAsync(`taskkill /PID ${pid} /F`);
                    } else {
                        await execAsync(`kill -9 ${pid}`);
                    }
                    console.log(`Process ${pid} terminated.`);
                } catch (err) {
                    console.error(`Failed to kill process ${pid}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error checking port:', error);
    }
}

checkAndKillPort(PORT);
