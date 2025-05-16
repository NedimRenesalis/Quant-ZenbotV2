#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define Repository Path
REPO_PATH="/root/Quant-ZenbotV2"
LOG_FILE="/root/Quant-ZenbotV2/deploy.log"
PM2_APP_NAME="Quant_ZenbotV2"

# Function for logging with timestamp
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "Starting deployment..."

# Navigate to the repository directory
cd "$REPO_PATH"
log "Changed directory to $REPO_PATH"

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  log "Currently on branch $CURRENT_BRANCH, switching to main..."
  git checkout main || {
    log "Error: Failed to switch to main branch."
    exit 1
  }
fi

# Stash any local changes
log "Stashing local changes..."
git stash || {
  log "Warning: Failed to stash changes. Trying to continue anyway."
}

# Handle untracked files
log "Handling untracked files..."
if [ -f "deploy.sh" ]; then
  log "Backing up deploy.sh..."
  cp deploy.sh deploy.sh.bak
fi

# Pull the latest changes
log "Pulling latest changes from GitHub..."
git pull origin main --force || {
  log "Error: Failed to pull from GitHub."
  # Restore backed up files if needed
  if [ -f "deploy.sh.bak" ]; then
    log "Restoring deploy.sh from backup..."
    cp deploy.sh.bak deploy.sh
    chmod +x deploy.sh
  fi
  exit 1
}
log "Successfully pulled latest changes."

# Restore backed up files if needed
if [ -f "deploy.sh.bak" ]; then
  log "Restoring deploy.sh from backup..."
  cp deploy.sh.bak deploy.sh
  chmod +x deploy.sh
  rm deploy.sh.bak
fi

# Install/update Node.js dependencies
log "Installing/updating Node.js dependencies with npm ci..."
npm ci || {
  log "Error: npm ci failed. Attempting npm install..."
  npm install || {
    log "Error: npm install also failed."
    exit 1
  }
}
log "Dependencies installed successfully."

# Check if Zenbot is already running with PM2
if pm2 list | grep -q "$PM2_APP_NAME"; then
  log "Restarting Zenbot ($PM2_APP_NAME) with PM2..."
  
  pm2 restart "$PM2_APP_NAME" || {
    log "Error: Failed to restart Zenbot ($PM2_APP_NAME) with PM2."
    # As a fallback, try to start if it failed to restart (e.g., if it was stopped)
    log "Attempting to start Zenbot ($PM2_APP_NAME) with PM2 as a fallback..."
    # Ensure you adjust the Zenbot command as needed!
    pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper || {
        log "Critical Error: Failed to start Zenbot ($PM2_APP_NAME) with PM2."
        exit 1
    }
  }
else
  log "Zenbot ($PM2_APP_NAME) is not yet managed by PM2. Attempting to start it for the first time..."
  # Adjust the command for Zenbot. Example: trade with paper trading.
  # The `--interpreter bash` is important if zenbot.sh is a shell script.
  # Make sure your conf.js is set up for the desired exchange/pair or specify it here.
  pm2 start "$REPO_PATH/zenbot.sh" --name "$PM2_APP_NAME" --interpreter bash -- trade --paper || {
    log "Error: Failed to start Zenbot ($PM2_APP_NAME) with PM2 for the first time."
    exit 1
  }
  log "Zenbot ($PM2_APP_NAME) started with PM2. Consider running 'pm2 save' and 'pm2 startup' to ensure it persists reboots."
fi

log "Deployment completed successfully at $(date)"