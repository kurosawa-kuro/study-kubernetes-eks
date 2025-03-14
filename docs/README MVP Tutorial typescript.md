# MVP Tutorial: TypeScript Guestbook Application

## プロジェクト概要
TypeScriptで実装されたゲストブックアプリケーション。Kubernetes上で動作し、PostgreSQLデータベースを使用してデータを永続化します。

## プロジェクト構造
```
study-kubernetes-eks/
├── k8s/
│   └── typescript/
│       ├── src/
│       │   ├── index.ts
│       │   └── views/
│       │       └── index.ejs
│       ├── Dockerfile
│       └── k8s/
│           ├── deployment.yaml
│           └── service.yaml
└── docs/
    └── README MVP Tutorial typescript.md
```

## セットアップ手順

### 1. アプリケーションのビルドとDockerイメージの作成
```bash
cd k8s/typescript
docker build -t hono-app .
```

### 2. ECRリポジトリの作成とイメージのプッシュ
```bash
# ECRリポジトリの作成
aws ecr create-repository --repository-name hono-app

# ECRへのログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com

# イメージのタグ付けとプッシュ
docker tag hono-app:latest 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest
docker push 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest
```

### 3. Kubernetesシークレットの作成
```bash
# データベース接続情報のシークレット作成
kubectl create secret generic database-secret \
  --from-literal=url="postgresql://dbmasteruser:dbmaster@ls-644e915cc7a6ba69ccf824a69cef04d45c847ed5.cps8g04q216q.ap-northeast-1.rds.amazonaws.com:5432/dbmaster" \
  --namespace=default

# 環境変数のシークレット作成
kubectl create secret generic env-test-secret \
  --from-literal=test="test test test" \
  --namespace=default
```

### 4. ECR認証用のシークレット作成
```bash
kubectl create secret docker-registry ecr-secret \
  --docker-server=677276118659.dkr.ecr.ap-northeast-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region ap-northeast-1) \
  --namespace=default
```

### 5. Kubernetesマニフェストの適用
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 環境変数の管理

### シークレットの作成
環境変数をシークレットとして管理する場合：

```bash
# シークレットの作成
kubectl create secret generic <secret-name> \
  --from-literal=<key>=<value> \
  --namespace=default
```

### デプロイメントでの使用
`deployment.yaml`で環境変数をシークレットから参照する場合：

```yaml
env:
  - name: ENV_VARIABLE
    valueFrom:
      secretKeyRef:
        name: <secret-name>
        key: <key>
```

### シークレットの確認
```bash
# シークレットの詳細確認
kubectl describe secret <secret-name>

# Pod内の環境変数確認
kubectl exec -it <pod-name> -- env | grep <ENV_VARIABLE>
```

## トラブルシューティング

### 1. イメージの取得エラー
- エラー: `ImagePullBackOff`
- 原因: ECRからのイメージ取得に失敗
- 解決方法:
  1. ECR認証用のシークレットが正しく作成されているか確認
  2. `deployment.yaml`の`imagePullSecrets`が正しく設定されているか確認
  3. ECRリポジトリへのアクセス権限を確認

### 2. データベース接続エラー
- エラー: `database-secret not found`
- 原因: データベース接続情報のシークレットが存在しない
- 解決方法:
  1. `database-secret`が正しく作成されているか確認
  2. シークレットの内容が正しいか確認

### 3. 環境変数の設定エラー
- エラー: 環境変数が設定されていない
- 原因: シークレットの設定ミス
- 解決方法:
  1. シークレットが正しく作成されているか確認
  2. `deployment.yaml`の環境変数設定を確認
  3. Pod内の環境変数を確認

## アプリケーションへのアクセス
- URL: http://localhost:30081
- ポート: 30081 (NodePort)

## メンテナンスコマンド
```bash
# デプロイメントの再起動
kubectl rollout restart deployment hono-deployment

# Podの状態確認
kubectl get pods

# ログの確認
kubectl logs <pod-name>

# シークレットの更新
kubectl create secret generic <secret-name> \
  --from-literal=<key>=<new-value> \
  --namespace=default \
  --dry-run=client -o yaml | kubectl apply -f -