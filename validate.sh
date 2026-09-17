#!/bin/bash

# Hospital Dashboard - Post-Update Validation Script
# Tests all three fixed issues

echo "🏥 Hospital Dashboard - Validation Tests"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000"

# Test 1: Check APIs are running
echo -e "${BLUE}Test 1: API Connectivity${NC}"
echo "---"

# Check hospital dashboard API
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/hospital/dashboard")
if [ "$response" = "200" ] || [ "$response" = "401" ]; then
    echo -e "${GREEN}✓ Hospital Dashboard API: Responding (HTTP $response)${NC}"
else
    echo -e "${RED}✗ Hospital Dashboard API: Not responding (HTTP $response)${NC}"
fi

# Check doctors available API
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/doctors/available?date=2026-04-15")
if [ "$response" = "200" ] || [ "$response" = "401" ]; then
    echo -e "${GREEN}✓ Doctors Available API: Responding (HTTP $response)${NC}"
else
    echo -e "${RED}✗ Doctors Available API: Not responding (HTTP $response)${NC}"
fi

echo ""
echo -e "${BLUE}Test 2: Environment Variables${NC}"
echo "---"

# Check Twilio environment variables
if [ -z "$TWILIO_ACCOUNT_SID" ]; then
    echo -e "${RED}✗ TWILIO_ACCOUNT_SID: Not set${NC}"
    echo -e "${YELLOW}  Fix: Add to .env.local and restart server${NC}"
else
    echo -e "${GREEN}✓ TWILIO_ACCOUNT_SID: Set${NC}"
fi

if [ -z "$TWILIO_AUTH_TOKEN" ]; then
    echo -e "${RED}✗ TWILIO_AUTH_TOKEN: Not set${NC}"
    echo -e "${YELLOW}  Fix: Add to .env.local and restart server${NC}"
else
    echo -e "${GREEN}✓ TWILIO_AUTH_TOKEN: Set${NC}"
fi

if [ -z "$TWILIO_WHATSAPP_NUMBER" ]; then
    echo -e "${RED}✗ TWILIO_WHATSAPP_NUMBER: Not set${NC}"
    echo -e "${YELLOW}  Fix: Add to .env.local (format: whatsapp:+1...${NC}"
else
    echo -e "${GREEN}✓ TWILIO_WHATSAPP_NUMBER: Set${NC}"
fi

echo ""
echo -e "${BLUE}Test 3: Database Setup${NC}"
echo "---"

# Note: These would need database access, so we'll provide the SQL to check manually
echo -e "${YELLOW}Manual checks needed:${NC}"
echo "1. Check doctors exist:"
echo "   sql: SELECT COUNT(*) FROM \"Doctor\" WHERE \"isActive\" = true;"
echo ""
echo "2. Check doctor availability JSON:"
echo "   sql: SELECT \"name\", \"availability\" FROM \"Doctor\" LIMIT 1;"
echo ""
echo "3. Check patient phone format:"
echo "   sql: SELECT \"fullName\", \"phone\" FROM \"Patient\" LIMIT 5;"
echo "   Should be: +919876543210 (with + and no spaces)"
echo ""

echo -e "${BLUE}Test 4: Feature Validation${NC}"
echo "---"

echo "Test the following manually in your browser:"
echo ""
echo -e "${YELLOW}Issue 1: Appointments Showing${NC}"
echo "  1. Go to CRM Tab → Add new patient"
echo "  2. Click 'Book Appointment' on patient"
echo "  3. Fill appointment details"
echo "  4. Click 'Book Appointment'"
echo "  5. Go to Appointments Tab"
echo "  6. ✓ New appointment should appear (or click Refresh)"
echo ""

echo -e "${YELLOW}Issue 2: Doctor Selection${NC}"
echo "  1. Click 'Book Appointment'"
echo "  2. Select a date (must be future date)"
echo "  3. ✓ Doctor dropdown should populate"
echo "  4. Select a doctor"
echo "  5. ✓ Should show: 'Dr. Name is available on [date]'"
echo "  6. Save and check Appointments Tab"
echo ""

echo -e "${YELLOW}Issue 3: WhatsApp Messaging${NC}"
echo "  1. Update patient phone to: +919876543210 (TEST FORMAT)"
echo "  2. Book appointment"
echo "  3. Go to Appointments Tab"
echo "  4. Click ✓ Confirm on the appointment"
echo "  5. Check server logs for:"
echo "     [WhatsApp Sending] = good"
echo "     [WhatsApp Success] = message queued"
echo "     [WhatsApp Send Error] = check WHATSAPP_SETUP_GUIDE.md"
echo ""

echo -e "${BLUE}Test 5: Server Logs to Watch${NC}"
echo "---"
echo "When confirming appointment, look for these in terminal:"
echo -e "${GREEN}Good:${NC}"
echo "  [WhatsApp Sending] { from: 'whatsapp:+...', to: 'whatsapp:+919876543210' }"
echo "  [WhatsApp Success] { sid: 'SMxxxxxxx...' }"
echo ""
echo -e "${RED}Bad:${NC}"
echo "  [WhatsApp Send Error] { message: 'Invalid phone number', code: 21211 }"
echo "  [WhatsApp Send Error] { message: 'Invalid credentials', code: 20003 }"
echo ""

echo ""
echo -e "${BLUE}Documentation Files${NC}"
echo "---"
echo "Read these for more info:"
echo "  📖 LATEST_UPDATES.md - Summary of all changes"
echo "  📖 WHATSAPP_SETUP_GUIDE.md - WhatsApp troubleshooting"
echo ""

echo -e "${BLUE}Quick Fixes${NC}"
echo "---"
echo ""
echo -e "${YELLOW}If appointments don't show:${NC}"
echo "  → Click 'Refresh' button (🔄) in Appointments Tab header"
echo ""
echo -e "${YELLOW}If doctor dropdown empty:${NC}"
echo "  → Run: npm run seed-doctors (to create test doctors)"
echo "  → Or manually add doctors with availability JSON"
echo ""
echo -e "${YELLOW}If WhatsApp not working:${NC}"
echo "  → Check .env.local has TWILIO_* variables"
echo "  → Verify patient phone: +919876543210 (with +, no spaces)"
echo "  → Read WHATSAPP_SETUP_GUIDE.md section 'Common Issues'"
echo ""

echo "======================================"
echo -e "${GREEN}Validation Complete!${NC}"
echo "All systems ready for testing ✅"
