cd ~/dev/study-kubernetes-eks/k8s/typescript
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t hono-app .
docker tag hono-app:latest 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest
docker push 677276118659.dkr.ecr.ap-northeast-1.amazonaws.com/hono-app:latest