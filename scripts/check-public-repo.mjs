import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function trackedFiles(){return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'ls-files', '-z'], { cwd: root })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);}

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

// These exact RFC 1918 ranges are public coturn firewall rules, not host addresses.
// Only quoted policy literals in these two files qualify; other IPs still fail.
const turnPolicyFiles = new Set(['deploy/setup-turn.py', 'deploy/test_setup_turn.py']);
const policyLiteral = /(["'])(?:10\.0\.0\.0-10\.255\.255\.255|172\.16\.0\.0-172\.31\.255\.255|192\.168\.0\.0-192\.168\.255\.255|192\.168\.0\.0\/16)\1|(["'])denied-peer-ip=10\.0\.0\.0-10\.255\.255\.255\\n\2/g;
export function inspectPublicFile(relative,bytes){
  const findings=[];
  if (forbiddenPaths.some(pattern => pattern.test(relative)) && !allowedEnvironmentTemplates.test(relative)) {
    findings.push(`${relative}: forbidden tracked path`);
  }
  if (bytes.includes(0)) return findings;
  const raw = bytes.toString('utf8');
  const content = turnPolicyFiles.has(relative) ? raw.replace(policyLiteral,match=>' '.repeat(match.length)) : raw;
  for (const [label, pattern] of textPatterns) {
    const match = content.match(pattern);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${relative}:${line}: ${label}`);
    }
  }
  return findings;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const files=trackedFiles(),findings=[];
for(const relative of files){
  try{findings.push(...inspectPublicFile(relative,fs.readFileSync(path.join(root,relative))))}catch(error){if(error.code!=='ENOENT')throw error}
}

if (findings.length) {
  console.error('Public repository safety check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Public repository safety check passed for ${files.length} tracked files.`);
}
