import { env } from '../config/env.js';

async function postJson(url: string, token: string | undefined, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Provider failed with ${response.status}`);
}

export async function sendPushBatch(messages: unknown[]) {
  if (!messages.length) return { skipped: false, count: 0 };
  if (env.PUSH_PROVIDER_URL) await postJson(env.PUSH_PROVIDER_URL, env.PUSH_PROVIDER_TOKEN, { messages });
  else await postJson('https://exp.host/--/api/v2/push/send', env.PUSH_PROVIDER_TOKEN, messages);
  return { skipped: false, count: messages.length };
}

export async function sendEmailBatch(messages: unknown[]) {
  if (!env.EMAIL_PROVIDER_URL) return { skipped: true, count: messages.length };
  await postJson(env.EMAIL_PROVIDER_URL, env.EMAIL_PROVIDER_TOKEN, { messages });
  return { skipped: false, count: messages.length };
}
