import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { getGmailClient, getImpersonatedUser } from './google-client.js'

// Gmail tool definitions
export const gmailTools: Tool[] = [
  {
    name: 'google_gmail_search',
    description: 'メールを検索します。Gmailの検索クエリ構文が使えます。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索クエリ（例: "from:example@example.com newer_than:7d"）' },
        max_results: { type: 'number', description: '取得件数（デフォルト: 20）', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'google_gmail_get_message',
    description: '特定のメールの詳細を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'メッセージID' },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'google_gmail_send',
    description: 'メールを送信します。',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '宛先メールアドレス' },
        subject: { type: 'string', description: '件名' },
        body: { type: 'string', description: '本文' },
        cc: { type: 'string', description: 'CC（カンマ区切り）' },
        bcc: { type: 'string', description: 'BCC（カンマ区切り）' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'google_gmail_list_labels',
    description: 'ラベル一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'google_gmail_modify_labels',
    description: 'メールのラベルを変更します。',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string', description: 'メッセージID' },
        add_labels: { type: 'array', items: { type: 'string' }, description: '追加するラベルID' },
        remove_labels: { type: 'array', items: { type: 'string' }, description: '削除するラベルID' },
      },
      required: ['message_id'],
    },
  },
]

// Helper to decode base64url
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

// Helper to encode email to base64url
function encodeEmail(to: string, subject: string, body: string, cc?: string, bcc?: string): string {
  const from = getImpersonatedUser()
  let email = `From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nContent-Type: text/plain; charset=UTF-8\r\n`
  
  if (cc) email += `Cc: ${cc}\r\n`
  if (bcc) email += `Bcc: ${bcc}\r\n`
  
  email += `\r\n${body}`
  
  return Buffer.from(email).toString('base64url')
}

// Helper to extract email headers
function getHeader(headers: any[], name: string): string {
  const header = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

// Gmail tool executor
export async function executeGmailTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const gmail = getGmailClient()
  const userId = 'me'

  try {
    switch (name) {
      case 'google_gmail_search': {
        const query = args?.query as string
        const maxResults = (args?.max_results as number) || 20
        if (!query) throw new Error('query is required')

        const response = await gmail.users.messages.list({
          userId,
          q: query,
          maxResults,
        })

        const messages = await Promise.all(
          (response.data.messages || []).map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId,
              id: msg.id!,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            })
            
            const headers = detail.data.payload?.headers || []
            
            return {
              id: msg.id,
              スレッドID: msg.threadId,
              送信者: getHeader(headers, 'From'),
              宛先: getHeader(headers, 'To'),
              件名: getHeader(headers, 'Subject'),
              日時: getHeader(headers, 'Date'),
              スニペット: detail.data.snippet || '',
              ラベル: detail.data.labelIds || [],
            }
          })
        )

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: messages.length, メール: messages }, null, 2) }],
        }
      }

      case 'google_gmail_get_message': {
        const messageId = args?.message_id as string
        if (!messageId) throw new Error('message_id is required')

        const response = await gmail.users.messages.get({
          userId,
          id: messageId,
          format: 'full',
        })

        const headers = response.data.payload?.headers || []
        
        // Extract body
        let body = ''
        const payload = response.data.payload
        if (payload?.body?.data) {
          body = decodeBase64Url(payload.body.data)
        } else if (payload?.parts) {
          const textPart = payload.parts.find((p) => p.mimeType === 'text/plain')
          if (textPart?.body?.data) {
            body = decodeBase64Url(textPart.body.data)
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: response.data.id,
              スレッドID: response.data.threadId,
              送信者: getHeader(headers, 'From'),
              宛先: getHeader(headers, 'To'),
              CC: getHeader(headers, 'Cc'),
              件名: getHeader(headers, 'Subject'),
              日時: getHeader(headers, 'Date'),
              本文: body,
              ラベル: response.data.labelIds || [],
              スニペット: response.data.snippet || '',
            }, null, 2),
          }],
        }
      }

      case 'google_gmail_send': {
        const to = args?.to as string
        const subject = args?.subject as string
        const body = args?.body as string
        const cc = args?.cc as string | undefined
        const bcc = args?.bcc as string | undefined
        
        if (!to || !subject || !body) {
          throw new Error('to, subject, and body are required')
        }

        const raw = encodeEmail(to, subject, body, cc, bcc)

        const response = await gmail.users.messages.send({
          userId,
          requestBody: { raw },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'メールを送信しました',
              id: response.data.id,
              スレッドID: response.data.threadId,
              宛先: to,
              件名: subject,
            }, null, 2),
          }],
        }
      }

      case 'google_gmail_list_labels': {
        const response = await gmail.users.labels.list({ userId })
        
        const labels = response.data.labels?.map((label) => ({
          id: label.id,
          名前: label.name,
          タイプ: label.type,
          メッセージ数: label.messagesTotal,
          未読数: label.messagesUnread,
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: labels.length, ラベル: labels }, null, 2) }],
        }
      }

      case 'google_gmail_modify_labels': {
        const messageId = args?.message_id as string
        const addLabels = args?.add_labels as string[] | undefined
        const removeLabels = args?.remove_labels as string[] | undefined
        
        if (!messageId) throw new Error('message_id is required')
        if (!addLabels && !removeLabels) throw new Error('add_labels or remove_labels is required')

        await gmail.users.messages.modify({
          userId,
          id: messageId,
          requestBody: {
            addLabelIds: addLabels,
            removeLabelIds: removeLabels,
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'ラベルを変更しました',
              message_id: messageId,
              追加したラベル: addLabels || [],
              削除したラベル: removeLabels || [],
            }, null, 2),
          }],
        }
      }

      default:
        throw new Error(`Unknown gmail tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ エラー: error.message }, null, 2) }],
      isError: true,
    }
  }
}
