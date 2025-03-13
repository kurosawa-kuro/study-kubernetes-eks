import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import ejs from 'ejs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// カスタム型定義
type Variables = {
  render: (template: string, data?: Record<string, unknown>) => Promise<string>
}

const app = new Hono<{ Variables: Variables }>()

// EJSテンプレートの設定
app.use('*', async (c, next) => {
  c.set('render', async (template: string, data: Record<string, unknown> = {}) => {
    const templatePath = join(__dirname, 'views', `${template}.ejs`)
    const templateContent = readFileSync(templatePath, 'utf-8')
    return ejs.render(templateContent, data)
  })
  await next()
})

// サンプルルート
app.get('/', async (c) => {
  const html = await c.get('render')('index', {
    title: 'Welcome to Hono with EJS',
    message: 'Hello from EJS template!'
  })
  return c.html(html)
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
