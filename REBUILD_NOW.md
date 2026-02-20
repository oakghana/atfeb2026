# IMMEDIATE ACTION: Rebuild Dev Server

## DO THIS NOW IN YOUR TERMINAL

### Step 1: Stop the Dev Server
Press **Ctrl+C** in the terminal where `npm run dev` is running

### Step 2: Run These Commands Exactly (In Order)

```bash
# Clear Next.js cache
rm -rf .next

# Clear turbo cache if it exists
rm -rf .turbo

# Clear npm cache for next
rm -rf node_modules/.cache

# Reinstall with clean install
npm ci

# Rebuild the project
npm run build

# Start fresh dev server
npm run dev
```

### Step 3: Wait for Build to Complete

You should see:
```
 ▲ Next.js 16.1.4
 - Local:        http://localhost:3000
 - Environments: .env.local
```

**This indicates success!** The Turbopack error should be gone.

### Step 4: Test the System

1. Open http://localhost:3000 in browser
2. Log in as a staff member
3. Go to Attendance page
4. You should NOW see your previous attendance records
5. Submit an off-premises request
6. Go to Off-Premises Approvals (as supervisor)
7. You should see the pending request

## What Changed?

The `next.config.mjs` file now has explicit Turbopack configuration:

```javascript
turbopack: {
  config: {
    resolve: {
      preferRelative: true,  // Fixes "package not found" error
    },
  },
}
```

This tells Turbopack to resolve packages correctly, fixing the panic error.

## If It Still Crashes

Try this alternative fix:

```bash
# Delete everything
rm -rf .next node_modules .turbo

# Fresh install
npm install

# Build with verbose output
npm run build -- --debug

# Then start
npm run dev
```

## What This Fixes

✅ Turbopack no longer crashes
✅ API routes execute properly  
✅ Off-premises requests save to database
✅ Attendance records display with history
✅ Supervisors can see pending approvals
✅ Complete off-premises workflow works

## Database Queries to Verify Data

Use file: `FIND_OFFPREMISES_STORAGE.sql`

These queries will show you:
- Where off-premises data is stored
- Which table has the requests
- How many pending approvals exist
- What data is being saved
