
// myShopCare - Utility Functions
let currentLang = localStorage.getItem('myshopcare-lang') || 'sw';

const translations = {
  sw: {
    'nav.dashboard': 'Dashibodi',
    'nav.sales': 'Mauzo',
    'nav.purchases': 'Manunuzi',
    'nav.debts': 'Madeni',
    'nav.lowstock': 'Vinavyoishia',
    'nav.deals': 'Deals',
    'nav.reports': 'Ripoti',
    'nav.settings': 'Mipangilio',
    'btn.save': 'Hifadhi',
    'btn.cancel': 'Ghairi',
    'btn.edit': 'Hariri',
    'btn.delete': 'Futa',
    'btn.sell': 'Uza',
    'btn.pay': 'Lipa',
    'btn.close': 'Funga',
    'stat.today_sales': 'Mauzo Leo',
    'status.paid': 'Imelipwa',
    'status.debt': 'Deni',
    'status.active': 'Inafanya kazi',
    'toast.saved': '✅ Imesajiliwa!',
    'toast.deleted': '❌ Ime futwa!',
    'error.loading': 'Hitilafu ya kupakia data.',
    'error.required': 'Tafadhali jaza all fields.'
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.sales': 'Sales',
    'nav.purchases': 'Purchases',
    'nav.debts': 'Debts',
    'nav.lowstock': 'Low Stock',
    'nav.deals': 'Deals',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'btn.sell': 'Sell',
    'btn.pay': 'Pay',
    'btn.close': 'Close',
    'stat.today_sales': 'Today\'s Sales',
    'status.paid': 'Paid',
    'status.debt': 'Debt',
    'status.active': 'Active',
    'toast.saved': '✅ Saved!',
    'toast.deleted': '❌ Deleted!',
    'error.loading': 'Error loading data.',
    'error.required': 'Please fill all fields.'
  }
};

function t(key) {
  const lang = localStorage.getItem('myshopcare-lang') || 'sw';
  return translations[lang][key] || key;
}

function toggleLanguage() {
  const newLang = currentLang === 'sw' ? 'en' : 'sw';
  localStorage.setItem('myshopcare-lang', newLang);
  currentLang = newLang;
  applyTranslations();
}

function applyTranslations() {
  const lang = localStorage.getItem('myshopcare-lang') || 'sw';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });

  const langBtn = document.getElementById('btn-lang');
  if (langBtn) langBtn.textContent = lang === 'sw' ? '🇬🇧 English' : '🇹🇿 Swahili';
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === 'success' ? '#111827' : '#e24b4a'};
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    transform: translateY(80px);
    opacity: 0;
    transition: all 0.3s;
    border-left: 4px solid #f59e0b;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 10);

  setTimeout(() => {
    toast.style.transform = 'translateY(80px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function formatCurrency(amount) {
  const currency = window.CURRENCY || 'TZS';
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(currentLang === 'sw' ? 'sw-TZ' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Initialize translations on load
document.addEventListener('DOMContentLoaded', applyTranslations);
