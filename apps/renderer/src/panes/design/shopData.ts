export type ShopLang = 'en' | 'ru'
export type ShopRoute = 'landing' | 'geo' | 'store' | 'product' | 'cart' | 'checkout' | 'confirm' | 'orders' | 'profile'
export type GeoStep = 'country' | 'city' | 'hood'
export type PayTab = 'crypto' | 'card'
export type CryptoKind = 'BTC' | 'ETH' | 'USDT'

export interface Product {
  id: string
  name: string
  category: 'sneakers' | 'jackets' | 'accessories'
  price: number
  stock: number
  sizes: string[]
  blurb: string
}

export const PRODUCTS: Product[] = [
  {
    id: 'air-max-90',
    name: 'Nike Air Max 90',
    category: 'sneakers',
    price: 180,
    stock: 3,
    sizes: ['40', '41', '42', '43', '44'],
    blurb: 'Classic runner with visible Air cushioning. German-sourced. Ships within 2h of order confirmation.'
  },
  {
    id: 'dunk-low',
    name: 'Nike Dunk Low',
    category: 'sneakers',
    price: 160,
    stock: 12,
    sizes: ['39', '40', '41', '42', '43'],
    blurb: 'Low-profile court sneaker. Pairs with jackets and denim.'
  },
  {
    id: 'coach-jacket',
    name: 'Nylon Coach Jacket',
    category: 'jackets',
    price: 95,
    stock: 8,
    sizes: ['S', 'M', 'L', 'XL'],
    blurb: 'Lightweight shell with snap front. Packs small for travel.'
  },
  {
    id: 'cap',
    name: 'Twill Cap',
    category: 'accessories',
    price: 32,
    stock: 20,
    sizes: ['OS'],
    blurb: 'Unstructured six-panel. One size, adjustable.'
  }
]

export const GEO = {
  Germany: { Berlin: ['Kreuzberg', 'Mitte', 'Prenzlauer Berg'], Hamburg: ['St. Pauli', 'Altona'] },
  France: { Paris: ['Le Marais', 'Belleville'], Lyon: ['Croix-Rousse'] }
} as const

export const DEMO_WALLETS: Record<CryptoKind, string> = {
  BTC: 'bc1q-demo-quokka-shop-not-a-real-wallet',
  ETH: '0xDEMO0000000000000000000000000000QUOKKA',
  USDT: 'TDEMOQUOKKASHOPUSDTNOTREAL000000'
}

export const COPY: Record<ShopLang, Record<string, string>> = {
  en: {
    sub: 'Your underground marketplace',
    live: 'LIVE · 24/7',
    tg: 'Continue with Telegram',
    ru: 'Switch to Russian',
    search: 'Search products...',
    all: 'All',
    sneakers: 'Sneakers',
    jackets: 'Jackets',
    accessories: 'Accessories',
    store: 'Store',
    orders: 'Orders',
    profile: 'Profile',
    back: 'Back',
    description: 'DESCRIPTION',
    size: 'SIZE',
    add: 'Add to Cart',
    buy: 'Buy Now',
    added: 'Added!',
    cart: 'Cart',
    checkout: 'Checkout',
    subtotal: 'Subtotal',
    remove: 'Remove',
    crypto: 'Crypto',
    card: 'Card',
    copy: 'Copy',
    copied: 'Copied',
    pay: 'Place order',
    confirm: 'Order confirmed',
    backStore: 'Back to store',
    country: 'Country',
    city: 'City',
    hood: 'Neighborhood',
    geoSearch: 'Search',
    empty: 'No matches',
    noOrders: 'No orders yet',
    placed: 'Placed',
    guest: 'Guest',
    low: 'LOW STOCK',
    out: 'OUT OF STOCK',
    stock: 'in stock',
    name: 'Name',
    number: 'Card number',
    exp: 'MM/YY',
    cvc: 'CVC'
  },
  ru: {
    sub: 'Твой стритвир-маркет',
    live: 'LIVE · 24/7',
    tg: 'Продолжить с Telegram',
    ru: 'Switch to English',
    search: 'Поиск товаров...',
    all: 'Все',
    sneakers: 'Кроссовки',
    jackets: 'Куртки',
    accessories: 'Аксессуары',
    store: 'Магазин',
    orders: 'Заказы',
    profile: 'Профиль',
    back: 'Назад',
    description: 'ОПИСАНИЕ',
    size: 'РАЗМЕР',
    add: 'В корзину',
    buy: 'Купить',
    added: 'Добавлено!',
    cart: 'Корзина',
    checkout: 'Оформление',
    subtotal: 'Итого',
    remove: 'Убрать',
    crypto: 'Крипто',
    card: 'Карта',
    copy: 'Копировать',
    copied: 'Скопировано',
    pay: 'Оформить заказ',
    confirm: 'Заказ принят',
    backStore: 'В магазин',
    country: 'Страна',
    city: 'Город',
    hood: 'Район',
    geoSearch: 'Поиск',
    empty: 'Нет совпадений',
    noOrders: 'Заказов нет',
    placed: 'Оформлен',
    guest: 'Гость',
    low: 'МАЛО',
    out: 'НЕТ',
    stock: 'в наличии',
    name: 'Имя',
    number: 'Номер карты',
    exp: 'ММ/ГГ',
    cvc: 'CVC'
  }
}

export function t(lang: ShopLang, key: string): string {
  return COPY[lang][key] ?? key
}

export function euro(n: number): string {
  return `€${n}`
}
