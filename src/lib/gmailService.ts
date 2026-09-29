// Gmail Service integration conforming to Google Workspace Skill
import { resilientFetch } from './resilientFetch.ts';

export interface SendEmailPayload {
  to: string;
  subject: string;
  bodyHtml: string;
}

function createRfc2822Message(to: string, subject: string, bodyHtml: string): string {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    bodyHtml,
  ];
  const email = emailLines.join('\r\n');
  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendGmailMessage(
  accessToken: string,
  payload: SendEmailPayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const raw = createRfc2822Message(payload.to, payload.subject, payload.bodyHtml);
    const res = await resilientFetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error?.message || `Gmail API error status ${res.status}` };
    }

    const data = await res.json().catch(() => null);
    return { success: true, id: data?.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send Gmail message' };
  }
}

export async function listRecentTradingAlerts(
  accessToken: string
): Promise<Array<{ id: string; snippet: string }>> {
  try {
    const query = encodeURIComponent('BingX OR Trading OR صفقة OR أرباح');
    const res = await resilientFetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${query}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return data?.messages || [];
  } catch {
    return [];
  }
}
