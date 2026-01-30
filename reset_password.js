
import { run } from './server/database.js';
import bcrypt from 'bcryptjs';

async function resetPass() {
    const hash = await bcrypt.hash('password123', 10);
    await run('UPDATE profiles SET password_hash = ? WHERE email = ?', [hash, 'admin@elevate.com']);
    console.log('Password updated');
}

resetPass();
