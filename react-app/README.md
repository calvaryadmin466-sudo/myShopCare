# myShopCare React App

This is the React + TypeScript version of myShopCare!

## 🚀 Getting Started

### Install dependencies
```bash
npm install
```

### Start development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

### Build for production
```bash
npm run build
```
Production files in `dist/`

### Preview production build
```bash
npm run preview
```

## 📂 Folder Structure
- **src/pages**: All main pages of the app (Login, Dashboard, Sales, etc.)
- **src/components**: Reusable UI components (Topbar, Sidebar)
- **src/contexts**: AppContext for global state (shop, user, language, toast notifications)
- **src/lib**: Supabase client, translations
- **src/types**: TypeScript type definitions
- **src/styles**: Global styles

## 🔐 Set Up Supabase
Make sure:
1. Your Supabase project has all the required tables (use the SQL schema provided in the main README!)
2. The `src/lib/supabase.ts` has your correct Supabase URL and anon key!

## Control-plane users and manual payments

This app can report each authenticated myShopCare user to the portfolio dashboard and enforce the dashboard's manual payment status. First apply the control-plane `202607270001_site_activity.sql` migration. Then set these **Vercel server environment variables** for myShopCare:

```
VITE_CENTRAL_ACCESS_GATE=true
MYSHOPCARE_SUPABASE_URL=...
MYSHOPCARE_SUPABASE_SERVICE_ROLE_KEY=...
CONTROL_PLANE_SUPABASE_URL=...
CONTROL_PLANE_SUPABASE_SERVICE_ROLE_KEY=...
CONTROL_PLANE_SITE_DOMAIN=my-shop-care.vercel.app
```

Add `my-shop-care.vercel.app` as a site in the control-plane dashboard first. Then add or update a person in **Manual project access** using their myShopCare login email: choose **Paid / active** to allow them, or **Unpaid / canceled** and **Pause access** to block them. The dashboard will show the user after their next authenticated session.
