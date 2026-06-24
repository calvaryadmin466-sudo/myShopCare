
// myShopCare - Authentication Guard & Session Initialization
(async function () {
  const publicPages = ['/login.html', '/register.html'];
  const onPublicPage = publicPages.some(p => window.location.pathname.endsWith(p));
  
  // Skip auth check on public pages
  if (onPublicPage) return;

  // Check if user has active session
  const { data: { session } } = await window.db.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return;
  }

  // Get staff info first
  const { data: staffRecord, error: staffError } = await window.db
    .from('staff')
    .select('shop_id, role, full_name')
    .eq('user_id', session.user.id)
    .single();

  if (staffError || !staffRecord) {
    console.error('❌ Auth staff error:', staffError);
    await window.db.auth.signOut();
    window.location.href = '/login.html';
    return;
  }

  // Now get shop info separately
  const { data: shop, error: shopError } = await window.db
    .from('shops')
    .select('name, currency, language, is_active')
    .eq('id', staffRecord.shop_id)
    .single();

  if (shopError || !shop) {
    console.error('❌ Auth shop error:', shopError);
    await window.db.auth.signOut();
    window.location.href = '/login.html';
    return;
  }

  // Check if shop is active
  if (!shop.is_active) {
    await window.db.auth.signOut();
    alert('Duka hili limesimamishwa. Wasiliana na msaidizi.');
    window.location.href = '/login.html';
    return;
  }

  // Set global window variables for easy access
  window.SHOP_ID = staffRecord.shop_id;
  window.USER_ROLE = staffRecord.role;
  window.USER_NAME = staffRecord.full_name;
  window.SHOP_NAME = shop.name;
  window.CURRENCY = shop.currency;
  window.PREFERRED_LANG = shop.language || 'sw';

  // Update UI elements
  const shopEl = document.getElementById('topbar-shop-name');
  const userEl = document.getElementById('topbar-username');
  const langBtn = document.getElementById('btn-lang');
  
  if (shopEl) shopEl.textContent = window.SHOP_NAME;
  if (userEl) userEl.textContent = window.USER_NAME;
  if (langBtn) langBtn.textContent = window.PREFERRED_LANG === 'sw' ? '🇬🇧 English' : '🇹🇿 Swahili';

  console.log('✅ Session authenticated for shop:', window.SHOP_NAME);
})();

// Sign out function
async function signOut() {
  await window.db.auth.signOut();
  localStorage.clear();
  indexedDB.deleteDatabase('myshopcare-offline');
  window.location.href = '/login.html';
}
