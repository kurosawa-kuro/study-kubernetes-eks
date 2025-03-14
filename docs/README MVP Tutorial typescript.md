# MVP Tutorial - TypeScript Hono Application

## 概要
TypeScriptで実装されたHonoアプリケーションをKubernetes上で動作させるためのチュートリアルです。

## 前提条件
- Docker Desktop
- kubectl
- AWS CLI
- Node.js 18以上

## プロジェクト構造
```
study-kubernetes-eks/
├── k8s/
│   └── typescript/
│       ├── src/
│       │   ├── index.ts
│       │   └── views/
│       ├── k8s/
│       │   ├── deployment.yaml
│       │   └── service.yaml
│       ├── Dockerfile
│       └── package.json
```

## セットアップ手順

### 1. ECRリポジトリの作成
```bash
aws ecr create-repository --repository-name hono-app --region ap-northeast-1
```

### 2. ECRへの認証
```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com
```

### 3. イメージのビルドとプッシュ
```bash
# イメージのビルド
docker build -t 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest .

# ECRへのプッシュ
docker push 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest
```

### 4. Kubernetes設定

#### 4.1 データベースシークレットの作成
```bash
kubectl create secret generic database-secret \
  --from-literal=url="postgresql://dbmasteruser:dbmaster@ls-644e915cc7a6ba69ccf824a69cef04d45c847ed5.cps8g04q216q.ap-northeast-1.rds.amazonaws.com:5432/dbmaster" \
  --namespace=default
```

#### 4.2 ECR認証シークレットの作成
```bash
kubectl create secret docker-registry ecr-secret \
  --docker-server=677276118659.dkr.ecr.ap-northeast-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region ap-northeast-1) \
  --namespace=default
```

#### 4.3 デプロイメントの適用
```bash
kubectl apply -f k8s/deployment.yaml
```

#### 4.4 サービスの適用
```bash
kubectl apply -f k8s/service.yaml
```

### 5. 動作確認

#### 5.1 デプロイメントの状態確認
```bash
kubectl get deployment
kubectl get pods
kubectl get service
```

#### 5.2 ログの確認
```bash
kubectl logs <pod-name>
```

#### 5.3 アプリケーションへのアクセス
```
http://localhost:30081
```

## 設定ファイル

### deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hono-deployment
  labels:
    app: hono-app
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: hono-app
  template:
    metadata:
      labels:
        app: hono-app
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
    spec:
      imagePullSecrets:
        - name: ecr-secret
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: hono-container
          image: 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app
          imagePullPolicy: Always
          ports:
            - containerPort: 3001
              name: http
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 3
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-secret
                  key: url
```

### service.yaml
```yaml
apiVersion: v1
kind: Service
metadata:
  name: hono-service
spec:
  selector:
    app: hono-app
  type: NodePort
  ports:
    - name: http
      port: 3001
      targetPort: 3001
      protocol: TCP
      nodePort: 30081
```

### Dockerfile
```dockerfile
# ---- Stage 1: Dependencies ----
FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: Builder ----
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build TypeScript
RUN npm run build

# ---- Stage 3: Runner ----
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 honouser

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/views ./dist/views

# Set permissions
RUN chown -R honouser:nodejs /app && \
    chmod 755 /app

# Switch to non-root user
USER honouser

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
```

## トラブルシューティング

### 1. イメージの取得に失敗する場合
- ECRへの認証が正しく設定されているか確認
- イメージがECRにプッシュされているか確認
- ECRシークレットが正しく作成されているか確認

### 2. データベース接続エラー
- データベースシークレットが正しく作成されているか確認
- データベースの接続情報が正しいか確認

### 3. アプリケーションにアクセスできない
- サービスのポート設定を確認
- Podが正常に動作しているか確認
- ログを確認してエラーの有無を確認

## 次のステップ
1. 負荷テストの実施
2. ログ監視の設定
3. バックアップ戦略の検討
4. セキュリティ設定の見直し

ここでは、**Docker Desktop に付属のKubernetes** 機能を使い、WSL2 上で最小限の Kubernetes（Deployment & Service）を動かす方法を解説します。  
（※ 他にも Minikube や kind を使う方法がありますが、Docker Desktop を使うのが最もシンプルです。）

---

# 1. Docker Desktop で Kubernetes を有効化

1. **Docker Desktop を起動**  
   - Windows 上で Docker Desktop アプリを開く。

2. **設定（Settings）を開く**  
   - 左サイドバーの「Settings」を選択。

3. **Kubernetesを有効化**  
   - 「Kubernetes」タブで「Enable Kubernetes」にチェックを入れ、Apply/Save。  
   - 数分待つと、Docker Desktop が**シングルノードのKubernetesクラスタ**を構築してくれる。

4. **動作確認**  
   - 「Docker Desktop の画面右上」に "Kubernetes is running" 的な表示が出ればOK。

---

# 2. kubectl コマンドの準備 (WSL2 Ubuntu)

**手元に kubectl が入っていない**場合、WSL2(Ubuntu) で以下の手順でインストールします。

```bash
sudo apt update
sudo apt install snapd

sudo snap install kubectl --classic

kubectl version --client

```

> ※ `focal` は Ubuntu 20.04 LTS 向けの例です。WSLのUbuntuバージョンによっては `jammy` (22.04) にする場合も。

---

# 3. kubeconfig の設定

Docker Desktop が提供する Kubernetes クラスタにアクセスするための設定 (`kubeconfig`) を整えます。  
通常は **Docker Desktop インストール時に自動的に** `%USERPROFILE%\.kube\config` (Windows上) に書き込まれ、WSL2 からも参照できます。

- 確認コマンド (WSL2上):
  ```bash
  kubectl config get-contexts
  ```
  Docker Desktop のコンテキスト (`docker-desktop`) が表示されればOK。

- 動作確認:
  ```bash
  kubectl get nodes
  ```
  `docker-desktop` という名前の Node が1つ表示されれば、Kubernetesクラスタが動いています。

---

# 4. Nginxを Deployment と Service で起動する

## 4-1. ファイル構成例

```plaintext
study-kubernetes-eks/
├── deployment.yaml
└── service.yaml
```

### (1) deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx-sample
  template:
    metadata:
      labels:
        app: nginx-sample
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
```

- **replicas: 2**  
  - Nginxコンテナを2つのPodで起動し、ロードバランスとセルフヒーリングを体験できるようにする。  

### (2) service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx-sample
  ports:
  - port: 80
    targetPort: 80
  type: NodePort
```

- **type: NodePort**  
  - Docker Desktop のKubernetes上で、NodePortを使ってローカルホストへアクセス可能にする（クラスタ外→Podへのリクエスト転送）。

---

## 4-2. kubectl apply でデプロイ

```bash
# study-kubernetes-eks ディレクトリへ移動
cd ~/dev/study-kubernetes-eks

# マニフェスト適用
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# 状態確認
kubectl get deployment
kubectl get pods
kubectl get service
```

- **Pods** が2つ `Running` 状態になっていればOK。  
- **Service** の `nginx-service` を確認すると `NodePort` のポート番号が表示される（例: 30080 など）。

---

# 5. Nginx へのアクセス確認

1. **Service情報の確認**  
   ```bash
   kubectl get svc nginx-service
   ```
   **出力例** (一部):
   ```
   NAME             TYPE       CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE
   nginx-service    NodePort   10.109.45.171  <none>        80:30080/TCP   1m
   ```

2. **ブラウザからアクセス**  
   - Windows(ホスト)側のブラウザで `http://localhost:30080` にアクセスすると、Nginx デフォルトページ「Welcome to nginx!」が表示される。  
     - Docker Desktop のKubernetesの場合、`localhost:<NodePort>` でアクセス可能（NodePort が 30080 なら `http://localhost:30080`）。

3. **WSL2上でcurl**  
   ```bash
   curl localhost:30080
   ```
   Nginx のHTML が返ってくるのを確認。

---

# 6. 動作テスト・セルフヒーリング実験

1. **Pod削除テスト**  
   ```bash
   # Pod 名を確認
   kubectl get pods
   # 例: nginx-deployment-74bf4868df-xxxxx

   # 1つ削除
   kubectl delete pod nginx-deployment-74bf4868df-xxxxx

   # 再度確認
   kubectl get pods
   ```
   → 数秒すると、自動的に新しいPodが起動し、常に2つのPodが維持される（Deploymentのreplicas=2が反映）。これがセルフヒーリングの仕組み。

2. **ログ確認**  
   ```bash
   kubectl logs <pod-name>
   ```
   Nginxのアクセスログが確認できる（標準出力に出るものは少ないが動作確認には十分）。

---

## 7. まとめ

1. **Docker Desktop** の「Enable Kubernetes」を利用すると、WSL2 上でも簡単にシングルノードK8sクラスタを扱える。  
2. **kubectl** を WSL2(Ubuntu) にインストールし、コンテキストに `docker-desktop` が設定されていれば `kubectl apply -f` でDeploymentとServiceが動く。  
3. **NodePort** を使って `http://localhost:<NodePort>` にアクセスすれば、Nginxデフォルトページを表示可能。  
4. **Pod削除 → 自動再作成** のセルフヒーリング機能を確認することで Kubernetes の基礎を体験できる。  

この方法で最小限の **Deployment / Service** を学習してから、さらに **Ingress / ConfigMap / Secret** などを追加していくと理解が深まります。  