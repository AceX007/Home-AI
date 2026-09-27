#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { takeHuntPreventDiff } from '../packages/runtime/src/pack-chrome.mjs'

const blob = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : readFileSync(0, 'utf8')
const r = takeHuntPreventDiff(blob)
if (!r.ok) {
  console.error('hunt-prevent: ' + r.reason)
  process.exit(1)
}
console.log(r.reason)
