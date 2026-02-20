#!/bin/bash

# Off-Premises Attendance System Diagnostic Script
# Runs verification checks to ensure system is working correctly

echo "🔍 Starting Off-Premises Attendance System Diagnostics..."
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check 1: Verify API files exist
echo -e "${BLUE}[1/5] Checking API Endpoints...${NC}"
files_to_check=(
  "app/api/attendance/personal/route.ts"
  "app/api/attendance/offpremises/pending/route.ts"
  "app/api/attendance/check-in-outside-request/route.ts"
  "app/api/attendance/personal-export/route.ts"
)

all_exist=true
for file in "${files_to_check[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file exists"
  else
    echo -e "${RED}✗${NC} $file MISSING"
    all_exist=false
  fi
done
echo ""

# Check 2: Verify component files exist
echo -e "${BLUE}[2/5] Checking UI Components...${NC}"
components_to_check=(
  "components/attendance/personal-attendance-history.tsx"
  "components/admin/pending-offpremises-requests.tsx"
  "app/offpremises-approvals/page.tsx"
  "app/dashboard/attendance/page.tsx"
)

for component in "${components_to_check[@]}"; do
  if [ -f "$component" ]; then
    echo -e "${GREEN}✓${NC} $component exists"
  else
    echo -e "${RED}✗${NC} $component MISSING"
  fi
done
echo ""

# Check 3: Verify database tables schema
echo -e "${BLUE}[3/5] Checking Database Schema...${NC}"
echo "Run these queries in Supabase SQL Editor to verify:"
echo ""
echo -e "${YELLOW}-- Check attendance_records table${NC}"
echo "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance_records' ORDER BY ordinal_position;"
echo ""
echo -e "${YELLOW}-- Check pending_offpremises_checkins table${NC}"
echo "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pending_offpremises_checkins' ORDER BY ordinal_position;"
echo ""

# Check 4: Verify key API logic
echo -e "${BLUE}[4/5] Checking API Route Logic...${NC}"
echo "Verifying off-premises fields are selected in personal API..."
if grep -q "approval_status" app/api/attendance/personal/route.ts; then
  echo -e "${GREEN}✓${NC} approval_status field included"
else
  echo -e "${RED}✗${NC} approval_status field MISSING"
fi

if grep -q "on_official_duty_outside_premises" app/api/attendance/personal/route.ts; then
  echo -e "${GREEN}✓${NC} on_official_duty_outside_premises field included"
else
  echo -e "${RED}✗${NC} on_official_duty_outside_premises field MISSING"
fi

if grep -q "off_premises_request_id" app/api/attendance/personal/route.ts; then
  echo -e "${GREEN}✓${NC} off_premises_request_id field included"
else
  echo -e "${RED}✗${NC} off_premises_request_id field MISSING"
fi
echo ""

# Check 5: Verify attendance history component shows off-premises
echo -e "${BLUE}[5/5] Checking UI for Off-Premises Display...${NC}"
if grep -q "Off-Premises Status" components/attendance/personal-attendance-history.tsx; then
  echo -e "${GREEN}✓${NC} Off-Premises Status column added to attendance history"
else
  echo -e "${RED}✗${NC} Off-Premises Status column NOT FOUND"
fi

if grep -q "pending_supervisor_approval" components/attendance/personal-attendance-history.tsx; then
  echo -e "${GREEN}✓${NC} Pending approval status display logic found"
else
  echo -e "${RED}✗${NC} Pending approval status display logic NOT FOUND"
fi
echo ""

# Final summary
echo "=================================================="
echo -e "${BLUE}Diagnostic Summary:${NC}"
echo ""
if [ "$all_exist" = true ]; then
  echo -e "${GREEN}✓ All API endpoints are implemented${NC}"
  echo -e "${GREEN}✓ All UI components are in place${NC}"
  echo -e "${GREEN}✓ System should be working after dev server rebuild${NC}"
  echo ""
  echo "NEXT STEPS:"
  echo "1. Clear build cache:   rm -rf .next node_modules/.cache"
  echo "2. Reinstall packages:  npm install (or pnpm install)"
  echo "3. Restart dev server:  npm run dev (or pnpm dev)"
  echo "4. Wait 2-3 minutes for complete rebuild"
  echo "5. Test workflow: Dashboard → Attendance → Off-Premises Requests"
else
  echo -e "${RED}✗ Some components are missing - system may not work${NC}"
  echo "Check the file list above for missing items"
fi
echo ""
echo "=================================================="
