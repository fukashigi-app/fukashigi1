#!/bin/bash
# Firebase Storage CORS 設定スクリプト
# 実行前に Google Cloud SDK (gsutil) がインストールされていることを確認してください
# https://cloud.google.com/sdk/docs/install

set -e

BUCKET="fukashigi-1.appspot.com"
CORS_FILE="cors.json"

echo "Firebase Storage CORS 設定を適用します..."
echo "バケット: gs://${BUCKET}"

gsutil cors set "${CORS_FILE}" "gs://${BUCKET}"

echo "完了しました。現在の CORS 設定:"
gsutil cors get "gs://${BUCKET}"
