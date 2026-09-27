export type VisualTier = 'potato' | 'balanced' | 'cinematic'
export type VramProfile = 'cpu' | 'tiny' | 'small' | 'standard'
export type ProviderId = 'local' | 'openai' | 'openrouter' | 'cursor'
export type AgentMode = 'agent' | 'think' | 'ask' | 'plan' | 'debug' | 'multitask'
export type ApprovalMode = 'allowlist' | 'unrestricted' | 'manual' | 'auto-review'
export const AGENT_MODES: AgentMode[] = ['agent', 'think', 'plan', 'debug', 'multitask', 'ask']
export type ForgeRoute = 'local_tools' | 'local_gen' | 'cloud' | 'mixed'
export type ForgeStep = 'perceive' | 'route' | 'act' | 'verify' | 'remember'
export type SecretName = 'openai' | 'openrouter' | 'cursor' | 'groq' | 'gemini' | 'telegram'

export type ThreadSource = 'desktop' | 'telegram' | 'both'

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system-note'
  text: string
  at: number
  runId?: string
}

export interface ConversationThread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  source: ThreadSource
  telegramChatId?: number
  turns: ConversationTurn[]
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: number
  source: ThreadSource
  telegramChatId?: number
}

export interface HomeProfile {
  displayName: string
  defaultMode: AgentMode
  defaultProvider: ProviderId
  standingGoal: string
  pinnedSkill: string
  telegramNotifyDesktopRuns: boolean
  aboutMe: string
  miniAppUrl: string
}

export interface HardwareProbe {
  gpuName: string
  vramMb: number
  vulkan: boolean
  cpuThreads: number
  ramTotalMb: number
  ramAvailMb: number
  profile: VramProfile
  visualTier: VisualTier
  nGpuLayers: number
  contextSize: number
  batchSize: number
  reservedVramMb: number
  warning?: string
  coderEnabled?: boolean
  coderModelName?: string
}

export interface GovernorOverride {
  profile?: VramProfile | 'auto'
  visualTier?: VisualTier | 'auto'
  contextSize?: number
  nGpuLayers?: number
}

export interface LlamaLoadArgs {
  modelPath: string
  host: string
  port: number
  nGpuLayers: number
  contextSize: number
  batchSize: number
  threads: number
  flashAttn: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ToolPack = 'core' | 'research' | 'browser' | 'design' | 'life' | 'mcp-domain'

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  permissions: Array<'read' | 'write' | 'net' | 'exec'>
  pack?: ToolPack
}

export interface ToolResult {
  ok: boolean
  name: string
  content: string
  extra?: Record<string, unknown>
}

export interface FileChange {
  path: string
  before: string
  after: string
  origin: 'agent' | 'inline'
}

export type WorkflowLane = 'hunt' | 'verify' | 'critic'

export interface StreamChunk {
  type:
    | 'text'
    | 'tool_call'
    | 'status'
    | 'error'
    | 'done'
    | 'step'
    | 'edit'
    | 'question'
    | 'approval'
    | 'checkpoint'
    | 'context'
    | 'usage'
  text?: string
  toolCall?: ToolCall
  step?: ForgeStep
  route?: ForgeRoute
  error?: string
  edit?: FileChange
  question?: AskUserPrompt
  approval?: ApprovalPrompt
  checkpoint?: CheckpointMeta
  context?: ContextRing
  usage?: { total: number }
  lane?: WorkflowLane
}

export interface AskUserPrompt {
  id: string
  questions: Array<{ id: string; prompt: string; options?: string[] }>
}

export interface ApprovalPrompt {
  id: string
  tool: string
  detail: string
  permission: 'exec' | 'net' | 'write'
}

export interface CheckpointMeta {
  id: string
  label: string
  at: number
  files: string[]
}

export interface Checkpoint {
  id: string
  label: string
  at: number
  files: Array<{ path: string; before: string; after: string }>
}

export interface ContextRing {
  system: number
  tools: number
  rules: number
  skills: number
  rag: number
  mentions: number
  chat: number
  total: number
  cap: number
}

export interface PermissionsFile {
  approvalMode: ApprovalMode
  terminalAllowlist: string[]
  mcpAllowlist: string[]
  netAllowlist: string[]
  fsExtraRoots?: string[]
  autoRun?: { allow_instructions?: string[]; block_instructions?: string[] }
  autoReview?: { allow_instructions?: string[]; block_instructions?: string[] }
}

export interface GitFileStatus {
  path: string
  xy: string
  staged: boolean
}

export interface GitSnapshot {
  branch?: string
  porcelain: string
  files: GitFileStatus[]
  aheadBehind?: string
}

export interface RagHit {
  path: string
  kind: string
  symbol?: string
  score: number
  snippet: string
}

export interface ModManifest {
  id: string
  name: string
  version: string
  enabled: boolean
  description: string
  permissions: Array<'read' | 'write' | 'net' | 'exec'>
  contributes?: {
    skills?: boolean
    rules?: boolean
    tools?: boolean
  }
}

export interface SkillCard {
  id: string
  name: string
  description: string
  body: string
  source: string
  slash?: string
  disableModelInvocation?: boolean
}

export interface RuleCard {
  id: string
  title: string
  body: string
  source: string
  alwaysApply?: boolean
  globs?: string[]
  description?: string
  kind?: 'always' | 'glob' | 'intelligent' | 'manual'
}

export interface NoteDoc {
  path: string
  title: string
  preview: string
  mtime: number
}

export interface TaskCard {
  id: string
  title: string
  body: string
  column: 'backlog' | 'doing' | 'review' | 'done'
  createdAt: number
}

export interface TaskBoard {
  id: string
  title: string
  columns: Array<{ id: TaskCard['column']; title: string }>
  cards: TaskCard[]
}

export interface QaRecord {
  id: string
  prompt: string
  verdict: 'pass' | 'fail' | 'pending'
  notes: string
  trace: string
  createdAt: number
}

export interface MapNode {
  id: string
  title: string
  kind: 'session' | 'file' | 'topic' | 'discovery'
  payload?: string
  createdAt: number
}

export interface MapEdge {
  src: string
  dst: string
  rel: string
}

export interface DesignLayout {
  widthMode?: 'hug' | 'fixed' | 'fill'
  heightMode?: 'hug' | 'fixed' | 'fill'
  width?: number
  height?: number
  gap?: number
  radius?: number
  opacity?: number
  padMode?: 'none' | 'all' | 'xy' | 'individual'
  padT?: number
  padR?: number
  padB?: number
  padL?: number
  padV?: number
  padH?: number
  marginMode?: 'none' | 'all' | 'xy' | 'individual'
  marT?: number
  marR?: number
  marB?: number
  marL?: number
  marV?: number
  marH?: number
  position?: 'inline' | 'absolute'
  offX?: number
  offY?: number
}

export interface DesignNode {
  type: string
  text?: string
  detail?: string
  role?: string
  order?: number
  parent?: string
  tag?: string
  visible?: boolean
  tid?: number
  page?: string
  style?: Record<string, string>
  attrs?: { class?: string }
  layout?: DesignLayout
  locks?: { content?: boolean; layout?: boolean; style?: boolean }
}

export interface DesignComment {
  nodeId: string
  text: string
  status: 'open' | 'resolved' | 'needs-re-anchor'
  anchorRevision: string
  prop?: 'text' | 'detail'
}

export interface DesignTokenSource {
  path: string
  format: 'dtcg-2025.10' | string
}

export interface DesignIR {
  schema: 'designir/0.1'
  revision: string
  artifact: { id: string; profile: string; name?: string }
  brief?: { goal?: string; audience?: string }
  tokens: Record<string, string | number>
  tokenSources?: DesignTokenSource[]
  nodes: Record<string, DesignNode>
  locks?: Record<string, unknown>
  pages?: Array<{ id: string; name: string }>
  comments?: Record<string, DesignComment>
}

export interface DesignPatchOp {
  op: 'add' | 'remove' | 'replace'
  path: string
  value?: unknown
}

export interface DesignPatchEnvelope {
  baseRevision?: string
  intentId?: string
  scope?: string[]
  patch: DesignPatchOp[]
}

export interface DesignListItem {
  slug: string
  name: string
  revision: string
  mtime: number
}

export interface DesignCreateArgs {
  brief?: string
  template?: string
  name?: string
  slug?: string
}

export interface DesignChanged {
  slug: string
  revision: string
}

export interface LlmStatus {
  running: boolean
  backend: 'llama-server' | 'lmstudio' | 'none'
  modelPath?: string
  port?: number
  loadedAt?: number
  lastUsedAt?: number
  error?: string
}

export interface ProviderStatus {
  id: ProviderId
  configured: boolean
  label: string
}

export interface FileEntry {
  name: string
  path: string
  dir: boolean
  size: number
}

export interface OpenTab {
  path: string
  preview?: boolean
}

export const DEFAULT_LLAMA_PORT = 8765
export const DEFAULT_CODER_PORT = 8766
export const DEFAULT_IDLE_UNLOAD_MS = 20 * 60 * 1000
export const DEFAULT_MODEL_NAME = 'Qwen3.5-2B-Q8_0.gguf'
export const DEFAULT_CODER_MODEL_NAMES = [
  'Qwen2.5-Coder-1.5B-Instruct-Q8_0.gguf',
  'Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf'
]

export const RAG_SUBDIRS = [
  'code',
  'thoughts',
  'discoveries',
  'conversations',
  'maps',
  'skills',
  'rules',
  'routines',
  'tasks',
  'plans',
  'library',
  'recipes'
] as const

export const GROUND_DIRS = ['notes', 'qa', 'taskboards', 'browser/captures', 'designs'] as const
