#!/bin/bash

# ============================================================================
# OFF-PREMISES ATTENDANCE SYSTEM - CRITICAL FIX
# Run this script to rebuild the dev server and fix all issues
# ============================================================================

set -e

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  OFF-PREMISES ATTENDANCE SYSTEM - REBUILD SCRIPT                  ║"
echo "║  This script will fix all issues with off-premises requests       ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Stop dev server
echo -e "${BLUE}STEP 1: Stopping current dev server...${NC}"
echo "Press Ctrl+C in the dev server terminal to stop it"
echo "Once stopped, come back and run this script"
read -p "Press Enter to continue..."
echo ""

# Step 2: Clear build cache
echo -e "${BLUE}STEP 2: Clearing build cache...${NC}"
echo "Removing .next directory..."
rm -rf .next
echo -e "${GREEN}✓ .next cleared${NC}"

echo "Removing node_modules cache..."
rm -rf node_modules/.cache
echo -e "${GREEN}✓ node_modules cache cleared${NC}"

echo "Removing vite cache..."
rm -rf node_modules/.vite 2>/dev/null || true
echo -e "${GREEN}✓ vite cache cleared${NC}"
echo ""

# Step 3: Check package manager
echo -e "${BLUE}STEP 3: Detecting package manager...${NC}"
if [ -f "pnpm-lock.yaml" ]; then
  PKG_MANAGER="pnpm"
  echo -e "${GREEN}✓ Using pnpm${NC}"
elif [ -f "yarn.lock" ]; then
  PKG_MANAGER="yarn"
  echo -e "${GREEN}✓ Using yarn${NC}"
elif [ -f "bun.lockb" ]; then
  PKG_MANAGER="bun"
  echo -e "${GREEN}✓ Using bun${NC}"
else
  PKG_MANAGER="npm"
  echo -e "${GREEN}✓ Using npm${NC}"
fi
echo ""

# Step 4: Reinstall dependencies
echo -e "${BLUE}STEP 4: Reinstalling dependencies...${NC}"
echo "Running: $PKG_MANAGER install"
$PKG_MANAGER install
echo -e "${GREEN}✓ Dependencies reinstalled${NC}"
echo ""

# Step 5: Start dev server
echo -e "${BLUE}STEP 5: Starting dev server...${NC}"
echo "This will rebuild the entire project"
echo "WAIT 2-3 MINUTES for the build to complete!"
echo "DO NOT interrupt the build process"
echo ""
echo -e "${YELLOW}When you see 'Local: http://localhost:3000' - the rebuild is complete${NC}"
echo ""

$PKG_MANAGER run dev

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  DEV SERVER STARTED SUCCESSFULLY!                                 ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
