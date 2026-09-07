import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const username = process.env.ADMIN_USERNAME || 'nomiadmin3535';
const email = process.env.ADMIN_EMAIL || 'nomiadmin3535@gmail.com';
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('ADMIN_PASSWORD missing in process env');
  process.exit(1);
}

function add(name, value, sensitive) {
  return new Promise((resolve, reject) => {
    const args = [
      'vercel', 'env', 'add', name, 'production,preview,development',
      '--yes', '--force', sensitive ? '--sensitive' : '--no-sensitive',
    ];
    const child = spawn('npx', args, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`SET ${name}`);
        resolve();
      } else reject(new Error(`${name} failed: ${stderr.trim()}`));
    });
    child.stdin.write(value);
    child.stdin.end();
  });
}

await add('ADMIN_USERNAME', username, false);
await add('ADMIN_EMAIL', email, false);
await add('ADMIN_PASSWORD', password, true);

const envText = readFileSync('.env', 'utf8');
const lines = [];
if (!/^ADMIN_USERNAME=/m.test(envText)) lines.push(`ADMIN_USERNAME="${username}"`);
if (!/^ADMIN_EMAIL=/m.test(envText)) lines.push(`ADMIN_EMAIL="${email}"`);
if (!/^ADMIN_PASSWORD=/m.test(envText)) lines.push(`ADMIN_PASSWORD="${password}"`);
if (lines.length) appendFileSync('.env', `\n${lines.join('\n')}\n`);
console.log('DONE');
