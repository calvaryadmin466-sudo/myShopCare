# Multi-Business Support Implementation Guide

This document explains the multi-business support feature added to myShopCare POS system.

## Overview

The myShopCare POS system now supports multiple businesses under a single user account. Each business can have:
- Custom branding (logo and theme color)
- Independent data environment
- Currency selection (USD, TZS, KSH)
- Role-based access control (owner, manager, cashier)

## Database Changes

### New Tables

1. **businesses** - Stores business information
   - id, name, logo_url, theme_color, currency, owner_id
   - Currency constraint: USD, TZS, KSH

2. **business_users** - Manages user access to businesses
   - Links users to businesses with roles (owner, manager, cashier)

3. **offline_sync_queue** - Tracks offline operations for sync
   - Stores pending operations when offline

### Schema Updates

- All existing tables (products, sales, debts, etc.) now use `business_id` instead of `shop_id`
- Row Level Security (RLS) policies updated for business-level data isolation
- New helper function: `get_my_business_id()` for secure data access

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration file in Supabase SQL Editor:

```bash
supabase_migrations/005_multi_business_support.sql
```

This will:
- Create businesses and business_users tables
- Migrate existing shop_id to business_id
- Update RLS policies
- Create offline sync tracking

### 2. Setup Storage Bucket

Run the storage setup SQL:

```bash
supabase-storage-setup.sql
```

This creates the `business-logos` bucket for storing business logos.

### 3. Environment Variables

Ensure your Supabase environment variables are set in `.env`:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Frontend Implementation

### New Context Providers

1. **BusinessContext** (`src/contexts/BusinessContext.tsx`)
   - Manages current business state
   - Handles business CRUD operations
   - Provides business switching functionality

2. **DynamicThemeContext** (`src/contexts/DynamicThemeContext.tsx`)
   - Applies business theme colors dynamically
   - Updates CSS variables based on current business

### New Components

1. **BusinessManagement** (`src/pages/BusinessManagement.tsx`)
   - UI for creating, editing, and deleting businesses
   - Logo upload functionality
   - Theme color selection

### Updated Components

1. **Layout** (`src/components/Layout.tsx`)
   - Added business selector dropdown in sidebar
   - Added online/offline connection status indicator
   - Added Businesses navigation item

### New Utilities

1. **IndexedDB** (`src/lib/indexedDB.ts`)
   - Local data caching for offline mode
   - Stores products, sales, customers, expenses, debts

2. **OfflineSync** (`src/lib/offlineSync.ts`)
   - Manages offline operation queue
   - Auto-syncs when connection restored
   - Periodic sync every 30 seconds

3. **LogoUpload** (`src/lib/logoUpload.ts`)
   - Handles logo uploads to Supabase Storage
   - Validates file type and size
   - Manages logo deletion

## Usage

### Creating a Business

1. Navigate to `/businesses` (Business Management page)
2. Click "Add Business"
3. Fill in:
   - Business name
   - Currency (USD, TZS, KSH)
   - Theme color (pick from presets or custom)
4. Click "Create Business"

### Switching Businesses

1. Use the business selector dropdown in the sidebar
2. Click on the desired business
3. The UI will update with the business's theme color and logo

### Uploading a Logo

1. Go to Business Management page
2. Find the business card
3. Click "Logo" button
4. Select an image file (max 5MB)
5. Logo will be displayed across the dashboard

### Offline Mode

The system automatically:
- Caches data to IndexedDB when online
- Allows operations when offline
- Queues changes for sync
- Auto-syncs when connection restored
- Shows online/offline status in top bar

### Role-Based Access

- **Owner**: Full access to business settings and data
- **Manager**: Can manage products, sales, and reports
- **Cashier**: Can process sales and view basic data

## Security

### Row Level Security (RLS)

All tables have RLS policies ensuring:
- Users only access their own business data
- Business owners can manage their businesses
- Data isolation between businesses

### Storage Policies

Logo storage policies ensure:
- Only business owners can upload/update logos
- Public read access for displaying logos
- Business-specific folder structure

## API Endpoints

The system uses Supabase's built-in REST API. Key operations:

### Business Operations
```typescript
// Get user's businesses
const { data } = await supabase
  .from('businesses')
  .select('*')
  .or(`owner_id.eq.${userId},id.in.(select business_id from business_users where user_id.eq.${userId})`)

// Create business
const { data } = await supabase
  .from('businesses')
  .insert({ name, theme_color, currency, owner_id })

// Update business
const { data } = await supabase
  .from('businesses')
  .update({ name, theme_color })
  .eq('id', businessId)
```

### Offline Sync
```typescript
// Queue operation for sync
await offlineSync.queueOperation(
  businessId,
  userId,
  'products',
  'insert',
  productData
)

// Sync pending operations
await offlineSync.syncPendingItems()
```

## Currency Support

The system supports three currencies:
- **USD** - US Dollar ($)
- **TZS** - Tanzanian Shilling (TSh)
- **KSH** - Kenyan Shilling (KSh)

Currency is set per business and affects:
- Price displays
- Reports
- Receipts

## Theme Customization

Each business can set a custom theme color that affects:
- Accent color throughout the UI
- Button colors
- Active states
- Borders and highlights

The system automatically calculates:
- Light variant for backgrounds
- Dark variant for hover states

## Troubleshooting

### Business Not Showing

1. Check if user is added to business_users table
2. Verify RLS policies are applied
3. Check browser console for errors

### Logo Upload Failing

1. Verify storage bucket exists
2. Check storage policies
3. Ensure file is under 5MB
4. Check network connection

### Offline Sync Not Working

1. Check IndexedDB is supported
2. Verify service worker is registered
3. Check browser storage permissions
4. Review console for sync errors

## Migration Notes

### From Single-Business to Multi-Business

The migration automatically:
- Creates a business for each existing shop_id
- Migrates all data to use business_id
- Preserves existing relationships
- Updates RLS policies

Existing users will have their current shop converted to a business automatically.

## Future Enhancements

Potential improvements:
- Business analytics dashboard
- Multi-business reporting
- Business templates
- Team collaboration features
- Advanced role permissions
- Business-specific workflows

## Support

For issues or questions:
1. Check the Supabase logs
2. Review browser console errors
3. Verify database migrations ran successfully
4. Check environment variables are set correctly
