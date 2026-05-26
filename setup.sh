#!/usr/bin/env bash
set -euo pipefail

# cloudflare-uptime — First-time setup
# Usage: ./setup.sh
#
# This script walks through every step needed to deploy the Worker for the first time.
# It will NOT modify wrangler.toml automatically — you will be prompted to paste values.

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}=== cloudflare-uptime Setup ===${RESET}"
echo ""

# ── Prerequisites check ──────────────────────────────────────────────────────

echo -e "${CYAN}Checking prerequisites...${RESET}"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Install it from https://nodejs.org/ (v20 or later)."
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20 or later is required (found $(node --version))."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required. It is bundled with Node.js."
  exit 1
fi

echo -e "${GREEN}Node.js $(node --version) found.${RESET}"

# ── Install dependencies ─────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}Installing dependencies...${RESET}"
npm install
echo -e "${GREEN}Dependencies installed.${RESET}"

# Wrangler is now available via npx after npm install
WRANGLER="npx wrangler"

# ── Cloudflare auth ───────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Step 1: Cloudflare authentication${RESET}"
echo ""
echo "If you are not already logged in, Wrangler will open a browser window."
echo "Press Enter to continue, or Ctrl-C to abort and log in manually with: npx wrangler login"
read -r

$WRANGLER whoami 2>/dev/null || {
  echo ""
  echo "Running wrangler login..."
  $WRANGLER login
}

# ── D1 database ───────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Step 2: Create D1 database${RESET}"
echo ""
echo "This will create a D1 database named 'uptime-monitor' in your Cloudflare account."
echo "Press Enter to continue, or Ctrl-C to skip (if the database already exists)."
read -r

echo ""
$WRANGLER d1 create uptime-monitor || true

echo ""
echo -e "${YELLOW}ACTION REQUIRED:${RESET}"
echo "Copy the 'database_id' from the output above."
echo "Open wrangler.toml and paste it into the database_id field:"
echo ""
echo "  [[d1_databases]]"
echo "  binding = \"DB\""
echo "  database_name = \"uptime-monitor\""
echo "  database_id = \"PASTE_HERE\""
echo ""
echo "Press Enter once you have updated wrangler.toml..."
read -r

# ── Schema ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Step 3: Apply database schema${RESET}"
echo ""
echo "Applying schema.sql to the remote D1 database..."
$WRANGLER d1 execute uptime-monitor --remote --file=schema.sql
echo -e "${GREEN}Schema applied.${RESET}"

# ── R2 bucket ────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Step 4: Create R2 bucket${RESET}"
echo ""
echo "This will create an R2 bucket named 'uptime-assets' for logo uploads."
echo "Press Enter to continue, or Ctrl-C to skip (if the bucket already exists)."
read -r

$WRANGLER r2 bucket create uptime-assets || true
echo ""
echo "If you used a different bucket name, update wrangler.toml:"
echo ""
echo "  [[r2_buckets]]"
echo "  binding = \"ASSETS\""
echo "  bucket_name = \"your-bucket-name\""
echo ""

# ── API key secret ────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Step 5: Set API key secret${RESET}"
echo ""
echo "You will be prompted to enter your API key. Generate a strong one with:"
echo "  openssl rand -hex 32"
echo ""
echo "This key authenticates all admin API requests (X-API-Key header)."
echo "Press Enter to run: wrangler secret put API_KEY"
read -r

$WRANGLER secret put API_KEY

# ── Deploy ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Step 6: Deploy${RESET}"
echo ""
echo "Ready to deploy the Worker. Press Enter to run: npm run deploy"
echo "(Ctrl-C to skip and deploy manually later)"
read -r

npm run deploy

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}=== Setup complete! ===${RESET}"
echo ""
echo "Your Worker is now live. Next steps:"
echo ""
echo "  1. Open the admin dashboard at your Worker URL (shown above) and add monitors"
echo "  2. Create a status page and assign monitors to it"
echo "  3. Share /status/<slug> with your users"
echo "  4. (Optional) Add custom domain routes in wrangler.toml under [[routes]]"
echo "  5. (Optional) Add CLOUDFLARE_API_TOKEN as a GitHub Actions secret for auto-deploy"
echo ""
echo -e "${CYAN}Using Claude Code? Run 'claude' in this directory -- CLAUDE.md has full context.${RESET}"
echo ""
