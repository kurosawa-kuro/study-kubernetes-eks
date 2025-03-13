# ---- Stage 1: Build ----
    FROM node:18-alpine AS builder

    WORKDIR /app
    
    # package.json, package-lock.jsonをコピー
    COPY package*.json ./
    COPY tsconfig.json ./
    COPY src ./src
    
    # 依存関係インストール
    RUN npm install
    
    # TypeScriptビルド
    RUN npm run build
    
    # ---- Stage 2: Run ----
    FROM node:18-alpine
    
    WORKDIR /app
    
    # ビルド成果物のみコピー
    COPY --from=builder /app/dist ./dist
    COPY package*.json ./
    
    # プロダクション依存だけ入れるならこんな感じ
    RUN npm install --omit=dev
    
    EXPOSE 3000
    
    CMD ["node", "dist/index.js"]
    