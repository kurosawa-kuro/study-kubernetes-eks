# study-kubernetes-eks

## Overview
This repository demonstrates a minimal Kubernetes setup for Nginx using Docker Desktop on WSL2.

## Quick Start

```bash
# 1) Setup environment (Ubuntu WSL2, Docker Desktop with K8s enabled)
make setup

# 2) Deploy
make deploy

# 3) Check status
make status

# 4) Access Nginx
http://localhost:30080

# 5) Clean up
make clean


wsl@DESKTOP-E9H2EDQ:~/dev/study-kubernetes-eks$ pwd
/home/wsl/dev/study-kubernetes-eks


```
wsl@DESKTOP-E9H2EDQ:~/dev/study-kubernetes-eks$ make status 
=== Current status of Deployment, Pods, and Service ===
kubectl get deployment
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   2/2     2            2           13m
kubectl get pods
NAME                                READY   STATUS    RESTARTS   AGE
nginx-deployment-57fb748757-cm7lf   1/1     Running   0          13m
nginx-deployment-57fb748757-hjzl7   1/1     Running   0          9m48s
kubectl get service
NAME            TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
kubernetes      ClusterIP   10.96.0.1       <none>        443/TCP        27m
nginx-service   NodePort    10.109.139.62   <none>        80:30080/TCP   13m
```

# (1) 初回セットアップ（kubectlインストール）
make setup

# (2) デプロイ + 状態確認
make deploy
#  ...  PodやServiceが表示される

# (3) 後から状況を見たい
make status

# (4) 終わったら削除
make clean
