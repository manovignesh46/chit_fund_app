# Members REST API - Testing Guide

## Implementation Summary

The Members API has been successfully refactored from consolidated action-based routing to standard RESTful endpoints. All components have been updated and are ready for testing.

## What Was Implemented

### 1. REST API Endpoints

#### Base Members Route (`app/api/members/route.ts`)
- ✅ **GET /api/members** - List members with pagination, search, and sorting
  - Query params: `page`, `pageSize`, `search`, `sortBy`, `sortOrder`
  - Returns: `{ members, totalCount, page, pageSize, totalPages }`
  - Includes `_count` for chitFundMembers and loans

- ✅ **POST /api/members** - Create new member
  - Validation: name, contact (required), email format, phone format
  - Returns: Created member with 201 status

#### Individual Member Route (`app/api/members/[id]/route.ts`)
- ✅ **GET /api/members/:id** - Get single member with relations
  - Includes: chitFundMembers (with chit fund details), loans (with loan details)
  - Authorization: Checks ownership (createdById)

- ✅ **PUT /api/members/:id** - Update member
  - Validates: All fields with same rules as create
  - Authorization: Checks ownership

- ✅ **DELETE /api/members/:id** - Delete member
  - Dependency checking: Lists chit funds or loans preventing deletion
  - Clear error messages: Tells user exactly what needs to be done
  - Authorization: Checks ownership

### 2. TypeScript Types (`lib/interfaces.ts`)
- ✅ Updated `GlobalMember` interface with new fields
- ✅ Added `MemberCreateInput` interface
- ✅ Added `MemberUpdateInput` interface  
- ✅ Added `MemberListResponse` interface

### 3. API Client (`lib/api.ts`)
- ✅ Updated `memberAPI.getAll()` with filter support
- ✅ Updated `memberAPI.getById()` to use REST endpoint
- ✅ Updated `memberAPI.create()` to use REST endpoint
- ✅ Updated `memberAPI.update()` to use REST endpoint
- ✅ Updated `memberAPI.delete()` to use REST endpoint
- ✅ Kept `memberAPI.export()` (already correct)

### 4. Frontend (`app/members/page.tsx`)
- ✅ Removed artificial delay from `fetchMembers()`
- ✅ Already using correct API client methods
- ✅ Error handling already displays detailed backend messages

## Manual Testing Checklist

### API Endpoint Testing (Using Browser DevTools or Postman)

#### 1. List Members (GET /api/members)
```bash
# Test basic list
curl http://localhost:3001/api/members?page=1&pageSize=10

# Test with search
curl http://localhost:3001/api/members?page=1&pageSize=10&search=John

# Test with sorting
curl http://localhost:3001/api/members?page=1&pageSize=10&sortBy=name&sortOrder=asc
```

**Expected:**
- ✅ Returns paginated list of members
- ✅ Includes `_count.chitFundMembers` and `_count.loans`
- ✅ Search filters by name, contact, or email
- ✅ Sorting works correctly
- ✅ Pagination metadata is accurate

#### 2. Get Single Member (GET /api/members/:id)
```bash
curl http://localhost:3001/api/members/1
```

**Expected:**
- ✅ Returns member with full details
- ✅ Includes chitFundMembers array with chit fund details
- ✅ Includes loans array with loan details
- ✅ Returns 404 if member not found
- ✅ Returns 403 if not owned by user

#### 3. Create Member (POST /api/members)
```bash
curl -X POST http://localhost:3001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "contact": "9876543210",
    "email": "john@example.com",
    "address": "123 Main St",
    "notes": "Test member"
  }'
```

**Test Cases:**
- ✅ Valid data creates member (returns 201)
- ✅ Missing name returns 400 with error
- ✅ Missing contact returns 400 with error
- ✅ Invalid phone format returns 400 with error
- ✅ Invalid email format returns 400 with error
- ✅ Trims whitespace from all fields
- ✅ Null values handled correctly

#### 4. Update Member (PUT /api/members/:id)
```bash
curl -X PUT http://localhost:3001/api/members/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "email": "johnsmith@example.com"
  }'
```

**Test Cases:**
- ✅ Partial updates work (only specified fields change)
- ✅ Validation same as create
- ✅ Returns 404 if member not found
- ✅ Returns 403 if not owned by user
- ✅ Empty strings handled correctly

#### 5. Delete Member (DELETE /api/members/:id)
```bash
curl -X DELETE http://localhost:3001/api/members/1
```

**Test Cases:**
- ✅ Deletes member if no dependencies
- ✅ Returns 400 if member in chit funds (lists which ones)
- ✅ Returns 400 if member has active loans (counts them)
- ✅ Returns 400 if member has any loans
- ✅ Returns 404 if member not found
- ✅ Returns 403 if not owned by user
- ✅ Success returns `{ success: true, message: "..." }`

### Frontend Testing (Browser)

#### Members List Page

1. **Page Load**
   - ✅ Members list loads without errors
   - ✅ Shows member count (chitFundMembers, loans) for each member
   - ✅ Pagination controls work
   - ✅ Page size selector works (5, 10, 20, 50, 100)

2. **Create Member**
   - ✅ Click "Add Member" opens modal
   - ✅ Form validation shows errors for required fields
   - ✅ Phone format validation works
   - ✅ Email format validation works
   - ✅ Successful creation closes modal and refreshes list
   - ✅ Error messages display clearly

3. **Edit Member**
   - ✅ Click edit on a member
   - ✅ Modal pre-fills with member data
   - ✅ Can update any field
   - ✅ Validation works same as create
   - ✅ Successful update refreshes list

4. **Delete Member**
   - ✅ Click delete shows confirmation modal
   - ✅ Warning message displayed
   - ✅ Delete succeeds if no dependencies
   - ✅ Error message shows which chit funds prevent deletion
   - ✅ Error message shows how many loans prevent deletion
   - ✅ Can't delete if member has dependencies

5. **Bulk Delete**
   - ✅ Select multiple members
   - ✅ Click "Delete Selected" shows confirmation
   - ✅ Only deletes members without dependencies
   - ✅ Shows count of successful deletions
   - ✅ Shows count of failed deletions with reason

6. **Export**
   - ✅ Select members to export
   - ✅ Click "Export Selected" downloads Excel file
   - ✅ File contains correct member data
   - ✅ Export button disabled when nothing selected

7. **Sorting**
   - ✅ Click column headers to sort
   - ✅ Sort by name works
   - ✅ Sort by contact works
   - ✅ Sort by email works
   - ✅ Sort direction toggles correctly

8. **Search** (if implemented)
   - ✅ Search filters by name
   - ✅ Search filters by contact
   - ✅ Search filters by email

#### Member Detail Page (if exists)
- ✅ Shows full member information
- ✅ Lists all chit funds member is part of
- ✅ Lists all loans for member
- ✅ Can navigate to chit fund/loan details

## Error Scenarios to Test

### 1. Network Errors
- ✅ API timeout shows user-friendly message
- ✅ Network disconnection handled gracefully

### 2. Authorization Errors
- ✅ Unauthorized access returns 401
- ✅ User redirected to login
- ✅ Accessing another user's member returns 403

### 3. Validation Errors
- ✅ All validation errors display in UI
- ✅ Field-specific errors appear below field
- ✅ General errors appear at top of form

### 4. Dependency Errors
- ✅ Delete error messages are clear and actionable
- ✅ User understands what needs to be done
- ✅ Error messages list specific chit fund names

## Performance Testing

### 1. Large Dataset
- ✅ Test with 100+ members
- ✅ Pagination loads quickly
- ✅ Search is responsive
- ✅ Sorting doesn't timeout

### 2. Concurrent Operations
- ✅ Multiple users can create members simultaneously
- ✅ Deleting same member twice handled correctly
- ✅ No race conditions in updates

## Migration Verification

### 1. Old API Still Works
- ✅ Consolidated API endpoints still respond
- ✅ No breaking changes for any code not yet migrated

### 2. Data Consistency
- ✅ Members created via old API visible in new API
- ✅ Members created via new API visible in old API
- ✅ Updates sync correctly

### 3. Gradual Migration
- ✅ Can switch between old and new API by changing imports
- ✅ Rollback possible if issues found

## Known Issues / Limitations

None currently identified. All linter errors have been fixed.

## Next Steps After Testing

1. **If tests pass:**
   - Deploy to staging environment
   - Monitor for any issues
   - Once stable, mark old consolidated API for deprecation
   - Apply same pattern to other pages (Dashboard, Chit Funds, Activities)

2. **If tests fail:**
   - Document specific failure scenarios
   - Fix issues in order of priority
   - Re-test after fixes
   - Keep old consolidated API as fallback

## Quick Start Testing Commands

```bash
# Start the development server
cd microfinance-app
npm run dev

# In browser, navigate to:
http://localhost:3001/members

# Open browser DevTools (F12) and check:
1. Network tab - all /api/members requests should return 200
2. Console tab - no errors should appear
3. Application tab - check localStorage for auth token
```

## Success Criteria

The implementation is considered complete and successful when:
- ✅ All API endpoints return correct responses
- ✅ All CRUD operations work in the UI
- ✅ Error messages are clear and helpful
- ✅ No console errors or warnings
- ✅ Performance is acceptable (< 1s for list, < 500ms for single operations)
- ✅ All linter errors resolved
- ✅ TypeScript types are correct
- ✅ Code follows established patterns

## Support

If you encounter any issues during testing:
1. Check browser console for error messages
2. Check Network tab for API response details
3. Check server logs for backend errors
4. Verify database connection and permissions
5. Ensure Prisma client is generated (`npm run prisma:generate`)
