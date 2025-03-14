import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import ejs from 'ejs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// PostgreSQLの接続設定
const pool = new pg.Pool({
  connectionString: "postgresql://dbmasteruser:dbmaster@ls-644e915cc7a6ba69ccf824a69cef04d45c847ed5.cps8g04q216q.ap-northeast-1.rds.amazonaws.com:5432/dbmaster",
  ssl: {
    rejectUnauthorized: false
  }
})

// テーブル作成を確認
const initializeDatabase = async () => {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS guestbook_entries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (error) {
    console.error('データベース初期化エラー:', error)
  } finally {
    client.release()
  }
}

// データベースの初期化を実行
initializeDatabase()

// PostgreSQLのレコード型定義
interface GuestbookEntry {
  id: number;
  name: string;
  message: string;
  created_at: Date;
}

// カスタム型定義
type Variables = {
  render: (template: string, data?: Record<string, unknown>) => Promise<string>
  dbPool: pg.Pool
}

const app = new Hono<{ Variables: Variables }>()

// PostgreSQLクライアントの設定
app.use('*', async (c: Context, next: Next) => {
  c.set('dbPool', pool)
  await next()
})

// EJSテンプレートの設定
app.use('*', async (c: Context, next: Next) => {
  c.set('render', async (template: string, data: Record<string, unknown> = {}) => {
    const templatePath = join(__dirname, 'views', `${template}.ejs`)
    const templateContent = readFileSync(templatePath, 'utf-8')
    return ejs.render(templateContent, data)
  })
  await next()
})

// メインルート
app.get('/', async (c: Context) => {
  const client = await c.get('dbPool').connect()
  try {
    const result = await client.query({
      text: 'SELECT * FROM guestbook_entries ORDER BY created_at DESC',
      rowMode: 'array'
    })
    const html = await c.get('render')('index', {
      title: 'ゲストブック',
      entries: result.rows.map((row: any) => ({
        id: row[0],
        name: row[1],
        message: row[2],
        createdAt: row[3]
      }))
    })
    return c.html(html)
  } catch (error) {
    console.error('データ取得エラー:', error)
    return c.text('エラーが発生しました', 500)
  } finally {
    client.release()
  }
})

// 新規メッセージの作成
app.post('/entries', async (c: Context) => {
  const formData = await c.req.formData()
  const name = formData.get('name') as string
  const message = formData.get('message') as string

  if (!name || !message) {
    return c.redirect('/')
  }

  const client = await c.get('dbPool').connect()
  try {
    await client.query(
      'INSERT INTO guestbook_entries (name, message) VALUES ($1, $2)',
      [name, message]
    )
    return c.redirect('/')
  } catch (error) {
    console.error('データ挿入エラー:', error)
    return c.text('エラーが発生しました', 500)
  } finally {
    client.release()
  }
})

// ヘルスチェックエンドポイント
app.get('/health', (c) => c.json({ status: 'ok' }))
app.get('/ready', (c) => c.json({ status: 'ready' }))

serve({
  fetch: app.fetch,
  port: 3000
}, (info: { port: number }) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
