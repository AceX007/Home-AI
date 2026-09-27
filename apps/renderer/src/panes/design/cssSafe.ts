import type { CSSProperties } from 'react'
import type { DesignNode } from '@homeai/core'
import { compileReactStyle, parseCssDeclarations, styleToCss } from '@homeai/runtime/browser'

export { parseCssDeclarations, styleToCss }

export function nodeReactStyle(node?: DesignNode | null): CSSProperties {
  if (!node) return {}
  return compileReactStyle(node) as CSSProperties
}
