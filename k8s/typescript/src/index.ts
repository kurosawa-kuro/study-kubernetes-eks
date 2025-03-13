import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import ejs from 'ejs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Prismaクライアントの初期化
const prisma = new PrismaClient()

// カスタム型定義
type Variables = {
  render: (template: string, data?: Record<string, unknown>) => Promise<string>
  prisma: PrismaClient
}

const app = new Hono<{ Variables: Variables }>()

// Prismaクライアントの設定
app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  await next()
})

// EJSテンプレートの設定
app.use('*', async (c, next) => {
  c.set('render', async (template: string, data: Record<string, unknown> = {}) => {
    const templatePath = join(__dirname, 'views', `${template}.ejs`)
    const templateContent = readFileSync(templatePath, 'utf-8')
    return ejs.render(templateContent, data)
  })
  await next()
})

// メインルート
app.get('/', async (c) => {
  const entries = await c.get('prisma').guestbook.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
  
  const html = await c.get('render')('index', {
    title: 'ゲストブック',
    entries
  })
  return c.html(html)
})

// 新規メッセージの作成
app.post('/entries', async (c) => {
  const formData = await c.req.formData()
  const name = formData.get('name') as string
  const message = formData.get('message') as string

  if (!name || !message) {
    return c.redirect('/')
  }

  await c.get('prisma').guestbook.create({
    data: {
      name,
      message
    }
  })

  return c.redirect('/')
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
