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
