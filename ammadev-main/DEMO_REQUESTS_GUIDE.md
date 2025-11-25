# Demo Requests Feature

## Overview

A beta access modal popup appears on the login page, allowing visitors to request demo access. All demo requests are stored in a Supabase database table.

## Setup Instructions

### 1. Create the Database Table

Run this SQL in your Supabase SQL Editor:

```bash
File: setup/sql/CREATE_DEMO_REQUESTS_TABLE.sql
```

This creates:
- `demo_requests` table with columns:
  - `id` - Auto-incrementing primary key
  - `name` - Requester's name (required)
  - `email` - Requester's email (required)
  - `organization` - Organization/practice name (optional)
  - `requested_at` - Timestamp of request
  - `status` - Request status (default: 'pending')
  - `notes` - Admin notes (optional)
  - `created_at` - Record creation timestamp

### 2. Test the Feature

1. Navigate to the login page: `http://localhost:5173/login`
2. The beta modal will appear automatically
3. Fill out the demo request form:
   - Name (required)
   - Email (required)
   - Organization (optional)
4. Click "Request Demo Access"
5. Check Supabase to see the stored data

### 3. View Demo Requests in Supabase

Go to Supabase Dashboard → Table Editor → `demo_requests`

You'll see all submitted requests with:
- Requester information
- Timestamp
- Status (pending, contacted, approved, rejected, etc.)

## Features

### Modal Behavior

- ✅ Shows on login page load
- ✅ Can be dismissed with "Continue to Login" button
- ✅ Form validation (name and email required)
- ✅ Loading state while submitting
- ✅ Success confirmation message
- ✅ Auto-closes after successful submission

### Security

- ✅ Row Level Security (RLS) enabled
- ✅ Public can INSERT (submit demo requests)
- ✅ Only authenticated users can VIEW/UPDATE (for admin purposes)
- ✅ Email and status indexes for fast queries

## Managing Demo Requests

### Query All Pending Requests

```sql
SELECT * FROM demo_requests 
WHERE status = 'pending' 
ORDER BY requested_at DESC;
```

### Update Request Status

```sql
UPDATE demo_requests 
SET status = 'contacted', notes = 'Called on 2024-11-24'
WHERE id = 1;
```

### Get Statistics

```sql
SELECT 
  status,
  COUNT(*) as count,
  MAX(requested_at) as most_recent
FROM demo_requests
GROUP BY status;
```

## Status Options

You can use any status values, but here are suggestions:
- `pending` - New request, not yet reviewed
- `contacted` - Team has reached out
- `scheduled` - Demo scheduled
- `approved` - Given beta access
- `rejected` - Not a good fit
- `converted` - Became a paying customer

## Future Enhancements

Consider adding:
- Email notifications to admin when new request submitted
- Auto-response email to requester
- Admin dashboard to manage requests (React component)
- Calendar integration for scheduling demos
- CRM integration (Salesforce, HubSpot, etc.)

## Troubleshooting

### Modal doesn't appear
- Check browser console for errors
- Verify Supabase connection is working
- Check `showBetaModal` state in React DevTools

### Form submission fails
- Verify `CREATE_DEMO_REQUESTS_TABLE.sql` was run
- Check Supabase RLS policies are active
- Look for errors in browser console
- Verify Supabase URL and anon key in `.env`

### Data not saving
- Check Supabase Table Editor for the `demo_requests` table
- Verify RLS policies allow INSERT for anon users
- Check network tab for failed API calls

---

**Last Updated**: November 2024

