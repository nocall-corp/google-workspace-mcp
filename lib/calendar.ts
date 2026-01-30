import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { getCalendarClient, getImpersonatedUser } from './google-client.js'

// Calendar tool definitions
export const calendarTools: Tool[] = [
  {
    name: 'google_calendar_list_events',
    description: 'カレンダーのイベント一覧を取得します。日付範囲やカレンダーIDを指定できます。',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string', description: 'カレンダーID（デフォルト: primary）' },
        time_min: { type: 'string', description: '開始日時（ISO8601形式、例: 2026-01-30T00:00:00+09:00）' },
        time_max: { type: 'string', description: '終了日時（ISO8601形式）' },
        max_results: { type: 'number', description: '取得件数（デフォルト: 20）', default: 20 },
        query: { type: 'string', description: 'フリーテキスト検索' },
      },
    },
  },
  {
    name: 'google_calendar_get_event',
    description: '特定のイベントの詳細情報を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string', description: 'カレンダーID（デフォルト: primary）' },
        event_id: { type: 'string', description: 'イベントID' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'google_calendar_create_event',
    description: '新しいイベントを作成します。',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string', description: 'カレンダーID（デフォルト: primary）' },
        summary: { type: 'string', description: 'イベントタイトル' },
        description: { type: 'string', description: 'イベントの説明' },
        location: { type: 'string', description: '場所' },
        start_time: { type: 'string', description: '開始日時（ISO8601形式）' },
        end_time: { type: 'string', description: '終了日時（ISO8601形式）' },
        attendees: { type: 'array', items: { type: 'string' }, description: '参加者のメールアドレス配列' },
        send_notifications: { type: 'boolean', description: '参加者に通知を送信するか（デフォルト: true）' },
      },
      required: ['summary', 'start_time', 'end_time'],
    },
  },
  {
    name: 'google_calendar_update_event',
    description: '既存のイベントを更新します。',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string', description: 'カレンダーID（デフォルト: primary）' },
        event_id: { type: 'string', description: 'イベントID' },
        summary: { type: 'string', description: 'イベントタイトル' },
        description: { type: 'string', description: 'イベントの説明' },
        location: { type: 'string', description: '場所' },
        start_time: { type: 'string', description: '開始日時（ISO8601形式）' },
        end_time: { type: 'string', description: '終了日時（ISO8601形式）' },
        attendees: { type: 'array', items: { type: 'string' }, description: '参加者のメールアドレス配列' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'google_calendar_delete_event',
    description: 'イベントを削除します。',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string', description: 'カレンダーID（デフォルト: primary）' },
        event_id: { type: 'string', description: 'イベントID' },
        send_notifications: { type: 'boolean', description: '参加者に通知を送信するか（デフォルト: true）' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'google_calendar_list_calendars',
    description: 'アクセス可能なカレンダー一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

// Calendar tool executor
export async function executeCalendarTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const calendar = getCalendarClient()
  const defaultCalendarId = 'primary'

  try {
    switch (name) {
      case 'google_calendar_list_events': {
        const calendarId = (args?.calendar_id as string) || defaultCalendarId
        const timeMin = (args?.time_min as string) || new Date().toISOString()
        const timeMax = args?.time_max as string | undefined
        const maxResults = (args?.max_results as number) || 20
        const query = args?.query as string | undefined

        const response = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          maxResults,
          q: query,
          singleEvents: true,
          orderBy: 'startTime',
        })

        const events = response.data.items?.map((event) => ({
          id: event.id,
          タイトル: event.summary || '（タイトルなし）',
          開始: event.start?.dateTime || event.start?.date || '',
          終了: event.end?.dateTime || event.end?.date || '',
          場所: event.location || '',
          説明: event.description || '',
          参加者: event.attendees?.map((a) => a.email) || [],
          作成者: event.creator?.email || '',
          ステータス: event.status || '',
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: events.length, イベント: events }, null, 2) }],
        }
      }

      case 'google_calendar_get_event': {
        const calendarId = (args?.calendar_id as string) || defaultCalendarId
        const eventId = args?.event_id as string
        if (!eventId) throw new Error('event_id is required')

        const response = await calendar.events.get({ calendarId, eventId })
        const event = response.data

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: event.id,
              タイトル: event.summary || '（タイトルなし）',
              開始: event.start?.dateTime || event.start?.date || '',
              終了: event.end?.dateTime || event.end?.date || '',
              場所: event.location || '',
              説明: event.description || '',
              参加者: event.attendees?.map((a) => ({ email: a.email, ステータス: a.responseStatus })) || [],
              作成者: event.creator?.email || '',
              主催者: event.organizer?.email || '',
              ステータス: event.status || '',
              リンク: event.htmlLink || '',
              Meet: event.hangoutLink || '',
            }, null, 2),
          }],
        }
      }

      case 'google_calendar_create_event': {
        const calendarId = (args?.calendar_id as string) || defaultCalendarId
        const summary = args?.summary as string
        const description = args?.description as string | undefined
        const location = args?.location as string | undefined
        const startTime = args?.start_time as string
        const endTime = args?.end_time as string
        const attendees = args?.attendees as string[] | undefined
        const sendNotifications = args?.send_notifications !== false

        if (!summary || !startTime || !endTime) {
          throw new Error('summary, start_time, and end_time are required')
        }

        const response = await calendar.events.insert({
          calendarId,
          sendUpdates: sendNotifications ? 'all' : 'none',
          requestBody: {
            summary,
            description,
            location,
            start: { dateTime: startTime, timeZone: 'Asia/Tokyo' },
            end: { dateTime: endTime, timeZone: 'Asia/Tokyo' },
            attendees: attendees?.map((email) => ({ email })),
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'イベントを作成しました',
              id: response.data.id,
              タイトル: response.data.summary,
              開始: response.data.start?.dateTime,
              終了: response.data.end?.dateTime,
              リンク: response.data.htmlLink,
            }, null, 2),
          }],
        }
      }

      case 'google_calendar_update_event': {
        const calendarId = (args?.calendar_id as string) || defaultCalendarId
        const eventId = args?.event_id as string
        if (!eventId) throw new Error('event_id is required')

        // First get the existing event
        const existing = await calendar.events.get({ calendarId, eventId })
        const existingData = existing.data

        const updateData: any = {
          summary: (args?.summary as string) || existingData.summary,
          description: args?.description !== undefined ? (args.description as string) : existingData.description,
          location: args?.location !== undefined ? (args.location as string) : existingData.location,
        }

        if (args?.start_time) {
          updateData.start = { dateTime: args.start_time as string, timeZone: 'Asia/Tokyo' }
        } else {
          updateData.start = existingData.start
        }

        if (args?.end_time) {
          updateData.end = { dateTime: args.end_time as string, timeZone: 'Asia/Tokyo' }
        } else {
          updateData.end = existingData.end
        }

        if (args?.attendees) {
          updateData.attendees = (args.attendees as string[]).map((email) => ({ email }))
        } else {
          updateData.attendees = existingData.attendees
        }

        const response = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: updateData,
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'イベントを更新しました',
              id: response.data.id,
              タイトル: response.data.summary,
              開始: response.data.start?.dateTime || response.data.start?.date,
              終了: response.data.end?.dateTime || response.data.end?.date,
              リンク: response.data.htmlLink,
            }, null, 2),
          }],
        }
      }

      case 'google_calendar_delete_event': {
        const calendarId = (args?.calendar_id as string) || defaultCalendarId
        const eventId = args?.event_id as string
        const sendNotifications = args?.send_notifications !== false
        if (!eventId) throw new Error('event_id is required')

        await calendar.events.delete({
          calendarId,
          eventId,
          sendUpdates: sendNotifications ? 'all' : 'none',
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'イベントを削除しました',
              event_id: eventId,
            }, null, 2),
          }],
        }
      }

      case 'google_calendar_list_calendars': {
        const response = await calendar.calendarList.list()
        const calendars = response.data.items?.map((cal) => ({
          id: cal.id,
          名前: cal.summary || '',
          説明: cal.description || '',
          タイムゾーン: cal.timeZone || '',
          アクセス権: cal.accessRole || '',
          プライマリ: cal.primary || false,
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: calendars.length, カレンダー: calendars }, null, 2) }],
        }
      }

      default:
        throw new Error(`Unknown calendar tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ エラー: error.message }, null, 2) }],
      isError: true,
    }
  }
}
