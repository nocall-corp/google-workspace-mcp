import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getGmailClient } from '../lib/google-client.js'

// Verify the request is from Vercel Cron
function verifyCronRequest(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // Skip verification if not configured
  return req.headers['authorization'] === `Bearer ${cronSecret}`
}

// Helper to extract email headers
function getHeader(headers: any[], name: string): string {
  const header = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

// Format date for display in JST
function formatJSTDate(date: Date): string {
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

// Fetch unread emails from Gmail
async function fetchUnreadEmails(): Promise<{
  count: number
  emails: Array<{
    id: string
    from: string
    subject: string
    snippet: string
    date: string
    labels: string[]
  }>
}> {
  const gmail = getGmailClient()
  const userId = 'me'

  const response = await gmail.users.messages.list({
    userId,
    q: 'is:unread in:inbox',
    maxResults: 20,
  })

  const messages = response.data.messages || []

  const emails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId,
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers || []

      return {
        id: msg.id || '',
        from: getHeader(headers, 'From'),
        subject: getHeader(headers, 'Subject'),
        snippet: detail.data.snippet || '',
        date: getHeader(headers, 'Date'),
        labels: detail.data.labelIds || [],
      }
    })
  )

  return {
    count: response.data.resultSizeEstimate || messages.length,
    emails,
  }
}

// Build Slack message blocks
function buildSlackMessage(
  unreadData: Awaited<ReturnType<typeof fetchUnreadEmails>>
): object {
  const now = formatJSTDate(new Date())
  const blocks: any[] = []

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `📬 未読メール確認 (${now})`,
      emoji: true,
    },
  })

  if (unreadData.count === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '✅ 未読メールはありません！',
      },
    })
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📨 *未読メール: ${unreadData.count}件*${unreadData.count > 20 ? '（上位20件を表示）' : ''}`,
      },
    })

    blocks.push({ type: 'divider' })

    for (const email of unreadData.emails) {
      // Clean up sender name
      const fromDisplay = email.from.length > 60
        ? email.from.substring(0, 57) + '...'
        : email.from

      const subjectDisplay = email.subject || '(件名なし)'

      // Truncate snippet
      const snippetDisplay = email.snippet.length > 100
        ? email.snippet.substring(0, 97) + '...'
        : email.snippet

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${subjectDisplay}*\n👤 ${fromDisplay}\n📅 ${email.date}\n> ${snippetDisplay}`,
        },
      })
    }

    blocks.push({ type: 'divider' })

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 メールの詳細を確認したい場合は、このチャンネルで「メールID: <ID> の詳細を見せて」と聞いてください',
        },
      ],
    })
  }

  return {
    blocks,
    text: `未読メール確認: ${unreadData.count}件 (${now})`,
  }
}

// Send message to Slack
async function sendToSlack(message: object): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL environment variable is not set')
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Slack API error: ${response.status} ${errorText}`)
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Verify cron request
  if (!verifyCronRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    // Fetch unread emails
    const unreadData = await fetchUnreadEmails()

    // Build and send Slack message
    const slackMessage = buildSlackMessage(unreadData)
    await sendToSlack(slackMessage)

    res.status(200).json({
      status: 'ok',
      message: `未読メール ${unreadData.count}件 をSlackに通知しました`,
      timestamp: new Date().toISOString(),
      unreadCount: unreadData.count,
    })
  } catch (error: any) {
    console.error('Cron unread check error:', error)
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}
