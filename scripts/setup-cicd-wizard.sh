#!/usr/bin/env bash
#
# EDGE KEEPER 一鍵綁定 Cloudflare × GitHub Actions 全自動部署精靈
#
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}=== EDGE KEEPER // Cloudflare CI/CD 自動部署精靈 ===${RESET}\n"

if ! command -v gh >/dev/null 2>&1; then
  echo -e "${YELLOW}找不到 gh CLI，請先安裝並執行 gh auth login。${RESET}"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo -e "${YELLOW}請先執行 gh auth login 登入 GitHub 帳號。${RESET}"
  exit 1
fi

REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [[ -z "$REPO_SLUG" ]]; then
  echo -e "${YELLOW}偵測不到 GitHub 遠端倉庫，請先確認 git remote origin 已設定。${RESET}"
  exit 1
fi

echo -e "目標倉庫：${GREEN}${REPO_SLUG}${RESET}\n"
echo "請到 Cloudflare Dashboard 準備以下兩項資料："
echo "  1. Account ID（首頁右側或 Workers & Pages 總覽頁）"
echo "  2. API Token（My Profile → API Tokens → 使用 'Edit Cloudflare Workers' 範本）"
echo ""

read -r -p "請貼上 CLOUDFLARE_ACCOUNT_ID: " CF_ACCOUNT_ID
if [[ ! "$CF_ACCOUNT_ID" =~ ^[a-fA-F0-9]{32}$ ]]; then
  echo -e "${YELLOW}Account ID 格式看起來不像 32 位十六進位字串，請確認後重試。${RESET}"
  exit 1
fi

read -r -s -p "請貼上 CLOUDFLARE_API_TOKEN (輸入時不顯示): " CF_API_TOKEN
echo ""
if [[ -z "$CF_API_TOKEN" ]]; then
  echo -e "${YELLOW}API Token 不可為空。${RESET}"
  exit 1
fi

echo -e "\n正在寫入 GitHub Repository Variable 與 Secret..."
gh variable set CLOUDFLARE_ACCOUNT_ID --repo "$REPO_SLUG" --body "$CF_ACCOUNT_ID"
gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO_SLUG" --body "$CF_API_TOKEN"

echo -e "${GREEN}已寫入完成！正在觸發 GitHub Actions 自動部署...${RESET}"
gh workflow run deploy.yml --repo "$REPO_SLUG"

echo -e "\n${GREEN}完成！${RESET}可執行以下指令追蹤部署進度並取得線上 *.workers.dev 網址："
echo "  gh run watch --repo $REPO_SLUG"
