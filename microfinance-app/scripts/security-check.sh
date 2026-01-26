#!/bin/bash

# Security Check Script for Microfinance App
# Run this before deployment

echo "🔒 Running Security Checks..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES=0

# 1. Check if .env is in git
echo "1. Checking .env file tracking..."
if git ls-files --error-unmatch .env 2>/dev/null; then
    echo -e "${RED}❌ CRITICAL: .env file is tracked in git!${NC}"
    echo "   Run: git rm --cached .env"
    ISSUES=$((ISSUES+1))
else
    echo -e "${GREEN}✅ .env is not tracked in git${NC}"
fi

# 2. Check for sensitive data in git history
echo ""
echo "2. Checking for exposed secrets in recent commits..."
if git log --all --full-history -p --grep="password\|secret\|key" -i | grep -E "(password|secret|key)" | head -5; then
    echo -e "${YELLOW}⚠️  WARNING: Potential secrets found in git history${NC}"
    echo "   Review and consider using git-filter-repo to remove them"
    ISSUES=$((ISSUES+1))
else
    echo -e "${GREEN}✅ No obvious secrets in recent commits${NC}"
fi

# 3. Check npm audit
echo ""
echo "3. Checking for package vulnerabilities..."
AUDIT_OUTPUT=$(npm audit --production 2>&1)
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
    echo -e "${GREEN}✅ No vulnerabilities found${NC}"
else
    echo -e "${YELLOW}⚠️  Vulnerabilities detected:${NC}"
    npm audit --production | grep -E "(high|critical|moderate)" | head -10
    echo "   Run: npm audit fix"
    ISSUES=$((ISSUES+1))
fi

# 4. Check if JWT_SECRET is strong
echo ""
echo "4. Checking JWT_SECRET strength..."
if [ -f .env ]; then
    JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$JWT_SECRET" ]; then
        echo -e "${RED}❌ JWT_SECRET is not set!${NC}"
        ISSUES=$((ISSUES+1))
    elif [ ${#JWT_SECRET} -lt 32 ]; then
        echo -e "${YELLOW}⚠️  JWT_SECRET is too short (${#JWT_SECRET} chars, recommended 32+)${NC}"
        echo "   Generate new: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        ISSUES=$((ISSUES+1))
    else
        echo -e "${GREEN}✅ JWT_SECRET has adequate length (${#JWT_SECRET} chars)${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found!${NC}"
    ISSUES=$((ISSUES+1))
fi

# 5. Check database SSL
echo ""
echo "5. Checking database SSL configuration..."
if [ -f .env ]; then
    DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2)
    if echo "$DATABASE_URL" | grep -q "sslmode=require\|ssl=true"; then
        echo -e "${GREEN}✅ Database SSL is enabled${NC}"
    else
        echo -e "${YELLOW}⚠️  Database SSL might not be enabled${NC}"
        echo "   Add sslmode=require to DATABASE_URL in production"
    fi
fi

# 6. Check for hardcoded secrets in code
echo ""
echo "6. Scanning for hardcoded secrets in code..."
SECRETS_FOUND=0
if grep -r -E "(password|secret|api[_-]?key)\s*=\s*['\"][\w\d]{8,}['\"]" app/ lib/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | grep -v "placeholder\|example\|test" | head -5; then
    echo -e "${RED}❌ Potential hardcoded secrets found!${NC}"
    ISSUES=$((ISSUES+1))
else
    echo -e "${GREEN}✅ No obvious hardcoded secrets${NC}"
fi

# 7. Check HTTPS configuration
echo ""
echo "7. Checking HTTPS configuration..."
if grep -q "Strict-Transport-Security" next.config.js; then
    echo -e "${GREEN}✅ HSTS header configured${NC}"
else
    echo -e "${YELLOW}⚠️  HSTS header not found${NC}"
    ISSUES=$((ISSUES+1))
fi

# 8. Check for console.log in production
echo ""
echo "8. Checking console.log removal in production..."
if grep -q "removeConsole.*production" next.config.js; then
    echo -e "${GREEN}✅ Console logs removed in production build${NC}"
else
    echo -e "${YELLOW}⚠️  Console logs might be included in production${NC}"
fi

# 9. Check for outdated dependencies
echo ""
echo "9. Checking for outdated dependencies..."
OUTDATED=$(npm outdated 2>&1)
if [ -z "$OUTDATED" ]; then
    echo -e "${GREEN}✅ All dependencies are up to date${NC}"
else
    echo -e "${YELLOW}⚠️  Some dependencies are outdated:${NC}"
    echo "$OUTDATED" | head -10
    echo "   Run: npm update"
fi

# 10. Check middleware security
echo ""
echo "10. Checking middleware security features..."
if grep -q "rateLimit\|rate limit" middleware.ts; then
    echo -e "${GREEN}✅ Rate limiting implemented${NC}"
else
    echo -e "${YELLOW}⚠️  Rate limiting not found in middleware${NC}"
    ISSUES=$((ISSUES+1))
fi

if grep -q "verifySameOrigin\|origin.*host" middleware.ts; then
    echo -e "${GREEN}✅ Origin validation implemented${NC}"
else
    echo -e "${YELLOW}⚠️  Origin validation not found${NC}"
    ISSUES=$((ISSUES+1))
fi

# Summary
echo ""
echo "================================"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Security check passed!${NC}"
    echo "All critical security measures are in place."
    exit 0
else
    echo -e "${YELLOW}⚠️  Found $ISSUES security issues${NC}"
    echo "Please review and fix the issues above before deployment."
    exit 1
fi
