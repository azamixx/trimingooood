#!/bin/bash
cd "$(dirname "$0")/client"

# Vite開発サーバー起動
npx vite &
CLIENT_PID=$!

# ブラウザを開く（少し待ってから）
sleep 2
open http://localhost:5173

echo ""
echo "=== トリミンGooood!! 起動完了 ==="
echo "ブラウザ: http://localhost:5173"
echo "終了するには このウィンドウを閉じてください"
echo ""

# ウィンドウが閉じられたらプロセスを停止
trap "kill $CLIENT_PID 2>/dev/null; exit" EXIT INT TERM
wait
