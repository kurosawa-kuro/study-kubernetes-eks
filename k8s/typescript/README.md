# Hono TypeScript Application

## 概要
Honoフレームワークを使用したTypeScriptベースのWebアプリケーション。

## 技術スタック
- Node.js 18
- TypeScript
- Hono
- Prisma ORM
- SQLite (開発環境)
- Docker
- Kubernetes

## セットアップ手順

### 開発環境
1. 依存関係のインストール
```bash
npm install
```

2. 環境変数の設定
```bash
cp .env.example .env
```

3. データベースのセットアップ
```bash
npm run db:generate
npm run db:push
```

4. 開発サーバーの起動
```bash
npm run dev
```

### Dockerビルド
```bash
docker build -t hono-typescript:latest .
```

### Kubernetesデプロイ
```bash
kubectl apply -f k8s/
```

## 利用可能なスクリプト
- `npm run dev`: 開発サーバーの起動
- `npm run db:generate`: Prismaクライアントの生成
- `npm run db:push`: データベーススキーマの更新
- `npm run db:studio`: Prisma Studioの起動
- `npm run db:reset`: データベースのリセット

## アーキテクチャ
- フロントエンド: EJSテンプレート
- バックエンド: Hono + TypeScript
- データベース: Prisma ORM
- コンテナ化: Docker
- オーケストレーション: Kubernetes

## 環境変数
- `NODE_ENV`: 実行環境
- `PORT`: サーバーポート
- `DATABASE_URL`: データベース接続URL
- `JWT_SECRET`: JWT署名キー
- `LOG_LEVEL`: ログレベル

## ライセンス
MIT

```
open http://localhost:3000
```
