import type { VercelRequest, VercelResponse } from '@vercel/node'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

// Import tool definitions and executors
import { calendarTools, executeCalendarTool } from '../lib/calendar.js'
import { gmailTools, executeGmailTool } from '../lib/gmail.js'
import { driveTools, executeDriveTool } from '../lib/drive.js'
import { tasksTools, executeTasksTool } from '../lib/tasks.js'

// Auth configuration
const authTokens = [process.env.MCP_AUTH_TOKEN, process.env.AUTH_TOKEN].filter(
  (t): t is string => typeof t === 'string' && t.length > 0
)
const requireAuth =
  process.env.REQUIRE_AUTH === 'true' ||
  (process.env.REQUIRE_AUTH !== 'false' && process.env.VERCEL_ENV === 'production')

// All tools combined
const allTools: Tool[] = [
  ...calendarTools,
  ...gmailTools,
  ...driveTools,
  ...tasksTools,
]

// Tool executor router
async function executeTool(
  name: string,
  args: Record<string, unknown> | undefined
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  // Route to appropriate executor based on tool name prefix
  if (name.startsWith('google_calendar_')) {
    return executeCalendarTool(name, args)
  } else if (name.startsWith('google_gmail_')) {
    return executeGmailTool(name, args)
  } else if (name.startsWith('google_drive_')) {
    return executeDriveTool(name, args)
  } else if (name.startsWith('google_tasks_')) {
    return executeTasksTool(name, args)
  } else {
    return {
      content: [{ type: 'text', text: JSON.stringify({ エラー: `Unknown tool: ${name}` }, null, 2) }],
      isError: true,
    }
  }
}

// MCP Server class
class GoogleWorkspaceMCPServer {
  private server: Server

  constructor() {
    this.server = new Server(
      { name: 'google-workspace-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )
    this.setupHandlers()
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools,
    }))

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: params } = request.params
      return executeTool(name, params)
    })
  }

  async connect(transport: Transport) {
    await this.server.connect(transport)
  }
}

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

// Authentication helper
function authenticate(req: VercelRequest, res: VercelResponse): boolean {
  if (requireAuth && authTokens.length === 0) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32002, message: 'Server misconfigured: MCP_AUTH_TOKEN or AUTH_TOKEN is required' },
      id: null,
    })
    return false
  }

  if (authTokens.length === 0) return true

  const authHeader = req.headers['authorization']
  const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader
  const bearerToken =
    authHeaderStr && typeof authHeaderStr === 'string' && authHeaderStr.toLowerCase().startsWith('bearer ')
      ? authHeaderStr.slice('bearer '.length).trim()
      : null

  const directTokenHeader = req.headers['x-auth-token']
  const directToken = Array.isArray(directTokenHeader) ? directTokenHeader[0] : directTokenHeader
  const token = bearerToken || (typeof directToken === 'string' ? directToken : null)

  if (!token || !authTokens.includes(token)) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    })
    return false
  }
  return true
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (!authenticate(req, res)) return

  try {
    if (req.method === 'POST') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      let transport: StreamableHTTPServerTransport

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId]
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports[sid] = transport
          },
        })

        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId]
          }
        }

        const mcpServer = new GoogleWorkspaceMCPServer()
        await mcpServer.connect(transport)
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        })
        return
      }

      await transport.handleRequest(req as any, res as any, req.body)
    } else if (req.method === 'GET' || req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID')
        return
      }
      await transports[sessionId].handleRequest(req as any, res as any)
    } else {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not allowed' },
        id: null,
      })
    }
  } catch (error) {
    console.error('MCP Error:', error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: `Internal error: ${error instanceof Error ? error.message : 'Unknown'}` },
        id: null,
      })
    }
  }
}
