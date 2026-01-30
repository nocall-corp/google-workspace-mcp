# Google Workspace MCP Server

Google Workspace（Calendar, Gmail, Drive, Tasks）にアクセスするための MCP サーバーです。
Vercel にデプロイして使用します。

## 機能

### Calendar
- `google_calendar_list_events` - イベント一覧取得
- `google_calendar_get_event` - イベント詳細取得
- `google_calendar_create_event` - イベント作成
- `google_calendar_update_event` - イベント更新
- `google_calendar_delete_event` - イベント削除
- `google_calendar_list_calendars` - カレンダー一覧取得

### Gmail
- `google_gmail_search` - メール検索
- `google_gmail_get_message` - メール詳細取得
- `google_gmail_send` - メール送信
- `google_gmail_list_labels` - ラベル一覧
- `google_gmail_modify_labels` - ラベル変更

### Drive
- `google_drive_list` - ファイル一覧
- `google_drive_search` - ファイル検索
- `google_drive_get_file` - ファイル詳細取得
- `google_drive_get_content` - ファイル内容取得

### Tasks
- `google_tasks_list_tasklists` - タスクリスト一覧
- `google_tasks_list` - タスク一覧
- `google_tasks_create` - タスク作成
- `google_tasks_update` - タスク更新
- `google_tasks_complete` - タスク完了
- `google_tasks_delete` - タスク削除

## セットアップ

### 1. Google Cloud Console でサービスアカウントを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択（または新規作成）
3. **IAM と管理** > **サービスアカウント** を開く
4. **サービスアカウントを作成** をクリック
5. 名前を入力して作成
6. **キー** タブで **鍵を追加** > **新しい鍵を作成** > **JSON** を選択
7. JSON ファイルがダウンロードされる

### 2. ドメイン全体の委任を設定

サービスアカウントでユーザーのデータにアクセスするには、ドメイン全体の委任が必要です。

1. Google Cloud Console で、作成したサービスアカウントを開く
2. **詳細設定を表示** をクリック
3. **ドメイン全体の委任** を有効化
4. **一意の ID**（クライアント ID）をコピー

5. [Google Admin Console](https://admin.google.com/) にアクセス
6. **セキュリティ** > **アクセスとデータ管理** > **API の制御** を開く
7. **ドメイン全体の委任** > **API クライアントを管理** をクリック
8. **新しいクライアントを追加**
   - クライアント ID: 上でコピーした ID
   - OAuth スコープ（カンマ区切り）:
     ```
     https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/tasks
     ```

### 3. Vercel にデプロイ

```bash
# リポジトリをクローン
cd /Users/shogohayashi/dev/google-workspace-mcp

# 依存関係をインストール
npm install

# Vercel にデプロイ
vercel

# 本番デプロイ
vercel --prod
```

### 4. 環境変数を設定

Vercel ダッシュボードで以下の環境変数を設定:

| 変数名 | 説明 |
|--------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウントの JSON キー（1行に整形） |
| `GOOGLE_DELEGATED_USER` | 委任先ユーザーのメールアドレス（例: hayashi@nocall.ai） |
| `MCP_AUTH_TOKEN` | MCP 認証トークン（任意の文字列） |

**GOOGLE_SERVICE_ACCOUNT_KEY の設定方法:**

```bash
# JSON を 1 行に変換
cat service-account-key.json | jq -c .
```

出力された文字列を環境変数に設定してください。

### 5. mcp.json に追加

```json
{
  "mcpServers": {
    "google-workspace": {
      "url": "https://google-workspace-mcp.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer ${GOOGLE_WORKSPACE_MCP_AUTH_TOKEN}"
      }
    }
  }
}
```

## 使用例

### カレンダーの予定を取得

```
今日の予定を教えて
```

### メールを検索

```
過去7日間の未読メールを確認して
```

### タスクを作成

```
「レポート作成」というタスクを追加して、期限は明日
```

## ライセンス

MIT
