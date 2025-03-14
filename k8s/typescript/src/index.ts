import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import ejs from 'ejs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import * as dotenv from 'dotenv'

// 環境変数の読み込み
dotenv.config()

// 型定義
interface GuestbookEntry {
  id: number;
  name: string;
  message: string;
  created_at: Date;
}

type Variables = {
  render: (template: string, data?: Record<string, unknown>) => Promise<string>
  dbPool: pg.Pool | null
}

// 定数定義
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DB_CONFIG = {
  connectionString: process.env.DATABASE_URL || "postgresql://dbmasteruser:dbmaster@ls-644e915cc7a6ba69ccf824a69cef04d45c847ed5.cps8g04q216q.ap-northeast-1.rds.amazonaws.com:5432/dbmaster",
  ssl: {
    rejectUnauthorized: false
  }
}

// データベースサービス
class DatabaseService {
  private pool: pg.Pool | null = null;

  constructor() {
    try {
      this.pool = new pg.Pool(DB_CONFIG);
      console.log('データベース接続プールを作成しました');
    } catch (error) {
      console.error('データベース接続プールの作成に失敗しました:', error);
      this.pool = null;
    }
  }

  async initialize(): Promise<void> {
    if (!this.pool) {
      console.warn('データベース接続プールが利用できません');
      return;
    }

    let client;
    try {
      client = await this.pool.connect();
      console.log('データベースに接続しました');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS guestbook_entries (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('テーブルの初期化が完了しました');
    } catch (error) {
      console.error('データベース初期化エラー:', error);
      this.pool = null;
    } finally {
      if (client) client.release();
    }
  }

  getPool(): pg.Pool | null {
    return this.pool;
  }

  isConnected(): boolean {
    return this.pool !== null;
  }
}

// コントローラー
class GuestbookController {
  static async getEntries(c: Context): Promise<Response> {
    const pool = c.get('dbPool');
    if (!pool) {
      return c.html(await c.get('render')('index', {
        title: 'ゲストブック',
        entries: [],
        error: 'データベース接続が利用できません'
      }));
    }

    const client = await pool.connect();
    try {
      const result = await client.query({
        text: 'SELECT * FROM guestbook_entries ORDER BY created_at DESC',
        rowMode: 'array'
      });
      
      const entries: GuestbookEntry[] = result.rows.map((row: any) => ({
        id: row[0],
        name: row[1],
        message: row[2],
        created_at: row[3]
      }));

      const html = await c.get('render')('index', {
        title: 'ゲストブック',
        entries,
        error: null,
        env_test: process.env.ENV_TEST || 'ENV_TEST is not set'
      });
      
      return c.html(html);
    } catch (error) {
      console.error('データ取得エラー:', error);
      return c.html(await c.get('render')('index', {
        title: 'ゲストブック',
        entries: [],
        error: 'データの取得中にエラーが発生しました',
        env_test: process.env.ENV_TEST || 'ENV_TEST is not set'
      }));
    } finally {
      client.release();
    }
  }

  static async createEntry(c: Context): Promise<Response> {
    const pool = c.get('dbPool');
    if (!pool) {
      return c.redirect('/?error=database-unavailable');
    }

    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const message = formData.get('message') as string;

    if (!GuestbookController.validateEntry(name, message)) {
      return c.redirect('/?error=validation');
    }

    const client = await pool.connect();
    try {
      await client.query(
        'INSERT INTO guestbook_entries (name, message) VALUES ($1, $2)',
        [name, message]
      );
      console.log('データ挿入成功 guestbook_entries', name, message);
      return c.redirect('/');
    } catch (error) {
      console.error('データ挿入エラー:', error);
      return c.redirect('/?error=insert');
    } finally {
      client.release();
    }
  }

  private static validateEntry(name: string | null, message: string | null): boolean {
    return Boolean(name && message);
  }
}

// ミドルウェア
class Middleware {
  static async setupDatabase(c: Context, next: Next): Promise<void> {
    c.set('dbPool', dbService.getPool());
    await next();
  }

  static async setupTemplateEngine(c: Context, next: Next): Promise<void> {
    c.set('render', async (template: string, data: Record<string, unknown> = {}) => {
      const templatePath = join(__dirname, 'views', `${template}.ejs`);
      const templateContent = readFileSync(templatePath, 'utf-8');
      return ejs.render(templateContent, data);
    });
    await next();
  }

  static async errorHandler(c: Context, next: Next): Promise<void> {
    try {
      await next();
    } catch (error) {
      console.error('アプリケーションエラー:', error);
      c.status(500);
      c.header('Content-Type', 'text/plain');
      c.body('内部サーバーエラーが発生しました');
    }
  }
}

// アプリケーション初期化
const dbService = new DatabaseService();
await dbService.initialize();

const app = new Hono<{ Variables: Variables }>();

// ミドルウェアの設定
app.use('*', Middleware.errorHandler);
app.use('*', async (c: Context, next: Next) => {
  c.set('dbPool', dbService.getPool());
  if (!dbService.isConnected()) {
    console.warn('データベース接続が利用できない状態でリクエストを処理します');
  }
  await next();
});
app.use('*', Middleware.setupTemplateEngine);

// ルーティング
app.get('/', GuestbookController.getEntries);
app.post('/entries', GuestbookController.createEntry);

// ヘルスチェック
app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/ready', (c) => c.json({ status: 'ready' }));

// サーバー起動
serve({
  fetch: app.fetch,
  port: 3001
}, (info: { port: number }) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
