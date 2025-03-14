dev:
	npm run dev

build:
	npm run build && ls -la dist/

run:
	npm run build && npm start

# Docker関連のコマンド
.PHONY: docker-build docker-run docker-stop docker-clean docker-logs docker-shell

# Dockerイメージをビルド
docker-build:
	docker build -t guestbook-app .

# Dockerコンテナを起動
docker-run:
	@echo "🔍 既存のコンテナを確認中..."
	@docker stop guestbook-container 2>/dev/null || true
	@docker rm guestbook-container 2>/dev/null || true
	@echo "🚀 新しいコンテナを起動中..."
	docker run -d \
		-p 3001:3001 \
		-e DATABASE_URL="postgresql://dbmasteruser:dbmaster@ls-644e915cc7a6ba69ccf824a69cef04d45c847ed5.cps8g04q216q.ap-northeast-1.rds.amazonaws.com:5432/dbmaster" \
		--name guestbook-container \
		guestbook-app
	@echo "✅ コンテナが起動しました"

# Dockerコンテナを停止
docker-stop:
	docker stop guestbook-container

# Dockerコンテナとイメージを削除
docker-clean:
	docker stop guestbook-container || true
	docker rm guestbook-container || true
	docker rmi guestbook-app || true

# Dockerコンテナのログを表示
docker-logs:
	docker logs -f guestbook-container

# Dockerコンテナ内のシェルに接続
docker-shell:
	docker exec -it guestbook-container /bin/sh

# 全てのDockerプロセスを一括で実行（ビルド＆起動）
docker-all: docker-build docker-run
	@echo "Docker container is running on http://localhost:3001"
