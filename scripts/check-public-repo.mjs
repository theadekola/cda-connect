import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'ls-files', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const forbiddenPaths = [
  /(^|\/)\.idea(\/|$)/i,
  /(^|\/)\.vscode(\/|$)/i,
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:google-services\.json|GoogleService-Info\.plist|local\.properties)$/i,
  /\.(?:pem|key|p8|p12|pfx|jks|keystore|iml)$/i,
];
const allowedEnvironmentTemplates = /\.env(?:\.production)?\.example$/i;
const textPatterns = [
  ['private IPv4 address', /(?<!\d)(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?!\d)/],
  ['Windows user profile path', /[A-Za-z]:[\\/]Users[\\/][^\\/\s]+/i],
  ['macOS user profile path', /\/Users\/[^/\s]+/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
];

const findings = [];
for (const relative of files) {
  if (forbiddenPaths.some(pattern => pattern.test(relative)) && !allowedEnvironmentTemplates.test(relative)) {
    findings.push(`${relative}: forbidden tracked path`);
  }
  const absolute = path.join(root, relative);
  let bytes;
  try { bytes = fs.readFileSync(absolute); } catch { continue; }
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const [label, pattern] of textPatterns) {
    const match = content.match(pattern);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${relative}:${line}: ${label}`);
    }
  }
}

if (findings.length) {
  console.error('Public repository safety check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Public repository safety check passed for ${files.length} tracked files.`);
