以下では、**ECS Fargate** で **SSM Parameter Store** の値を**コンテナの環境変数**として読み込む最小構成（MVP）のまとめを示します。これで**アプリがシークレット情報（DBパスワードなど）**を安全に受け取れるようになります。

---

# 1. 概要フロー

1. **Parameter Store** で機密情報（または設定値）を作成 (SecureString など)  
2. **IAMロール** (`ecsTaskExecutionRole` など) に `ssm:GetParameter(s)` 権限を付与  
3. **ECSタスク定義のコンテナ設定** で `Secrets` フィールドに `valueFrom` を **Parameter ARN** に指定  
4. タスク実行時、**コンテナ内の環境変数**として SSMの値が読み込まれる

---

# 2. 手順一覧

## 2-1. Parameter Store の作成

1. **AWSコンソール → Systems Manager → Parameter Store → パラメータの作成**  
2. **名前**: `/myapp/DB_PASSWORD` など (階層構造にすると便利)  
3. **タイプ**: SecureString(推奨) or String  
4. **値**: `example-secret`

> **ポイント**: 複数パラメータを使う場合は`/myapp/〜` のように階層化すると管理しやすい

---

## 2-2. IAMロールの権限 (Task Execution Role)

1. **IAMコンソール → ロール**  
2. **`ecsTaskExecutionRole`**(または新規作成ロール)を選択  
3. インラインポリシー追加 (または 既存ポリシーに追記)

例のポリシーJSON:
```jsonc
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:ap-northeast-1:123456789012:parameter/myapp/*"
    }
  ]
}
```
- Resourceを特定の1パラメータだけに限定したい場合は `...:parameter/myapp/DB_PASSWORD` のように ARNを明示

---

## 2-3. ECSタスク定義にSecretsを設定

### コンソール例

1. **ECSコンソール → Task Definitions → 新規 or 既存タスク定義を編集**  
2. **Container definition** で Container name をクリックし、Environmentセクションへ移動  
3. **Secrets (ValueFrom)** を利用  
   - Name: `DB_PASSWORD` (コンテナ内の環境変数名)  
   - ValueFrom: `arn:aws:ssm:ap-northeast-1:123456789012:parameter/myapp/DB_PASSWORD`  
4. **保存** → 新タスク定義を登録

> **注意**: 「Environment Variables」欄の “Value” に ARN を直接書いてしまうと単なる文字列扱いになり、Secretsとして解決されない。

---

## 2-4. Service or Taskで起動

1. **ECS → Cluster → Create Service** か、**Run Task** いずれかで起動  
2. **Launch type**: Fargate  
3. **タスク定義**: 先ほど作成した TaskDefinition  
4. セキュリティグループ/サブネットなど必要最小限を設定  
5. 実行後、**コンテナ内で `process.env.DB_PASSWORD`** (Node.jsの場合) などを確認→ SSMの実際の値が入っていればOK

---

# 3. よくあるエラーと対策

1. **`AccessDeniedException: not authorized to perform ssm:GetParameters`**  
   - → `ecsTaskExecutionRole` に `ssm:GetParameter`/`ssm:GetParameters` ポリシーを追加して解消  
2. **Secretsを設定したが文字列ARNがそのまま映る**  
   - → Environment Variables欄に書いてしまった可能性。**必ず"Secrets"欄**を使うこと  
3. **SecureString の KMS権限**  
   - SecureStringをカスタムKMSキーで暗号化している場合、`kms:Decrypt` 権限も必要

---

# 4. 追加ポイント

- **複数パラメータ** を使うなら `/myapp/*` のようにワイルドカードをIAMポリシーに設定し、タスク定義の `secrets` に複数追加  
- **CDKでIaC**: `containerDefinition.secrets = { DB_PASSWORD: ecs.Secret.fromSsmParameter(...) }` という書き方で自動設定  
- **Parameter Store vs Secrets Manager**: ECSのSecrets欄はSecrets Managerも使える。必要に応じて自動ローテーションなど使いたい場合はSecrets Managerが便利

---

## まとめ

- **ECS Fargate** + **Parameter Store** でコンテナに機密情報を渡すには、**Task Execution Role** に `ssm:GetParameter(s)` を付与し、**タスク定義の "Secrets" フィールド** で `ValueFrom` に SSM パラメータARN を指定。  
- これでコンテナ起動時に自動的にSSMから値をフェッチし、環境変数として利用可能。  
- **ALB不要のMVP**構成なら最小限の設定で動き、**認証情報などをソースコードにベタ書きせず済む**メリットが得られます。