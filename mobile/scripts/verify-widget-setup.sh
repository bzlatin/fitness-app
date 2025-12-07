#!/bin/bash

# iOS Widgets Setup Verification Script
# Run this before building with EAS to ensure everything is configured correctly

echo "🔍 Verifying iOS Widgets Setup..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0
WARNINGS=0

# Check 1: Verify we're in the mobile directory
echo "📁 Checking directory..."
if [ ! -f "app.config.ts" ]; then
    echo -e "${RED}❌ Error: app.config.ts not found. Are you in the mobile directory?${NC}"
    echo "   Run: cd /Users/ben/coding_projects/fitness-app/mobile"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ In correct directory${NC}"
fi

# Check 2: Verify widget plugin exists
echo ""
echo "🔌 Checking widget plugin..."
if [ ! -f "plugins/withWidgets.js" ]; then
    echo -e "${RED}❌ Error: plugins/withWidgets.js not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Widget plugin exists${NC}"
fi

# Check 3: Verify widget plugin is in app.config.ts
echo ""
echo "⚙️  Checking app.config.ts..."
if grep -q "withWidgets" app.config.ts; then
    echo -e "${GREEN}✅ Widget plugin registered in app.config.ts${NC}"
else
    echo -e "${RED}❌ Error: Widget plugin not found in app.config.ts${NC}"
    echo "   Add this to plugins array: './plugins/withWidgets'"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: Verify iOS widget files exist
echo ""
echo "📱 Checking iOS widget files..."
WIDGET_FILES=(
    "ios/Widgets/PushPullWidgets.swift"
    "ios/Widgets/WeeklyGoalWidget.swift"
    "ios/Widgets/QuickStartWidget.swift"
    "ios/Widgets/WidgetDataProvider.swift"
    "ios/Widgets/AppGroupUserDefaults.swift"
)

for file in "${WIDGET_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ Found: $file${NC}"
    fi
done

# Check 5: Verify widget service exists
echo ""
echo "🔄 Checking widget sync service..."
if [ ! -f "src/services/widgetSync.ts" ]; then
    echo -e "${RED}❌ Error: src/services/widgetSync.ts not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Widget sync service exists${NC}"
fi

# Check 6: Verify deep linking in App.tsx
echo ""
echo "🔗 Checking deep linking configuration..."
if grep -q "workout/start" App.tsx && grep -q "workout/log" App.tsx; then
    echo -e "${GREEN}✅ Widget deep links configured in App.tsx${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Widget deep links may not be configured${NC}"
    echo "   Check App.tsx linking config for 'workout/start' and 'workout/log'"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 7: Verify EAS CLI is installed
echo ""
echo "🛠️  Checking EAS CLI..."
if command -v eas &> /dev/null; then
    EAS_VERSION=$(eas --version)
    echo -e "${GREEN}✅ EAS CLI installed: $EAS_VERSION${NC}"
else
    echo -e "${RED}❌ Error: EAS CLI not installed${NC}"
    echo "   Run: npm install -g eas-cli"
    ERRORS=$((ERRORS + 1))
fi

# Check 8: Verify eas.json exists
echo ""
echo "📋 Checking EAS configuration..."
if [ ! -f "eas.json" ]; then
    echo -e "${RED}❌ Error: eas.json not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ eas.json exists${NC}"
fi

# Check 9: Verify node_modules installed
echo ""
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Warning: node_modules not found${NC}"
    echo "   Run: npm install"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# Check 10: Verify backend engagement route exists
echo ""
echo "🌐 Checking backend API..."
if [ -f "../server/src/routes/engagement.ts" ]; then
    echo -e "${GREEN}✅ Backend engagement route exists${NC}"
else
    echo -e "${RED}❌ Error: ../server/src/routes/engagement.ts not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 11: Verify backend route is registered
if [ -f "../server/src/app.ts" ]; then
    if grep -q "engagementRouter" ../server/src/app.ts; then
        echo -e "${GREEN}✅ Engagement router registered in app.ts${NC}"
    else
        echo -e "${RED}❌ Error: Engagement router not registered in app.ts${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready to build.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: eas build --platform ios --profile development --local"
    echo "  2. Follow /mobile/ios/Widgets/README.md for Xcode setup"
    echo "  3. See /QUICK_START_WIDGETS.md for full testing guide"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Setup complete with $WARNINGS warning(s)${NC}"
    echo ""
    echo "You can proceed with the build, but review warnings above."
    echo "Run: eas build --platform ios --profile development --local"
else
    echo -e "${RED}❌ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before building."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
