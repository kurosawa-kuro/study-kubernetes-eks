# EKSデプロイメントガイド: TypeScript Guestbook Application

## 作業環境の準備

### 1. Lightsailインスタンスの準備
1. AWSマネジメントコンソールにログイン
2. Lightsailコンソールにアクセス
3. 「インスタンスの作成」をクリック
4. インスタンス設定：
   - インスタンス名: `hono-eks-dev`
   - 可用性ゾーン: `ap-northeast-1a`
   - オペレーティングシステム: `Amazon Linux 2023`
   - ブループリント: `OS Only`
   - インスタンスプラン: `2GB RAM, 1 vCPU, 60GB SSD`
   - SSHキーペア: 新規作成（`hono-eks-key`）

### 2. インスタンスへの接続
```bash
# キーペアのダウンロード
# Lightsailコンソールからダウンロードしたキーペアを適切な場所に配置
chmod 400 ~/.ssh/hono-eks-key.pem

# インスタンスへの接続
ssh -i ~/.ssh/hono-eks-key.pem ec2-user@<your-instance-public-ip>
```

### 3. 必要なツールのインストール
インスタンスのターミナルで以下のコマンドを実行：

```bash
# システムの更新
sudo dnf update -y

# AWS CLIのインストール
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# kubectlのインストール
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# eksctlのインストール
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# インストール確認
aws --version
kubectl version --client
eksctl version
```

### 4. AWS認証情報の設定
```bash
# AWS認証情報の設定
aws configure
# AWS Access Key ID: あなたのアクセスキー
# AWS Secret Access Key: あなたのシークレットキー
# Default region name: ap-northeast-1
# Default output format: json
```

### 5. 作業ディレクトリの準備
```bash
# 作業ディレクトリの作成
mkdir -p ~/hono-eks
cd ~/hono-eks

# プロジェクトファイルのダウンロード（GitHubから）
git clone <your-repository-url> .
```

## 前提条件
- Lightsailインスタンスが準備されていること
- AWS認証情報が設定されていること
- 必要なIAM権限が設定されていること
- ECRにイメージがプッシュ済みであること（`677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest`）

## 1. EKSクラスタの作成

### 方法1: AWSコンソールからの作成（推奨）

1. [EKSコンソール](https://ap-northeast-1.console.aws.amazon.com/eks/cluster-create?region=ap-northeast-1)にアクセス
2. 「クラスターの作成」をクリック
3. クラスター設定：
   - クラスター名: `hono-cluster`
   - Kubernetesバージョン: 最新の安定版を選択
   - クラスターサービスロール: 新しいロールを作成
4. ネットワーク設定：
   - デフォルトVPCを使用
   - サブネット: すべてのアベイラビリティーゾーンを選択
   - セキュリティグループ: 自動作成を選択
5. ロギング設定：
   - 必要に応じて有効化（開発環境では無効でも可）
6. アドオン設定：
   - Amazon VPC CNIプラグイン
   - CoreDNS
   - kube-proxy
7. ノードグループの設定：
   - ノードグループ名: `ng-1`
   - インスタンスタイプ: `t3.medium`
   - 希望するサイズ: 2
   - 最小サイズ: 1
   - 最大サイズ: 3
   - ディスク容量: 20GB
8. 「作成」をクリック

### 方法2: eksctlを使用した作成

### 1.1. eksctlのインストール
```bash
# eksctlのインストール
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
eksctl version
```

### 1.2. クラスタ設定ファイルの作成
```yaml
# cluster.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: hono-cluster
  region: ap-northeast-1

nodeGroups:
  - name: ng-1
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 1
    maxSize: 3
    volumeSize: 20
    volumeType: gp3
    iam:
      withAddonPolicies:
        ebs: true
```

### 1.3. クラスタの作成
```bash
eksctl create cluster -f cluster.yaml
```

## 2. クラスタへの接続設定

### 2.1. kubeconfigの更新
```bash
aws eks update-kubeconfig --name hono-cluster --region ap-northeast-1
```

### 2.2. 接続確認
```bash
kubectl get nodes
```

## 3. アプリケーションのデプロイ

### 3.1. シークレットの作成
```bash
# データベース接続情報のシークレット作成
kubectl create secret generic database-secret \
  --from-literal=url="postgresql://dbmasteruser:dbmaster@ls-644e915cc7a6ba69ccf824a69cef04d45c847ed5.cps8g04q216q.ap-northeast-1.rds.amazonaws.com:5432/dbmaster" \
  --namespace=default

# 環境変数のシークレット作成
kubectl create secret generic env-test-secret \
  --from-literal=test="test test test" \
  --namespace=default

# ECR認証用のシークレット作成
kubectl create secret docker-registry ecr-secret \
  --docker-server=677276118659.dkr.ecr.ap-northeast-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region ap-northeast-1) \
  --namespace=default
```

### 3.2. アプリケーションのデプロイ
```bash
# デプロイメントとサービスの適用
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 4. アプリケーションへのアクセス設定

### 4.1. LoadBalancerサービスの作成
```yaml
# service-lb.yaml
apiVersion: v1
kind: Service
metadata:
  name: hono-service-lb
spec:
  selector:
    app: hono-app
  ports:
    - name: http
      port: 80
      targetPort: 3001
  type: LoadBalancer
```

```bash
kubectl apply -f service-lb.yaml
```

### 4.2. 外部アクセスURLの取得
```bash
kubectl get service hono-service-lb
```

## 5. 動作確認

### 5.1. Podの状態確認
```bash
kubectl get pods
```

### 5.2. ログの確認
```bash
kubectl logs <pod-name>
```

### 5.3. アプリケーションへのアクセス
- LoadBalancerのURLにアクセスして動作確認
- ゲストブックの投稿機能をテスト

## 6. トラブルシューティング

### 6.1. Podが起動しない場合
```bash
# Podの詳細確認
kubectl describe pod <pod-name>

# ログの確認
kubectl logs <pod-name>
```

### 6.2. データベース接続エラー
- セキュリティグループの設定を確認
- データベースの接続情報を確認

### 6.3. イメージの取得エラー
```bash
# ECR認証の確認
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com
```

## 7. クリーンアップ

### 7.1. アプリケーションの削除
```bash
kubectl delete -f service-lb.yaml
kubectl delete -f k8s/deployment.yaml
kubectl delete -f k8s/service.yaml
```

### 7.2. シークレットの削除
```bash
kubectl delete secret database-secret env-test-secret ecr-secret
```

### 7.3. クラスタの削除
```bash
eksctl delete cluster --name hono-cluster
```

## 8. 注意点
- EKSクラスタの作成には約10-15分かかります
- クラスタの削除には約10-15分かかります
- リソースの削除を忘れると課金が発生する可能性があります
- 本番環境では適切なセキュリティ設定が必要です