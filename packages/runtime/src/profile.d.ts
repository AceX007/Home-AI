import type { HomeProfile, RuleCard } from '@homeai/core'

export function defaultProfile(): HomeProfile
export function takeProfile(raw: unknown): HomeProfile
export function loadProfile(root: string): HomeProfile
export function saveProfile(root: string, patch: Partial<HomeProfile> | unknown): HomeProfile
export function aboutMeRule(profile: unknown): RuleCard | null
