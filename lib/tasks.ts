import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { getTasksClient } from './google-client.js'

// Tasks tool definitions
export const tasksTools: Tool[] = [
  {
    name: 'google_tasks_list_tasklists',
    description: 'タスクリスト一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'google_tasks_list',
    description: 'タスク一覧を取得します。',
    inputSchema: {
      type: 'object',
      properties: {
        tasklist_id: { type: 'string', description: 'タスクリストID（デフォルト: @default）' },
        show_completed: { type: 'boolean', description: '完了済みタスクを含めるか（デフォルト: true）' },
        show_hidden: { type: 'boolean', description: '非表示タスクを含めるか（デフォルト: false）' },
        max_results: { type: 'number', description: '取得件数（デフォルト: 50）', default: 50 },
      },
    },
  },
  {
    name: 'google_tasks_create',
    description: '新しいタスクを作成します。',
    inputSchema: {
      type: 'object',
      properties: {
        tasklist_id: { type: 'string', description: 'タスクリストID（デフォルト: @default）' },
        title: { type: 'string', description: 'タスクタイトル' },
        notes: { type: 'string', description: 'メモ・詳細' },
        due: { type: 'string', description: '期限（ISO8601形式の日付、例: 2026-01-30）' },
      },
      required: ['title'],
    },
  },
  {
    name: 'google_tasks_update',
    description: 'タスクを更新します。',
    inputSchema: {
      type: 'object',
      properties: {
        tasklist_id: { type: 'string', description: 'タスクリストID（デフォルト: @default）' },
        task_id: { type: 'string', description: 'タスクID' },
        title: { type: 'string', description: 'タスクタイトル' },
        notes: { type: 'string', description: 'メモ・詳細' },
        due: { type: 'string', description: '期限（ISO8601形式の日付）' },
        status: { type: 'string', description: 'ステータス（needsAction または completed）' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'google_tasks_complete',
    description: 'タスクを完了にします。',
    inputSchema: {
      type: 'object',
      properties: {
        tasklist_id: { type: 'string', description: 'タスクリストID（デフォルト: @default）' },
        task_id: { type: 'string', description: 'タスクID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'google_tasks_delete',
    description: 'タスクを削除します。',
    inputSchema: {
      type: 'object',
      properties: {
        tasklist_id: { type: 'string', description: 'タスクリストID（デフォルト: @default）' },
        task_id: { type: 'string', description: 'タスクID' },
      },
      required: ['task_id'],
    },
  },
]

// Tasks tool executor
export async function executeTasksTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const tasks = getTasksClient()
  const defaultTasklistId = '@default'

  try {
    switch (name) {
      case 'google_tasks_list_tasklists': {
        const response = await tasks.tasklists.list()
        
        const tasklists = response.data.items?.map((list) => ({
          id: list.id,
          タイトル: list.title,
          更新日時: list.updated,
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: tasklists.length, タスクリスト: tasklists }, null, 2) }],
        }
      }

      case 'google_tasks_list': {
        const tasklistId = (args?.tasklist_id as string) || defaultTasklistId
        const showCompleted = args?.show_completed !== false
        const showHidden = (args?.show_hidden as boolean) || false
        const maxResults = (args?.max_results as number) || 50

        const response = await tasks.tasks.list({
          tasklist: tasklistId,
          showCompleted,
          showHidden,
          maxResults,
        })

        const taskItems = response.data.items?.map((task) => ({
          id: task.id,
          タイトル: task.title,
          メモ: task.notes || '',
          ステータス: task.status === 'completed' ? '完了' : '未完了',
          期限: task.due ? task.due.split('T')[0] : '',
          完了日時: task.completed || '',
          更新日時: task.updated,
          親タスク: task.parent || '',
          位置: task.position,
        })) || []

        return {
          content: [{ type: 'text', text: JSON.stringify({ 総件数: taskItems.length, タスク: taskItems }, null, 2) }],
        }
      }

      case 'google_tasks_create': {
        const tasklistId = (args?.tasklist_id as string) || defaultTasklistId
        const title = args?.title as string
        const notes = args?.notes as string | undefined
        const due = args?.due as string | undefined
        
        if (!title) throw new Error('title is required')

        const response = await tasks.tasks.insert({
          tasklist: tasklistId,
          requestBody: {
            title,
            notes,
            due: due ? `${due}T00:00:00.000Z` : undefined,
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'タスクを作成しました',
              id: response.data.id,
              タイトル: response.data.title,
              メモ: response.data.notes || '',
              期限: response.data.due ? response.data.due.split('T')[0] : '',
              ステータス: response.data.status === 'completed' ? '完了' : '未完了',
            }, null, 2),
          }],
        }
      }

      case 'google_tasks_update': {
        const tasklistId = (args?.tasklist_id as string) || defaultTasklistId
        const taskId = args?.task_id as string
        
        if (!taskId) throw new Error('task_id is required')

        // First get existing task
        const existing = await tasks.tasks.get({
          tasklist: tasklistId,
          task: taskId,
        })

        const updateData: any = {
          id: taskId,
          title: (args?.title as string) || existing.data.title,
          notes: args?.notes !== undefined ? (args.notes as string) : existing.data.notes,
          status: (args?.status as string) || existing.data.status,
        }

        if (args?.due) {
          updateData.due = `${args.due}T00:00:00.000Z`
        } else if (existing.data.due) {
          updateData.due = existing.data.due
        }

        const response = await tasks.tasks.update({
          tasklist: tasklistId,
          task: taskId,
          requestBody: updateData,
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'タスクを更新しました',
              id: response.data.id,
              タイトル: response.data.title,
              メモ: response.data.notes || '',
              期限: response.data.due ? response.data.due.split('T')[0] : '',
              ステータス: response.data.status === 'completed' ? '完了' : '未完了',
            }, null, 2),
          }],
        }
      }

      case 'google_tasks_complete': {
        const tasklistId = (args?.tasklist_id as string) || defaultTasklistId
        const taskId = args?.task_id as string
        
        if (!taskId) throw new Error('task_id is required')

        // Get existing task first
        const existing = await tasks.tasks.get({
          tasklist: tasklistId,
          task: taskId,
        })

        const response = await tasks.tasks.update({
          tasklist: tasklistId,
          task: taskId,
          requestBody: {
            id: taskId,
            title: existing.data.title,
            status: 'completed',
          },
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'タスクを完了にしました',
              id: response.data.id,
              タイトル: response.data.title,
              完了日時: response.data.completed,
            }, null, 2),
          }],
        }
      }

      case 'google_tasks_delete': {
        const tasklistId = (args?.tasklist_id as string) || defaultTasklistId
        const taskId = args?.task_id as string
        
        if (!taskId) throw new Error('task_id is required')

        await tasks.tasks.delete({
          tasklist: tasklistId,
          task: taskId,
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              メッセージ: 'タスクを削除しました',
              task_id: taskId,
            }, null, 2),
          }],
        }
      }

      default:
        throw new Error(`Unknown tasks tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ エラー: error.message }, null, 2) }],
      isError: true,
    }
  }
}
