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
   - 「Docker Desktop の画面右上」に “Kubernetes is running” 的な表示が出ればOK。

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