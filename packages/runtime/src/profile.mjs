import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripActivityText } from './activity.mjs'
import { takeMiniAppUrl } from './telegram-initdata.mjs'
import { redactCloudText } from './think.mjs'

const MODES = new Set(['ask', 'think', 'agent', 'plan', 'debug', 'multitask'])
const PROVIDERS = new Set(['local', 'openai', 'openrouter', 'cursor'])
const KEYS = [
  'displayName',
  'defaultMode',
  'defaultProvider',
  'standingGoal',
  'pinnedSkill',
  'telegramNotifyDesktopRuns',
  'aboutMe',
  'miniAppUrl'
]

export function defaultProfile() {
  return {
    displayName: '',
    defaultMode: 'ask',
    defaultProvider: 'local',
    standingGoal: '',
    pinnedSkill: '',
    telegramNotifyDesktopRuns: false,
    aboutMe: '',
    miniAppUrl: ''
  }
}

export function takeProfile(raw) {
  const d = defaultProfile()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d
  const displayName = stripActivityText(raw.displayName, 48)
  const defaultMode = MODES.has(raw.defaultMode) ? raw.defaultMode : d.defaultMode
  const defaultProvider = PROVIDERS.has(raw.defaultProvider) ? raw.defaultProvider : d.defaultProvider
  const standingGoal = redactCloudText(stripActivityText(raw.standingGoal, 200))
  const pinnedSkill = String(raw.pinnedSkill ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64)
  const telegramNotifyDesktopRuns = raw.telegramNotifyDesktopRuns === true
  const aboutMe = redactCloudText(stripActivityText(raw.aboutMe, 800))
  const miniAppUrl = takeMiniAppUrl(raw.miniAppUrl) || ''
  return {
    displayName,
    defaultMode,
    defaultProvider,
    standingGoal,
    pinnedSkill,
    telegramNotifyDesktopRuns,
    aboutMe,
    miniAppUrl
  }
}

export function loadProfile(root) {
  const p = join(root, 'data', 'homeai-profile.json')
  if (!existsSync(p)) return defaultProfile()
  try {
    return takeProfile(JSON.parse(readFileSync(p, 'utf8')))
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(root, patch) {
  const cur = loadProfile(root)
  const incoming = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}
  const merged = { ...cur }
  for (const key of KEYS) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) merged[key] = incoming[key]
  }
  const next = takeProfile(merged)
  mkdirSync(join(root, 'data'), { recursive: true })
  writeFileSync(join(root, 'data', 'homeai-profile.json'), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function aboutMeRule(profile) {
  const p = takeProfile(profile)
  if (!p.aboutMe && !p.displayName && !p.standingGoal) return null
  return {
    id: 'profile:about-me',
    title: 'About the operator',
    body: [p.displayName && `Name: ${p.displayName}`, p.standingGoal && `Goal: ${p.standingGoal}`, p.aboutMe]
      .filter(Boolean)
      .join('\n'),
    source: 'data/homeai-profile.json',
    alwaysApply: true,
    kind: 'always'
  }
}
