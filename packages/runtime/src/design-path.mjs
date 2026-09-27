import { defaultDesignIR } from './designir.mjs'

const BLOCK = new Set(['', '__proto__', 'constructor', 'prototype', '.', '..'])
const SLUG = /^[\w.-]{1,40}$/
const PROFILES = new Set([
  'ui.web',
  'ui.mobile',
  'slides',
  'doc',
  'wire',
  'anim',
  'email',
  'type',
  'resume',
  'research',
  '3d'
])
const TMPL = {
  blank: 'ui.web',
  mobile: 'ui.mobile',
  slides: 'slides',
  doc: 'doc',
  wire: 'wire',
  anim: 'anim',
  ui: 'ui.web',
  resume: 'resume',
  '3d': '3d',
  research: 'research',
  email: 'email',
  type: 'type'
}

export const DEFAULT_DESIGN_SLUG = 'default'
export const QUOKKA_ARTIFACT_ID = 'quokka-shop-storefront'

export function designSlug(raw) {
  const s = String(raw ?? DEFAULT_DESIGN_SLUG).trim()
  if (!s) return DEFAULT_DESIGN_SLUG
  if (s.includes('\0') || s.includes('..') || s.includes('/') || s.includes('\\')) {
    throw new Error('path escapes workspace')
  }
  if (BLOCK.has(s) || s.includes('__proto__')) throw new Error('bad design slug')
  if (!SLUG.test(s)) throw new Error('bad design slug')
  return s
}

export function designRel(slug) {
  return `designs/${designSlug(slug)}.design.json`
}

export function slugFromBrief(text) {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[<>]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  if (raw && SLUG.test(raw) && !BLOCK.has(raw)) return raw
  return `draft-${Date.now().toString(36).slice(-8)}`
}

export function profileFromTemplate(id) {
  const k = String(id || 'blank')
  const p = Object.prototype.hasOwnProperty.call(TMPL, k) ? TMPL[k] : 'ui.web'
  return PROFILES.has(p) ? p : 'ui.web'
}

export function isShopSample(doc) {
  return Boolean(doc && doc.artifact && doc.artifact.id === QUOKKA_ARTIFACT_ID)
}

export function safeExportStem(slug, shop) {
  if (shop) return 'quokka-shop'
  try {
    return designSlug(slug)
  } catch {
    return 'design'
  }
}

function cleanText(s, max) {
  return String(s || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function designTask(slug, brief, template) {
  const id = designSlug(slug)
  const b = cleanText(brief, 2000)
  const tmpl = cleanText(template, 40) || 'blank'
  return [
    `You are designing artifact slug "${id}".`,
    `Call design_get with id "${id}", then design_patch with the same id and baseRevision. design_ingest_tokens is allowed for a local DTCG file.`,
    `Patch ops are add, remove, or replace. Example patch: [{"op":"add","path":"/pages/-","value":{"id":"p3","name":"Ask"}},{"op":"add","path":"/nodes/p3.root","value":{"type":"frame","tag":"div","page":"p3","order":0,"text":"Ask"}}].`,
    `Never fs_write the IR. Never HTML. No url() in styles. Node ids [\\w.-] only.`,
    `The canvas shows every /pages entry (max 16). Add pages and nodes with page set so the operator can navigate all designed screens.`,
    `Template profile seed: ${tmpl}.`,
    `Brief: ${b || '(blank — propose a simple two-screen UI for the template)'}.`,
    `Design THAT product, not a shop unless the brief is a store. Streetwear/sneakers only if the brief is a shop.`
  ].join(' ')
}

export function seedDesignIR(args) {
  const slug = designSlug(args && args.slug)
  const goal = cleanText(args && args.brief, 2000)
  const title = cleanText((args && args.name) || goal || slug, 80) || slug
  const profile = profileFromTemplate(args && args.template)
  const base = defaultDesignIR()
  const body = goal || 'Describe this screen.'
  return {
    schema: 'designir/0.1',
    revision: 'rev_1',
    artifact: { id: slug, profile, name: title },
    brief: { goal: goal || `Design ${title}`, audience: 'operator' },
    tokens: { ...base.tokens },
    pages: [
      { id: 'p1', name: 'Screen 1' },
      { id: 'p2', name: 'Screen 2' }
    ],
    nodes: {
      'p1.root': {
        type: 'frame',
        tag: 'div',
        page: 'p1',
        order: 0,
        text: title
      },
      'p1.title': {
        type: 'text',
        tag: 'h1',
        page: 'p1',
        parent: 'p1.root',
        order: 1,
        text: title
      },
      'p1.body': {
        type: 'text',
        tag: 'p',
        page: 'p1',
        parent: 'p1.root',
        order: 2,
        text: body.slice(0, 280)
      },
      'p2.root': {
        type: 'frame',
        tag: 'div',
        page: 'p2',
        order: 0,
        text: 'Next'
      },
      'p2.title': {
        type: 'text',
        tag: 'h1',
        page: 'p2',
        parent: 'p2.root',
        order: 1,
        text: 'Screen 2'
      }
    },
    locks: {},
    comments: {}
  }
}

export function irGrew(before, after) {
  const pages = (d) => (Array.isArray(d?.pages) ? d.pages.length : 0)
  const nodes = (d) => {
    const map = d?.nodes
    if (!map || typeof map !== 'object' || Array.isArray(map)) return 0
    return Object.getOwnPropertyNames(map).filter((k) => !BLOCK.has(k)).length
  }
  return pages(after) > pages(before) || nodes(after) > nodes(before)
}

/** Compact DesignIR for the tool loop. Pretty 16k dumps starve local 2B context. */
export function designGetContent(doc) {
  try {
    const compact = JSON.stringify(doc)
    if (compact.length <= 4000) return compact
  } catch {
    /* digest */
  }
  const nodes = doc && doc.nodes && typeof doc.nodes === 'object' && !Array.isArray(doc.nodes) ? doc.nodes : {}
  const ids = Object.getOwnPropertyNames(nodes)
    .filter((k) => k && !BLOCK.has(k) && !k.includes('__proto__'))
    .slice(0, 64)
  return JSON.stringify({
    schema: doc && doc.schema ? doc.schema : 'designir/0.1',
    revision: doc && doc.revision,
    artifact: doc && doc.artifact,
    brief: doc && doc.brief,
    pages: Array.isArray(doc && doc.pages) ? doc.pages.slice(0, 16) : [],
    nodeIds: ids,
    hint: 'Nodes omitted. design_patch add /pages/- and /nodes/<id>.'
  })
}
