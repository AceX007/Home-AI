import type { DesignIR, DesignLayout, DesignNode } from '@homeai/core'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nodeReactStyle } from './cssSafe'
import SelFrame from './SelFrame'
import { pinCaption } from '@homeai/runtime/browser'
import {
  DEMO_WALLETS,
  GEO,
  PRODUCTS,
  euro,
  t,
  type CryptoKind,
  type GeoStep,
  type PayTab,
  type Product,
  type ShopLang,
  type ShopRoute
} from './shopData'

export interface CartLine {
  key: string
  product: Product
  size: string
  qty: number
}

export interface ShopState {
  lang: ShopLang
  route: ShopRoute
  geoStep: GeoStep
  geoQ: string
  country: string
  city: string
  hood: string
  category: 'all' | Product['category']
  search: string
  productId: string
  size: string
  cart: CartLine[]
  sheet: boolean
  payTab: PayTab
  crypto: CryptoKind
  copied: boolean
  added: boolean
  orderNo: string
  cardName: string
  cardNum: string
  cardExp: string
  cardCvc: string
}

export const INITIAL_SHOP: ShopState = {
  lang: 'en',
  route: 'landing',
  geoStep: 'country',
  geoQ: '',
  country: '',
  city: '',
  hood: '',
  category: 'all',
  search: '',
  productId: 'air-max-90',
  size: '40',
  cart: [],
  sheet: false,
  payTab: 'crypto',
  crypto: 'BTC',
  copied: false,
  added: false,
  orderNo: '',
  cardName: '',
  cardNum: '',
  cardExp: '',
  cardCvc: ''
}

function tokenHex(v: unknown): string | undefined {
  return typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : undefined
}

function StatusBar() {
  return (
    <div className="qs-status">
      <span>9:41</span>
      <span className="qs-status-r">
        LTE
        <i className="qs-sig" />
        <i className="qs-bat" />
      </span>
    </div>
  )
}

function Nav({
  shop,
  go,
  interact,
  page,
  onPage
}: {
  shop: ShopState
  go: (r: ShopRoute) => void
  interact: boolean
  page: string
  onPage?: (id: string) => void
}) {
  const active = interact ? shop.route : page
  return (
    <nav className="qs-tabbar">
      {(['store', 'orders', 'profile'] as const).map((id) => (
        <button
          key={id}
          type="button"
          className={id === 'store' ? (active === 'store' || active === 'product' ? 'on' : '') : active === id ? 'on' : ''}
          onClick={() => (interact ? go(id) : onPage?.(id))}
        >
          <span className={`qs-ico qs-ico-${id}`} />
          {t(shop.lang, id)}
        </button>
      ))}
    </nav>
  )
}

export default function PhoneCanvas(props: {
  doc: DesignIR | null
  sel: string | null
  onSel: (id: string) => void
  page: string
  onPage?: (id: string) => void
  interact: boolean
  shop: ShopState
  setShop: (fn: (s: ShopState) => ShopState) => void
  commentMode: boolean
  textTool?: boolean
  onDraft?: (n: DesignNode, id?: string, opts?: { history?: boolean }) => void
  pins?: Array<{ id: string; nodeId: string; text: string; status?: string }>
}) {
  const { doc, sel, onSel, page, onPage, interact, shop, setShop, commentMode, textTool, onDraft, pins = [] } = props
  const [openPin, setOpenPin] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [pinPos, setPinPos] = useState<Record<string, { t: number; l: number }>>({})
  const hostRef = useRef<HTMLDivElement | null>(null)
  const nodes = doc?.nodes ?? {}
  const vis = (id: string) => nodes[id]?.visible !== false
  const col = nodes['landing.col']
  const hero = nodes['landing.hero']
  const accent = tokenHex(doc?.tokens?.colorAccent)
  const bg = tokenHex(doc?.tokens?.colorBg)
  const product = PRODUCTS.find((p) => p.id === shop.productId) ?? PRODUCTS[0]
  const go = (route: ShopRoute) => setShop((s) => ({ ...s, route, sheet: route === 'cart' }))
  const pick = (id: string) => {
    if (interact && !commentMode) return
    onSel(id)
    const n = nodes[id]
    if (textTool && n?.type === 'text') setEditId(id)
    else setEditId(null)
  }
  const filtered = PRODUCTS.filter((p) => {
    if (shop.category !== 'all' && p.category !== shop.category) return false
    if (shop.search && !p.name.toLowerCase().includes(shop.search.toLowerCase())) return false
    return true
  })
  const view = interact
    ? shop.route
    : page === 'store'
      ? 'store'
      : page === 'product'
        ? 'product'
        : page === 'orders'
          ? 'orders'
          : page === 'profile'
            ? 'profile'
            : 'landing'
  const subtotal = shop.cart.reduce((n, l) => n + l.product.price * l.qty, 0)
  const showGeo = (interact && view === 'geo') || (!interact && nodes['cond.geo']?.visible === true)
  const showCart = (interact && (view === 'cart' || shop.sheet)) || (!interact && nodes['cond.cart']?.visible === true)
  const showPay = (interact && view === 'checkout') || (!interact && nodes['cond.pay']?.visible === true)
  const nav = <Nav shop={shop} go={go} interact={interact} page={page} onPage={onPage} />

  const applyLay = (next: DesignLayout, commit: boolean) => {
    if (!sel || !onDraft) return
    const cur = nodes[sel]
    if (!cur) return
    onDraft({ ...cur, layout: next }, sel, { history: commit })
  }
  const applyText = (id: string, text: string) => {
    const cur = nodes[id]
    if (!cur || !onDraft) return
    onDraft({ ...cur, text: text.replace(/[<>]/g, '').slice(0, 500) }, id)
  }

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const next: Record<string, { t: number; l: number }> = {}
    pins.forEach((p, i) => {
      if (!/^cmt_[\w.-]{1,36}$/.test(p.id) || !/^[\w.-]{1,80}$/.test(p.nodeId)) return
      const el = host.querySelector(`[data-nid="${p.nodeId}"]`)
      if (el) {
        const a = el.getBoundingClientRect()
        const b = host.getBoundingClientRect()
        next[p.id] = { t: a.top - b.top, l: Math.min(a.left - b.left + a.width - 8, b.width - 24) }
      } else {
        next[p.id] = { t: 44 + i * 28, l: 8 }
      }
    })
    setPinPos(next)
  }, [pins, doc, view])

  const addCart = (buy: boolean) => {
    setShop((s) => {
      const key = `${product.id}-${s.size}`
      const hit = s.cart.find((l) => l.key === key)
      const cart = hit
        ? s.cart.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
        : [...s.cart, { key, product, size: s.size, qty: 1 }]
      return { ...s, cart, added: true, sheet: buy, route: buy ? 'cart' : s.route }
    })
    window.setTimeout(() => setShop((s) => ({ ...s, added: false })), 900)
  }

  return (
    <div
      className="qs-phone"
      data-sel={sel || ''}
      ref={hostRef}
      style={{
        background: bg,
        ['--qs-accent' as string]: accent ?? '#32d74b'
      }}
    >
      <StatusBar />
      {view === 'landing' && vis('landing.col') ? (
        <div
          className={`qs-landing ${sel === 'landing.col' ? 'sel' : ''}`}
          data-nid="landing.col"
          style={nodeReactStyle(col)}
          onClick={() => pick('landing.col')}
        >
          {vis('landing.hero') ? (
            <div
              className={`qs-hero ${sel === 'landing.hero' ? 'sel' : ''}`}
              data-nid="landing.hero"
              style={nodeReactStyle(hero)}
              onClick={(e) => {
                e.stopPropagation()
                pick('landing.hero')
              }}
            >
              {vis('landing.logo') ? (
                <button
                  type="button"
                  className={`qs-logo ${sel === 'landing.logo' ? 'sel' : ''}`}
                  data-nid="landing.logo"
                  onClick={(e) => {
                    e.stopPropagation()
                    pick('landing.logo')
                  }}
                >
                  {nodes['landing.logo']?.text ?? 'Q'}
                </button>
              ) : null}
              {vis('landing.title') ? (
                <h1
                  className={sel === 'landing.title' ? 'sel' : ''}
                  data-nid="landing.title"
                  onClick={(e) => {
                    e.stopPropagation()
                    pick('landing.title')
                  }}
                >
                  {nodes['landing.title']?.text ?? 'Quakka Shop'}
                </h1>
              ) : null}
              {vis('landing.sub') ? (
                <p
                  className="qs-sub"
                  data-nid="landing.sub"
                  onClick={(e) => {
                    e.stopPropagation()
                    pick('landing.sub')
                  }}
                >
                  {shop.lang === 'ru' ? t('ru', 'sub') : (nodes['landing.sub']?.text ?? t('en', 'sub'))}
                </p>
              ) : null}
              {vis('landing.live') ? (
                <div className="qs-live" data-nid="landing.live" onClick={(e) => { e.stopPropagation(); pick('landing.live') }}>
                  <i />
                  {shop.lang === 'ru' ? t('ru', 'live') : (nodes['landing.live']?.text ?? t('en', 'live'))}
                </div>
              ) : null}
            </div>
          ) : null}
          {vis('landing.actions') ? (
          <div className="qs-landing-actions" style={nodeReactStyle(nodes['landing.actions'])}>
            {vis('landing.tg') ? (
              <button
                type="button"
                className={`qs-tg ${sel === 'landing.tg' ? 'sel' : ''}`}
                data-nid="landing.tg"
                onClick={(e) => {
                  e.stopPropagation()
                  if (interact) go('geo')
                  else pick('landing.tg')
                }}
              >
                <span className="qs-tg-ico" />
                {t(shop.lang, 'tg')}
              </button>
            ) : null}
            {vis('landing.ru') ? (
              <button
                type="button"
                className={`qs-ru ${sel === 'landing.ru' ? 'sel' : ''}`}
                data-nid="landing.ru"
                onClick={(e) => {
                  e.stopPropagation()
                  if (interact) setShop((s) => ({ ...s, lang: s.lang === 'en' ? 'ru' : 'en' }))
                  else pick('landing.ru')
                }}
              >
                {shop.lang === 'en' ? (nodes['landing.ru']?.text ?? t('en', 'ru')) : t('ru', 'ru')}
              </button>
            ) : null}
          </div>
          ) : null}
        </div>
      ) : null}

      {showGeo ? <Geo shop={shop} setShop={setShop} go={go} /> : null}

      {view === 'store' ? (
        <div className="qs-store" data-nid="store.header" onClick={() => pick('store.header')}>
          <header className="qs-store-head">
            <span className="qs-palm" />
            <strong
              className="qs-wordmark"
              data-nid="store.brand"
              onClick={(e) => {
                e.stopPropagation()
                pick('store.brand')
              }}
            >
              {nodes['store.brand']?.text ?? 'QUOKKA SHOP'}
            </strong>
            <span className="qs-palm" />
            <button
              type="button"
              className="qs-lang-pill"
              data-nid="store.lang"
              onClick={(e) => {
                e.stopPropagation()
                if (interact) setShop((s) => ({ ...s, lang: s.lang === 'en' ? 'ru' : 'en' }))
                else pick('store.lang')
              }}
            >
              {shop.lang === 'en' ? (nodes['store.lang']?.text ?? 'RU') : 'EN'}
            </button>
            <button
              type="button"
              className="qs-bag"
              data-nid="store.bag"
              onClick={(e) => {
                e.stopPropagation()
                if (interact) setShop((s) => ({ ...s, sheet: true, route: 'cart' }))
                else pick('store.bag')
              }}
            >
              {shop.cart.reduce((n, l) => n + l.qty, 0) || ''}
            </button>
          </header>
          <label className="qs-search" data-nid="store.search" onClick={() => pick('store.search')}>
            <span className="qs-mag" />
            <input
              value={shop.search}
              placeholder={nodes['store.search']?.text ?? t(shop.lang, 'search')}
              onChange={(e) => setShop((s) => ({ ...s, search: e.target.value.slice(0, 80) }))}
              disabled={!interact}
            />
          </label>
          <div className="qs-chips" data-nid="store.chips" onClick={() => pick('store.chips')}>
            {(['all', 'sneakers', 'jackets', 'accessories'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={shop.category === c ? 'on' : ''}
                onClick={(e) => {
                  e.stopPropagation()
                  if (interact) setShop((s) => ({ ...s, category: c }))
                  else pick('store.chips')
                }}
              >
                {t(shop.lang, c)}
              </button>
            ))}
          </div>
          <div className="qs-grid" data-nid="store.grid" onClick={() => pick('store.grid')}>
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="qs-card"
                onClick={(e) => {
                  e.stopPropagation()
                  if (interact) setShop((s) => ({ ...s, productId: p.id, size: p.sizes[0], route: 'product' }))
                  else pick('store.grid')
                }}
              >
                <div className={`qs-card-img qs-swatch-${p.id}`}>
                  <span className="qs-swatch-mark">{p.name.slice(0, 1)}</span>
                  {p.stock > 0 && p.stock < 5 ? <span className="qs-badge">{t(shop.lang, 'low')}</span> : null}
                  {p.stock === 0 ? <span className="qs-badge out">{t(shop.lang, 'out')}</span> : null}
                </div>
                <b>{p.name}</b>
                <span className="qs-var">{p.sizes.slice(0, 3).join(', ')}{p.sizes.length > 3 ? ` +${p.sizes.length - 3}` : ''}</span>
                <div className="qs-card-foot">
                  <em>{euro(p.price)}</em>
                  <small>{p.stock} {t(shop.lang, 'stock')}</small>
                </div>
              </button>
            ))}
          </div>
          {nav}
        </div>
      ) : null}

      {view === 'product' ? (
        <div className="qs-pdp" data-nid="prod.hero" onClick={() => pick('prod.hero')}>
          <header className="qs-pdp-head">
            <button type="button" className="qs-back" onClick={() => (interact ? go('store') : pick('prod.hero'))}>
              ‹ {t(shop.lang, 'back')}
            </button>
            <b>{product.name}</b>
            <button type="button" className="qs-bag on" onClick={() => (interact ? setShop((s) => ({ ...s, sheet: true, route: 'cart' })) : pick('store.bag'))}>
              {shop.cart.reduce((n, l) => n + l.qty, 0) || 0}
            </button>
          </header>
          <div className={`qs-pdp-img qs-swatch-${product.id}`}>
            <span className="qs-swatch-mark lg">{product.name.slice(0, 1)}</span>
            {product.stock > 0 && product.stock < 5 ? <span className="qs-badge">{t(shop.lang, 'low')}</span> : null}
          </div>
          <div className="qs-pdp-row">
            <div>
              <h2 className={sel === 'prod.title' ? 'sel' : ''} data-nid="prod.title" onClick={(e) => { e.stopPropagation(); pick('prod.title') }}>
                {nodes['prod.title']?.text && product.id === 'air-max-90' ? nodes['prod.title'].text : product.name}
              </h2>
              <span className="qs-stock-line">• {product.stock} {t(shop.lang, 'stock')}</span>
            </div>
            <strong data-nid="prod.price" onClick={(e) => { e.stopPropagation(); pick('prod.price') }}>
              {product.id === 'air-max-90' ? nodes['prod.price']?.text ?? euro(product.price) : euro(product.price)}
            </strong>
          </div>
          <div className="qs-desc" data-nid="prod.desc" onClick={(e) => { e.stopPropagation(); pick('prod.desc') }}>
            <span>{t(shop.lang, 'description')}</span>
            <p>{product.id === 'air-max-90' ? nodes['prod.desc']?.text ?? product.blurb : product.blurb}</p>
          </div>
          <div className="qs-size-lab">{t(shop.lang, 'size')}</div>
          <div className="qs-sizes">
            {product.sizes.map((sz) => (
              <button key={sz} type="button" className={shop.size === sz ? 'on' : ''} onClick={() => setShop((s) => ({ ...s, size: sz }))}>
                {sz}
              </button>
            ))}
          </div>
          {shop.added ? <div className="qs-flash">{t(shop.lang, 'added')}</div> : null}
          <div className="qs-pdp-cta">
            <button type="button" className="ghost" data-nid="prod.add" onClick={(e) => { e.stopPropagation(); if (interact) addCart(false); else pick('prod.add') }}>
              {nodes['prod.add']?.text ?? t(shop.lang, 'add')}
            </button>
            <button type="button" className="buy" data-nid="prod.buy" onClick={(e) => { e.stopPropagation(); if (interact) addCart(true); else pick('prod.buy') }}>
              {nodes['prod.buy']?.text ?? t(shop.lang, 'buy')} →
            </button>
          </div>
          {nav}
        </div>
      ) : null}

      {showCart ? (
        <div className="qs-sheet-bg" onClick={() => setShop((s) => ({ ...s, sheet: false, route: s.route === 'cart' ? 'store' : s.route }))}>
          <div className="qs-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{t(shop.lang, 'cart')}</h3>
            {shop.cart.length === 0 ? <p className="qs-empty">{t(shop.lang, 'empty')}</p> : null}
            {shop.cart.map((l) => (
              <div key={l.key} className="qs-line">
                <div>
                  <b>{l.product.name}</b>
                  <small>{l.size}</small>
                </div>
                <div className="qs-qty">
                  <button type="button" onClick={() => setShop((s) => ({ ...s, cart: s.cart.flatMap((x) => (x.key !== l.key ? [x] : x.qty <= 1 ? [] : [{ ...x, qty: x.qty - 1 }])) }))}>
                    −
                  </button>
                  <span>{l.qty}</span>
                  <button type="button" onClick={() => setShop((s) => ({ ...s, cart: s.cart.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)) }))}>
                    +
                  </button>
                </div>
                <em>{euro(l.product.price * l.qty)}</em>
                <button type="button" className="link" onClick={() => setShop((s) => ({ ...s, cart: s.cart.filter((x) => x.key !== l.key) }))}>
                  {t(shop.lang, 'remove')}
                </button>
              </div>
            ))}
            <div className="qs-subtotal">
              <span>{t(shop.lang, 'subtotal')}</span>
              <b>{euro(subtotal)}</b>
            </div>
            <button
              type="button"
              className="qs-tg"
              disabled={!shop.cart.length}
              onClick={() => setShop((s) => ({ ...s, route: 'checkout', sheet: false }))}
            >
              {t(shop.lang, 'checkout')}
            </button>
          </div>
        </div>
      ) : null}

      {showPay ? (
        <Checkout shop={shop} setShop={setShop} subtotal={subtotal} />
      ) : null}

      {view === 'confirm' ? (
        <div className="qs-confirm">
          <div className="qs-check" />
          <h2>{t(shop.lang, 'confirm')}</h2>
          <p>{shop.orderNo}</p>
          <button type="button" className="qs-tg" onClick={() => setShop((s) => ({ ...INITIAL_SHOP, lang: s.lang, route: 'store', orderNo: s.orderNo }))}>
            {t(shop.lang, 'backStore')}
          </button>
        </div>
      ) : null}
      {view === 'orders' ? (
        <div className="qs-blank qs-orders" data-nid="orders.col" onClick={() => pick('orders.col')}>
          <h2 data-nid="orders.title" onClick={(e) => { e.stopPropagation(); pick('orders.title') }}>
            {shop.lang === 'en' ? nodes['orders.title']?.text ?? t('en', 'orders') : t('ru', 'orders')}
          </h2>
          {shop.orderNo ? (
            <button type="button" className="qs-order-card" data-nid="orders.row" onClick={(e) => { e.stopPropagation(); pick('orders.row') }}>
              <span className="qs-order-id">{shop.orderNo}</span>
              <small>{t(shop.lang, 'placed')}</small>
            </button>
          ) : (
            <p className="qs-empty" data-nid="orders.empty" onClick={(e) => { e.stopPropagation(); pick('orders.empty') }}>
              {shop.lang === 'en' ? nodes['orders.empty']?.text ?? t('en', 'noOrders') : t('ru', 'noOrders')}
            </p>
          )}
          {nav}
        </div>
      ) : null}
      {view === 'profile' ? (
        <div className="qs-blank qs-profile" data-nid="profile.col" onClick={() => pick('profile.col')}>
          <div className="qs-avatar" aria-hidden>Q</div>
          <h2 data-nid="profile.title" onClick={(e) => { e.stopPropagation(); pick('profile.title') }}>
            {shop.lang === 'en' ? nodes['profile.title']?.text ?? t('en', 'profile') : t('ru', 'profile')}
          </h2>
          <p data-nid="profile.guest" onClick={(e) => { e.stopPropagation(); pick('profile.guest') }}>
            {shop.lang === 'en' ? nodes['profile.guest']?.text ?? t('en', 'guest') : t('ru', 'guest')}
          </p>
          <p data-nid="profile.shop" onClick={(e) => { e.stopPropagation(); pick('profile.shop') }}>
            {nodes['profile.shop']?.text ?? 'Quokka Shop'}
          </p>
          <button type="button" className="qs-tg" onClick={() => (interact ? setShop((s) => ({ ...s, lang: s.lang === 'en' ? 'ru' : 'en' })) : pick('profile.guest'))}>
            {t(shop.lang, 'ru')}
          </button>
          {nav}
        </div>
      ) : null}
      <SelFrame
        hostRef={hostRef}
        sel={sel}
        interact={interact}
        tick={doc}
        layout={sel ? nodes[sel]?.layout : undefined}
        onResize={applyLay}
      />
      {editId && nodes[editId] && !interact ? (
        <input
          className="qs-inline-edit"
          value={nodes[editId]?.text ?? ''}
          maxLength={500}
          onChange={(e) => applyText(editId, e.target.value)}
          onBlur={() => setEditId(null)}
          autoFocus
        />
      ) : null}
      {pins.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className={`qs-pin ${sel === p.nodeId ? 'on' : ''} ${p.status === 'needs-re-anchor' ? 'loose' : ''}`}
          style={{ top: pinPos[p.id]?.t ?? 44 + i * 28, left: pinPos[p.id]?.l ?? 8 }}
          title={pinCaption(p)}
          onClick={(e) => {
            e.stopPropagation()
            if (p.status !== 'needs-re-anchor') onSel(p.nodeId)
            setOpenPin(openPin === p.id ? null : p.id)
          }}
        >
          {i + 1}
        </button>
      ))}
      {openPin
        ? pins
            .filter((p) => p.id === openPin)
            .map((hit) => (
              <div key={hit.id} className="qs-pin-bubble">
                {pinCaption(hit)}
              </div>
            ))
        : null}
    </div>
  )
}

function Geo({
  shop,
  setShop,
  go
}: {
  shop: ShopState
  setShop: (fn: (s: ShopState) => ShopState) => void
  go: (r: ShopRoute) => void
}) {
  const q = shop.geoQ.trim().toLowerCase()
  let items: string[] = []
  if (shop.geoStep === 'country') items = Object.keys(GEO)
  else if (shop.geoStep === 'city' && shop.country in GEO) items = Object.keys(GEO[shop.country as keyof typeof GEO])
  else if (shop.geoStep === 'hood' && shop.country in GEO) {
    const cities = GEO[shop.country as keyof typeof GEO] as Record<string, readonly string[]>
    items = [...(cities[shop.city] ?? [])]
  }
  const shown = items.filter((x) => !q || x.toLowerCase().includes(q))
  const title = shop.geoStep === 'country' ? t(shop.lang, 'country') : shop.geoStep === 'city' ? t(shop.lang, 'city') : t(shop.lang, 'hood')
  return (
    <div className="qs-geo">
      <header className="qs-pdp-head">
        <button
          type="button"
          className="qs-back"
          onClick={() => {
            if (shop.geoStep === 'hood') setShop((s) => ({ ...s, geoStep: 'city', city: '', geoQ: '' }))
            else if (shop.geoStep === 'city') setShop((s) => ({ ...s, geoStep: 'country', country: '', geoQ: '' }))
            else go('landing')
          }}
        >
          ‹ {t(shop.lang, 'back')}
        </button>
        <b>{title}</b>
        <span />
      </header>
      <label className="qs-search">
        <span className="qs-mag" />
        <input value={shop.geoQ} placeholder={t(shop.lang, 'geoSearch')} onChange={(e) => setShop((s) => ({ ...s, geoQ: e.target.value.slice(0, 80) }))} />
      </label>
      <ul className="qs-geo-list">
        {shown.map((name) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => {
                if (shop.geoStep === 'country') setShop((s) => ({ ...s, country: name, geoStep: 'city', geoQ: '' }))
                else if (shop.geoStep === 'city') setShop((s) => ({ ...s, city: name, geoStep: 'hood', geoQ: '' }))
                else setShop((s) => ({ ...s, hood: name, route: 'store', geoQ: '' }))
              }}
            >
              {name}
            </button>
          </li>
        ))}
        {!shown.length ? <li className="qs-empty">{t(shop.lang, 'empty')}</li> : null}
      </ul>
    </div>
  )
}

function Checkout({
  shop,
  setShop,
  subtotal
}: {
  shop: ShopState
  setShop: (fn: (s: ShopState) => ShopState) => void
  subtotal: number
}) {
  const addr = DEMO_WALLETS[shop.crypto]
  const place = () => {
    const n = `QK-${Date.now().toString(36).toUpperCase().slice(-7)}`
    setShop((s) => ({ ...s, orderNo: n, route: 'confirm', cart: [], sheet: false }))
  }
  return (
    <div className="qs-check-out">
      <header className="qs-pdp-head">
        <button type="button" className="qs-back" onClick={() => setShop((s) => ({ ...s, route: 'store' }))}>
          ‹ {t(shop.lang, 'back')}
        </button>
        <b>{t(shop.lang, 'checkout')}</b>
        <span />
      </header>
      <div className="qs-pay-tabs">
        <button type="button" className={shop.payTab === 'crypto' ? 'on' : ''} onClick={() => setShop((s) => ({ ...s, payTab: 'crypto' }))}>
          {t(shop.lang, 'crypto')}
        </button>
        <button type="button" className={shop.payTab === 'card' ? 'on' : ''} onClick={() => setShop((s) => ({ ...s, payTab: 'card' }))}>
          {t(shop.lang, 'card')}
        </button>
      </div>
      {shop.payTab === 'crypto' ? (
        <>
          <div className="qs-chips">
            {(['BTC', 'ETH', 'USDT'] as const).map((c) => (
              <button key={c} type="button" className={shop.crypto === c ? 'on' : ''} onClick={() => setShop((s) => ({ ...s, crypto: c, copied: false }))}>
                {c}
              </button>
            ))}
          </div>
          <div className="qs-addr">
            <code>{addr}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(addr)
                setShop((s) => ({ ...s, copied: true }))
              }}
            >
              {shop.copied ? t(shop.lang, 'copied') : t(shop.lang, 'copy')}
            </button>
          </div>
        </>
      ) : (
        <form
          className="qs-card-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (shop.cardName && shop.cardNum.replace(/\s/g, '').length >= 12 && shop.cardExp && shop.cardCvc.length >= 3) place()
          }}
        >
          <input value={shop.cardName} placeholder={t(shop.lang, 'name')} onChange={(e) => setShop((s) => ({ ...s, cardName: e.target.value.replace(/[<>]/g, '').slice(0, 60) }))} />
          <input value={shop.cardNum} placeholder={t(shop.lang, 'number')} inputMode="numeric" onChange={(e) => setShop((s) => ({ ...s, cardNum: e.target.value.replace(/[^\d ]/g, '').slice(0, 19) }))} />
          <div className="qs-card-row">
            <input value={shop.cardExp} placeholder={t(shop.lang, 'exp')} onChange={(e) => setShop((s) => ({ ...s, cardExp: e.target.value.replace(/[^\d/]/g, '').slice(0, 5) }))} />
            <input value={shop.cardCvc} placeholder={t(shop.lang, 'cvc')} onChange={(e) => setShop((s) => ({ ...s, cardCvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
          </div>
          <button type="submit" className="qs-tg">
            {t(shop.lang, 'pay')} · {euro(subtotal)}
          </button>
        </form>
      )}
      {shop.payTab === 'crypto' ? (
        <button type="button" className="qs-tg" disabled={!shop.cart.length && !subtotal} onClick={place}>
          {t(shop.lang, 'pay')} · {euro(subtotal)}
        </button>
      ) : null}
    </div>
  )
}
