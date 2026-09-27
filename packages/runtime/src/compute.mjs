import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertInside } from './paths.mjs'

const MAX_CODE = 80_000
const DEFAULT_MS = 8_000

export function takeComputeRuntime(raw) {
  const t = String(raw || 'python').toLowerCase().trim()
  if (t === 'node' || t === 'javascript' || t === 'js') return 'node'
  return 'python'
}

export function takeComputeCode(raw) {
  const s = String(raw ?? '')
  if (!s.trim() || s.length > MAX_CODE || s.includes('\0')) return null
  return s
}

function safeComputeId(id, fallback) {
  const safe = String(id || fallback)
    .replace(/\.\./g, '_')
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 40)
  return safe || fallback
}

export function computeScriptRel(id, runtime) {
  const ext = runtime === 'node' ? 'mjs' : 'py'
  return `data/compute/runs/${safeComputeId(id, 'run')}.${ext}`
}

export function computePlotRel(id) {
  return `data/compute/plots/${safeComputeId(id, 'plot')}.png`
}

export function computeHookRel(id) {
  return `data/compute/runs/${safeComputeId(id, 'run')}-hook.mjs`
}

export function computeShimRel(id) {
  return `data/compute/runs/${safeComputeId(id, 'run')}-shim.mjs`
}

export function computePromisesShimRel(id) {
  return `data/compute/runs/${safeComputeId(id, 'run')}-pshim.mjs`
}

/** Figures only under data/compute/plots. Rejects `..`, secrets, extra-roots. */
export function assertPlotInside(root, rel) {
  const r = String(rel || '').replace(/\\/g, '/')
  if (!r || r.includes('..') || r.includes('\0') || /[\n\r]/.test(r)) {
    throw new Error('path escapes workspace: plot')
  }
  if (!r.startsWith('data/compute/plots/') || r === 'data/compute/plots/') {
    throw new Error('path escapes workspace: plot')
  }
  if (!r.toLowerCase().endsWith('.png')) {
    throw new Error('path escapes workspace: plot')
  }
  const abs = assertInside(root, r)
  const plots = resolve(root, 'data/compute/plots')
  const relToPlots = relative(plots, abs)
  if (!relToPlots || relToPlots.startsWith('..') || relToPlots.includes(`..${sep}`)) {
    throw new Error('path escapes workspace: plot')
  }
  return abs
}

function genericMatplotlib(out) {
  const s = String(out)
  if (/(ModuleNotFoundError|ImportError):[^\n]*matplotlib/i.test(s)) return 'matplotlib unavailable'
  return s
}

function pythonWrap(code) {
  return `import os, sys, socket, subprocess
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('ALL_PROXY', None)
def _nonet(*_a, **_k):
    raise OSError('compute_run has no network')
socket.socket = _nonet
def _nobin(*_a, **_k):
    raise OSError('compute_run has no subprocess')
subprocess.Popen = _nobin
subprocess.call = _nobin
subprocess.run = _nobin
subprocess.check_output = _nobin
os.system = _nobin
os.popen = _nobin
for _n in ('execl','execle','execlp','execlpe','execv','execve','execvp','execvpe','spawnl','spawnle','spawnlp','spawnlpe','spawnv','spawnve','spawnvp','spawnvpe'):
    if hasattr(os, _n):
        setattr(os, _n, _nobin)
try:
    import urllib.request as _ur
    _ur.urlopen = _nonet
except Exception:
    pass
_PLOT_ABS = os.environ.get('HOMEAI_PLOT_ABS') or ''
_PLOT_REL = os.environ.get('HOMEAI_PLOT_REL') or ''
import builtins as _bi
_real_import = _bi.__import__
_IN_MPL = []
def _imp(name, globals=None, locals=None, fromlist=(), level=0):
    try:
        mod = _real_import(name, globals, locals, fromlist, level)
    except ImportError:
        nm = name if type(name) is str else ''
        if nm == 'matplotlib' or nm.startswith('matplotlib.'):
            raise ImportError('matplotlib unavailable')
        raise
    nm = name if type(name) is str else ''
    if (nm == 'matplotlib' or nm.startswith('matplotlib.')) and not _IN_MPL:
        _IN_MPL.append(1)
        try:
            import matplotlib as _mpl
            _mpl.use('Agg', force=True)
            import matplotlib.pyplot as _plt
            if not getattr(_plt, '_homeai_plot', False):
                _osf = _plt.savefig
                def _savefig(*aa, **kk):
                    if not _PLOT_ABS:
                        raise OSError('compute_run plot jail')
                    kk2 = dict(kk)
                    kk2.pop('fname', None)
                    aa2 = list(aa)
                    if aa2:
                        aa2[0] = _PLOT_ABS
                        return _osf(*aa2, **kk2)
                    return _osf(_PLOT_ABS, **kk2)
                _plt.savefig = _savefig
                _plt._homeai_plot = True
                import matplotlib.figure as _figmod
                if not getattr(_figmod.Figure, '_homeai_plot', False):
                    _fsave = _figmod.Figure.savefig
                    def _figsave(self, *aa, **kk):
                        if not _PLOT_ABS:
                            raise OSError('compute_run plot jail')
                        kk2 = dict(kk)
                        kk2.pop('fname', None)
                        aa2 = list(aa)
                        if aa2:
                            aa2[0] = _PLOT_ABS
                            return _fsave(self, *aa2, **kk2)
                        return _fsave(self, _PLOT_ABS, **kk2)
                    _figmod.Figure.savefig = _figsave
                    _figmod.Figure._homeai_plot = True
        except ImportError:
            raise ImportError('matplotlib unavailable')
        except Exception:
            pass
        finally:
            _IN_MPL.pop()
    return mod
_bi.__import__ = _imp
_WS = os.path.realpath(os.environ.get('HOMEAI_WS') or '')
_RUNS = os.path.realpath(os.getcwd())
_plot_dir = os.environ.get('HOMEAI_PLOT_DIR') or ''
if _plot_dir:
    _PLOTS = os.path.realpath(_plot_dir)
elif _WS:
    _PLOTS = os.path.realpath(os.path.join(_WS, 'data', 'compute', 'plots'))
else:
    _PLOTS = ''
def _norm_path(file):
    if isinstance(file, bytes):
        file = file.decode('utf-8', 'replace')
    if isinstance(file, int):
        return None
    if not isinstance(file, str):
        try:
            file = os.fspath(file)
        except Exception:
            return None
        if not isinstance(file, str):
            return None
    return os.path.realpath(file if os.path.isabs(file) else os.path.join(os.getcwd(), file))
def _secret_path(file):
    p = _norm_path(file)
    if not p or not _WS:
        return False
    sec = os.path.realpath(os.path.join(_WS, 'data', 'secrets'))
    return p == sec or p.startswith(sec + os.sep)
def _write_ok(file):
    p = _norm_path(file)
    if not p:
        return False
    if p == _RUNS or p.startswith(_RUNS + os.sep):
        return True
    if _PLOTS and (p == _PLOTS or p.startswith(_PLOTS + os.sep)):
        return True
    return False
def _is_write_mode(mode):
    if mode is None:
        return False
    if isinstance(mode, bytes):
        mode = mode.decode('ascii', 'replace')
    if not isinstance(mode, str):
        return False
    return any(c in mode for c in 'wax+')
def _take_open_mode(a, k):
    if 'mode' in k:
        return k['mode']
    if a and isinstance(a[0], (str, bytes)):
        return a[0]
    return 'r'
_real_open = _bi.open
def _open(file, *a, **k):
    if _secret_path(file):
        raise OSError('compute_run path jail')
    if _is_write_mode(_take_open_mode(a, k)) and not _write_ok(file):
        raise OSError('compute_run path jail')
    return _real_open(file, *a, **k)
_bi.open = _open
try:
    import io as _io
    _io.open = _open
except Exception:
    pass
_WRITE_FLAGS = 0
for _n in ('O_WRONLY', 'O_RDWR', 'O_APPEND', 'O_TRUNC', 'O_CREAT'):
    _WRITE_FLAGS |= int(getattr(os, _n, 0) or 0)
_real_os_open = os.open
def _os_open(path, flags, *rest, **k):
    if _secret_path(path):
        raise OSError('compute_run path jail')
    if (int(flags) & _WRITE_FLAGS) and not _write_ok(path):
        raise OSError('compute_run path jail')
    return _real_os_open(path, flags, *rest, **k)
os.open = _os_open
def _nochdir(*_a, **_k):
    raise OSError('compute_run path jail')
os.chdir = _nochdir
if hasattr(os, 'fchdir'):
    os.fchdir = _nochdir
def _jail_mkdir(path, *a, **k):
    if not _write_ok(path):
        raise OSError('compute_run path jail')
    return _real_mkdir(path, *a, **k)
_real_mkdir = os.mkdir
os.mkdir = _jail_mkdir
if hasattr(os, 'makedirs'):
    _real_makedirs = os.makedirs
    def _jail_makedirs(path, *a, **k):
        if not _write_ok(path):
            raise OSError('compute_run path jail')
        return _real_makedirs(path, *a, **k)
    os.makedirs = _jail_makedirs
_real_rename = os.rename
def _jail_rename(src, dst, *a, **k):
    if not _write_ok(src) or not _write_ok(dst):
        raise OSError('compute_run path jail')
    return _real_rename(src, dst, *a, **k)
os.rename = _jail_rename
if hasattr(os, 'replace'):
    _real_replace = os.replace
    def _jail_replace(src, dst, *a, **k):
        if not _write_ok(src) or not _write_ok(dst):
            raise OSError('compute_run path jail')
        return _real_replace(src, dst, *a, **k)
    os.replace = _jail_replace
try:
    from pathlib import Path as _Path
    _path_open = _Path.open
    def _popen(self, *a, **k):
        path = os.fspath(self)
        if _secret_path(path):
            raise OSError('compute_run path jail')
        mode = k.get('mode', a[0] if a and isinstance(a[0], (str, bytes)) else 'r')
        if _is_write_mode(mode) and not _write_ok(path):
            raise OSError('compute_run path jail')
        return _path_open(self, *a, **k)
    _Path.open = _popen
except Exception:
    pass
try:
    import shutil as _sh
    def _jail_shutil_pair(fn):
        def _wrapped(src, dst, *a, **k):
            if not _write_ok(src) or not _write_ok(dst):
                raise OSError('compute_run path jail')
            return fn(src, dst, *a, **k)
        return _wrapped
    for _n in ('copy', 'copy2', 'copyfile', 'move', 'copymode', 'copystat'):
        if hasattr(_sh, _n):
            setattr(_sh, _n, _jail_shutil_pair(getattr(_sh, _n)))
    if hasattr(_sh, 'copytree'):
        _real_copytree = _sh.copytree
        def _jail_copytree(src, dst, *a, **k):
            if not _write_ok(src) or not _write_ok(dst):
                raise OSError('compute_run path jail')
            return _real_copytree(src, dst, *a, **k)
        _sh.copytree = _jail_copytree
except Exception:
    pass
${code}
`
}

function nodeJailPrelude() {
  return `const _ws = process.env.HOMEAI_WS || ''
const _sec = _ws ? _homeaiPath.resolve(_ws, 'data', 'secrets') : ''
const _runs = _homeaiPath.resolve(process.cwd())
const _plots = process.env.HOMEAI_PLOT_DIR
  ? _homeaiPath.resolve(process.env.HOMEAI_PLOT_DIR)
  : (_ws ? _homeaiPath.resolve(_ws, 'data', 'compute', 'plots') : '')
function _normNode(p) {
  if (typeof p === 'number') return null
  return _homeaiPath.resolve(String(p))
}
function _secretNode(p) {
  const r = _normNode(p)
  if (!r || !_sec) return false
  return r === _sec || r.startsWith(_sec + _homeaiPath.sep)
}
function _writeOkNode(p) {
  const r = _normNode(p)
  if (!r) return false
  if (r === _runs || r.startsWith(_runs + _homeaiPath.sep)) return true
  if (_plots && (r === _plots || r.startsWith(_plots + _homeaiPath.sep))) return true
  return false
}
function _isWriteFlags(flags) {
  if (typeof flags === 'number') {
    const c = _homeaiFs.constants || {}
    const mask = (c.O_WRONLY || 1) | (c.O_RDWR || 2) | (c.O_APPEND || 1024) | (c.O_TRUNC || 512) | (c.O_CREAT || 64)
    return (flags & mask) !== 0
  }
  if (flags == null) return false
  return /[wax+]/i.test(String(flags))
}
function _jailNode(p, write) {
  if (typeof p === 'number') return p
  if (_secretNode(p) || (write && !_writeOkNode(p))) throw new Error('compute_run path jail')
  return p
}
function _patchFs(fs) {
  const _rfs = fs.readFileSync.bind(fs)
  const _wfs = fs.writeFileSync.bind(fs)
  const _rf = fs.readFile.bind(fs)
  const _wf = fs.writeFile.bind(fs)
  const _os = fs.openSync.bind(fs)
  const _mkdir = fs.mkdirSync.bind(fs)
  fs.readFileSync = (p, ...a) => _rfs(_jailNode(p, false), ...a)
  fs.writeFileSync = (p, ...a) => _wfs(_jailNode(p, true), ...a)
  fs.readFile = (p, ...a) => _rf(_jailNode(p, false), ...a)
  fs.writeFile = (p, ...a) => _wf(_jailNode(p, true), ...a)
  fs.openSync = (p, flags, ...a) => _os(_jailNode(p, _isWriteFlags(flags)), flags, ...a)
  fs.mkdirSync = (p, ...a) => _mkdir(_jailNode(p, true), ...a)
  if (fs.appendFileSync) {
    const _afs = fs.appendFileSync.bind(fs)
    fs.appendFileSync = (p, ...a) => _afs(_jailNode(p, true), ...a)
  }
  if (fs.copyFileSync) {
    const _cfs = fs.copyFileSync.bind(fs)
    fs.copyFileSync = (src, dest, ...a) => {
      _jailNode(src, true)
      return _cfs(src, _jailNode(dest, true), ...a)
    }
  }
  if (fs.renameSync) {
    const _rns = fs.renameSync.bind(fs)
    fs.renameSync = (src, dest, ...a) => {
      _jailNode(src, true)
      return _rns(src, _jailNode(dest, true), ...a)
    }
  }
  if (fs.promises) {
    const _prf = fs.promises.readFile.bind(fs.promises)
    const _pwf = fs.promises.writeFile.bind(fs.promises)
    fs.promises.readFile = (p, ...a) => _prf(_jailNode(p, false), ...a)
    fs.promises.writeFile = (p, ...a) => _pwf(_jailNode(p, true), ...a)
    if (fs.promises.appendFile) {
      const _paf = fs.promises.appendFile.bind(fs.promises)
      fs.promises.appendFile = (p, ...a) => _paf(_jailNode(p, true), ...a)
    }
    if (fs.promises.mkdir) {
      const _pmk = fs.promises.mkdir.bind(fs.promises)
      fs.promises.mkdir = (p, ...a) => _pmk(_jailNode(p, true), ...a)
    }
    if (fs.promises.copyFile) {
      const _pcf = fs.promises.copyFile.bind(fs.promises)
      fs.promises.copyFile = (src, dest, ...a) => {
        _jailNode(src, true)
        return _pcf(src, _jailNode(dest, true), ...a)
      }
    }
    if (fs.promises.rename) {
      const _prn = fs.promises.rename.bind(fs.promises)
      fs.promises.rename = (src, dest, ...a) => {
        _jailNode(src, true)
        return _prn(src, _jailNode(dest, true), ...a)
      }
    }
  }
}
`
}

function nodeShimSource() {
  return `import _homeaiFs from 'node:fs'
import _homeaiPath from 'node:path'
${nodeJailPrelude()}
_patchFs(_homeaiFs)
export default _homeaiFs
export const readFileSync = (...a) => _homeaiFs.readFileSync(...a)
export const writeFileSync = (...a) => _homeaiFs.writeFileSync(...a)
export const readFile = (...a) => _homeaiFs.readFile(...a)
export const writeFile = (...a) => _homeaiFs.writeFile(...a)
export const openSync = (...a) => _homeaiFs.openSync(...a)
export const mkdirSync = (...a) => _homeaiFs.mkdirSync(...a)
export const promises = _homeaiFs.promises
export const constants = _homeaiFs.constants
export const existsSync = (...a) => _homeaiFs.existsSync(...a)
`
}

function nodePromisesShimSource() {
  return `import fs from 'node:fs'
const p = fs.promises
export const readFile = (...a) => p.readFile(...a)
export const writeFile = (...a) => p.writeFile(...a)
export const appendFile = (...a) => p.appendFile(...a)
export const mkdir = (...a) => p.mkdir(...a)
export const copyFile = (...a) => p.copyFile(...a)
export const rename = (...a) => p.rename(...a)
export default { readFile, writeFile, appendFile, mkdir, copyFile, rename }
`
}

function nodeHookSource(id) {
  const shimName = `${safeComputeId(id, 'run')}-shim.mjs`
  const pshimName = `${safeComputeId(id, 'run')}-pshim.mjs`
  return `import { register } from 'node:module'
const SHIM = new URL(${JSON.stringify('./' + shimName)}, import.meta.url).href
const PSHIM = new URL(${JSON.stringify('./' + pshimName)}, import.meta.url).href
export async function resolve(specifier, context, nextResolve) {
  const parent = String(context.parentURL || '')
  const fromPshim = parent.includes('-pshim.mjs')
  const fromShim = parent.includes('-shim.mjs') && !fromPshim
  if (specifier === 'node:fs' || specifier === 'fs') {
    if (fromShim) return nextResolve('node:fs', context)
    return { url: SHIM, shortCircuit: true }
  }
  if (specifier === 'node:fs/promises' || specifier === 'fs/promises') {
    if (fromPshim || fromShim) return nextResolve('node:fs/promises', context)
    return { url: PSHIM, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
register(import.meta.url)
`
}

function nodeWrap(code) {
  return `import _homeaiFs from 'node:fs'
import _homeaiPath from 'node:path'
${nodeJailPrelude()}
_patchFs(_homeaiFs)
globalThis.fetch = () => { throw new Error('compute_run has no network') }
${code}
`
}

function spawnOnce(cmd, args, cwd, timeoutMs, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let timedOut = false
    const t = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.stdout?.on('data', (d) => {
      out += String(d)
      if (out.length > 40_000) out = out.slice(-20_000)
    })
    child.stderr?.on('data', (d) => {
      out += String(d)
    })
    child.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    child.on('close', () => {
      clearTimeout(t)
      if (timedOut) reject(new Error('timeout'))
      else resolve((out || '(exit)').slice(0, 20_000))
    })
  })
}

export async function runCompute(root, args) {
  const runtime = takeComputeRuntime(args && args.runtime)
  const code = takeComputeCode(args && args.code)
  if (!code) throw new Error('empty compute code')
  const timeoutMs = Math.min(30_000, Math.max(500, Number(args && args.timeoutMs) || DEFAULT_MS))
  const id = `c${Date.now().toString(36)}`
  const rel = computeScriptRel(id, runtime)
  const abs = assertInside(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  const body = runtime === 'node' ? nodeWrap(code) : pythonWrap(code)
  writeFileSync(abs, body, 'utf8')
  const cwd = dirname(abs)
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    LANG: process.env.LANG || 'C.UTF-8',
    HOME: cwd,
    PYTHONSAFEPATH: '1',
    HOMEAI_WS: resolve(root),
    HOMEAI_PLOT_DIR: resolve(root, 'data/compute/plots')
  }
  mkdirSync(env.HOMEAI_PLOT_DIR, { recursive: true })
  let plotRel = ''
  let plotAbs = ''
  let hookAbs = ''
  let shimAbs = ''
  let pshimAbs = ''
  if (runtime === 'python') {
    plotRel = computePlotRel(id)
    plotAbs = assertPlotInside(root, plotRel)
    mkdirSync(dirname(plotAbs), { recursive: true })
    const mplDir = join(cwd, 'mplconfig')
    mkdirSync(mplDir, { recursive: true })
    env.MPLBACKEND = 'Agg'
    env.MPLCONFIGDIR = mplDir
    env.HOMEAI_PLOT_ABS = plotAbs
    env.HOMEAI_PLOT_REL = plotRel
  }
  try {
    if (runtime === 'node') {
      hookAbs = assertInside(root, computeHookRel(id))
      shimAbs = assertInside(root, computeShimRel(id))
      pshimAbs = assertInside(root, computePromisesShimRel(id))
      writeFileSync(shimAbs, nodeShimSource(), 'utf8')
      writeFileSync(pshimAbs, nodePromisesShimSource(), 'utf8')
      writeFileSync(hookAbs, nodeHookSource(id), 'utf8')
      return await spawnOnce(process.execPath, ['--import', pathToFileURL(hookAbs).href, abs], cwd, timeoutMs, env)
    }
    let out = genericMatplotlib(await spawnOnce('python3', ['-I', '-B', abs], cwd, timeoutMs, env))
    if (plotAbs && existsSync(plotAbs)) {
      if (!String(out).includes(plotRel)) out = `${out}\n${plotRel}`.slice(0, 20_000)
    }
    return out
  } finally {
    for (const p of [abs, hookAbs, shimAbs, pshimAbs]) {
      if (!p) continue
      try {
        unlinkSync(p)
      } catch {
        /* leftover ok — keep png */
      }
    }
  }
}
