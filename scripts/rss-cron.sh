#!/bin/bash

# RSS Feed Update Cron Script
# This script fetches all active RSS feeds and updates the database

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Set environment variables
export NODE_ENV=production
export DATABASE_URL="file:./prisma/dev.db"

# Log timestamp
echo "[$(date)] Starting RSS feed update..."

# Call the RSS parser directly using Node.js
node -e "
const { fetchAllActiveRSSFeeds } = require('./lib/rss-parser.ts');
(async () => {
  try {
    console.log('Fetching RSS feeds...');
    const result = await fetchAllActiveRSSFeeds();
    console.log(\`RSS update completed: \${result.successful} successful, \${result.failed} failed out of \${result.total} feeds\`);
    process.exit(0);
  } catch (error) {
    console.error('RSS update failed:', error);
    process.exit(1);
  }
})();
" 2>&1

echo "[$(date)] RSS feed update completed."