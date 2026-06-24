#!/usr/bin/env node
import process from 'node:process';

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data || '{}');
}

async function importPiSdk() {
  try {
    return await import('@earendil-works/pi-coding-agent');
  } catch {
    return undefined;
  }
}

function fallback(payload, reason) {
  return {
    mode: payload.dryRun ? 'dry-run' : 'fallback',
    accepted: true,
    summary: `${payload.dryRun ? 'Dry-run' : 'Fallback'} Pi SDK step for ${payload.step?.id}. model=${payload.step?.model || 'default'} prompt=${payload.step?.prompt || 'none'}. ${reason}`,
  };
}

const payload = await readStdin();
const sdk = await importPiSdk();
if (payload.dryRun || !sdk?.createAgentSession) {
  process.stdout.write(JSON.stringify(fallback(payload, sdk ? 'dry-run requested.' : 'Pi SDK unavailable.'), null, 2));
  process.exit(0);
}

const options = { tools: ['read', 'grep', 'find', 'ls'] };
if (payload.step?.model) options.model = payload.step.model;
if (sdk.AuthStorage && sdk.ModelRegistry && sdk.SessionManager) {
  const authStorage = sdk.AuthStorage.create();
  options.modelRegistry = sdk.ModelRegistry.create(authStorage);
  options.sessionManager = sdk.SessionManager.inMemory();
}

const { session } = await sdk.createAgentSession(options);
try {
  const text = [
    `Workflow: ${payload.workflow?.id}`,
    `Step: ${payload.step?.id} - ${payload.step?.title}`,
    `Model alias: ${payload.step?.model || 'default'}`,
    `Prompt alias: ${payload.step?.prompt || 'none'}`,
    `Description: ${payload.step?.description || ''}`,
    '',
    'Context payload:',
    payload.prompt || '(none)',
    '',
    'Return concise JSON-ready findings and verdict when this is a review step.',
  ].join('\n');
  const result = await session.prompt(text);
  const parts = [];
  if (typeof result === 'string') parts.push(result);
  else if (result && typeof result === 'object') parts.push(JSON.stringify(result));
  if (Array.isArray(session.messages)) parts.push(...session.messages.map((m) => typeof m === 'string' ? m : JSON.stringify(m)));
  if (typeof session.getMessages === 'function') {
    const messages = await session.getMessages();
    if (Array.isArray(messages)) parts.push(...messages.map((m) => typeof m === 'string' ? m : JSON.stringify(m)));
  }
  process.stdout.write(JSON.stringify({ mode: 'sdk', accepted: true, summary: parts.filter(Boolean).join('\n') || 'Pi SDK step completed without exposed assistant text.' }, null, 2));
} finally {
  if (typeof session.dispose === 'function') session.dispose();
}
