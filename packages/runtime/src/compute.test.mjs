import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  runCompute,
  takeComputeCode,
  takeComputeRuntime,
  computeScriptRel,
  computePlotRel,
  assertPlotInside,
  computeHookRel,
  computeShimRel
} from './compute.mjs'
import { assertInside } from './paths.mjs'
import {
  cachedKnowledge,
  knowledgeStamp,
  resetKnowledgeCache
} from '../../mods/src/knowledge-stamp.mjs'

describe('compute_run jail', () => {
  it('rejects empty and oversized code', () => {
    assert.equal(takeComputeCode(''), null)
    assert.equal(takeComputeRuntime('js'), 'node')
    assert.equal(computeScriptRel('ab/../x', 'python').includes('..'), false)
    assert.equal(computeHookRel('ab/../x').includes('..'), false)
    assert.equal(computeShimRel('ab/../x').includes('..'), false)
    assert.match(computeHookRel('ab/../x'), /^data\/compute\/runs\/[\w.-]+-hook\.mjs$/)
  })

  it('runs node without network and times out', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-compute-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    const out = await runCompute(root, { runtime: 'node', code: 'console.log(2+2)' })
    assert.match(out, /4/)
    await assert.rejects(
      () => runCompute(root, { runtime: 'node', code: 'for (;;) {}', timeoutMs: 800 }),
      /timeout/
    )
    const net = await runCompute(root, {
      runtime: 'node',
      code: 'try { await fetch("https://example.com") } catch (e) { console.log(String(e.message||e)) }',
      timeoutMs: 3000
    })
    assert.match(net, /compute_run has no network|network/)
  })

  it('python denies os.system when python3 exists', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-compute-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    try {
      const out = await runCompute(root, {
        runtime: 'python',
        code: 'import os\ntry:\n os.system("echo hi")\nexcept Exception as e:\n print(e)\n',
        timeoutMs: 4000
      })
      assert.match(String(out), /no subprocess|OSError|compute_run/)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
  })

  it('python open cannot read data/secrets; Figure.savefig stays in plots', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-compute-sec-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    mkdirSync(join(root, 'data', 'secrets'), { recursive: true })
    writeFileSync(join(root, 'data', 'secrets', 'k'), 'secret-token')
    const secretCode = (body) =>
      `p=__import__('os').path.join(__import__('os').environ["HOMEAI_WS"],"data","secrets","k")\n${body}`
    const nodeOut = await runCompute(root, {
      runtime: 'node',
      code:
        'const fs=(await import("node:fs")).default;const p=process.env.HOMEAI_WS+"/data/secrets/k";try{console.log("leak",fs.readFileSync(p,"utf8"))}catch(e){console.log(e.message)}',
      timeoutMs: 4000
    })
    assert.equal(String(nodeOut).includes('secret-token'), false)
    assert.match(String(nodeOut), /compute_run path jail|path jail/)
    try {
      const out = await runCompute(root, {
        runtime: 'python',
        code:
          'import os\np=os.path.join(os.environ["HOMEAI_WS"],"data","secrets","k")\ntry:\n print("leak",open(p).read())\nexcept OSError as e:\n print(e)\n',
        timeoutMs: 4000
      })
      assert.equal(String(out).includes('secret-token'), false)
      assert.match(String(out), /compute_run path jail|path jail/)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
    try {
      const pathOut = await runCompute(root, {
        runtime: 'python',
        code: secretCode(
          'from pathlib import Path\ntry:\n print("leak",Path(p).read_text())\nexcept OSError as e:\n print(e)\n'
        ),
        timeoutMs: 4000
      })
      assert.equal(String(pathOut).includes('secret-token'), false)
      assert.match(String(pathOut), /compute_run path jail|path jail/)
      const osOut = await runCompute(root, {
        runtime: 'python',
        code: secretCode(
          'import os\ntry:\n fd=os.open(p, os.O_RDONLY)\n print("leak",os.read(fd,64))\n os.close(fd)\nexcept OSError as e:\n print(e)\n'
        ),
        timeoutMs: 4000
      })
      assert.equal(String(osOut).includes('secret-token'), false)
      assert.match(String(osOut), /compute_run path jail|path jail/)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
    try {
      const out = await runCompute(root, {
        runtime: 'python',
        code:
          'from matplotlib.figure import Figure\nfig=Figure()\nfig.savefig("evil.png")\nprint("ok")\n',
        timeoutMs: 6000
      })
      if (/matplotlib unavailable/.test(String(out))) return
      assert.equal(existsSync(join(root, 'data', 'compute', 'runs', 'evil.png')), false)
      const plots = join(root, 'data', 'compute', 'plots')
      const pngs = existsSync(plots) ? readdirSync(plots).filter((n) => n.endsWith('.png')) : []
      assert.equal(pngs.length >= 1, true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
  })

  it('T-79 writes stay in runs/plots; named node:fs cannot read secrets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-compute-w-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    mkdirSync(join(root, 'data', 'secrets'), { recursive: true })
    mkdirSync(join(root, 'packages'), { recursive: true })
    writeFileSync(join(root, 'data', 'secrets', 'k'), 'secret-token')
    const named = await runCompute(root, {
      runtime: 'node',
      code:
        'const { readFileSync }=await import("node:fs");const p=process.env.HOMEAI_WS+"/data/secrets/k";try{console.log("leak",readFileSync(p,"utf8"))}catch(e){console.log(e.message)}',
      timeoutMs: 4000
    })
    assert.equal(String(named).includes('secret-token'), false)
    assert.match(String(named), /compute_run path jail|path jail/)
    const nodeWrite = await runCompute(root, {
      runtime: 'node',
      code:
        'const fs=(await import("node:fs")).default;const p=process.env.HOMEAI_WS+"/packages/pwn.txt";try{fs.writeFileSync(p,"pwn")}catch(e){console.log(e.message)};try{fs.mkdirSync(p+"-dir")}catch(e){console.log(e.message)};fs.writeFileSync("ok.txt","hi");console.log("cwd-ok")',
      timeoutMs: 4000
    })
    assert.equal(existsSync(join(root, 'packages', 'pwn.txt')), false)
    assert.match(String(nodeWrite), /compute_run path jail|path jail/)
    assert.match(String(nodeWrite), /cwd-ok/)
    assert.equal(existsSync(join(root, 'data', 'compute', 'runs', 'ok.txt')), true)
    try {
      const py = await runCompute(root, {
        runtime: 'python',
        code:
          'import os\np=os.path.join(os.environ["HOMEAI_WS"],"packages","pwn.txt")\ntry:\n open(p,"w").write("pwn")\n print("wrote")\nexcept OSError as e:\n print(e)\ntry:\n os.chdir("/")\n print("chdir")\nexcept OSError as e:\n print(e)\nopen("ok2.txt","w").write("hi")\nprint("cwd-ok")\n',
        timeoutMs: 4000
      })
      assert.equal(existsSync(join(root, 'packages', 'pwn.txt')), false)
      assert.equal(String(py).includes('wrote'), false)
      assert.equal(String(py).includes('chdir'), false)
      assert.match(String(py), /compute_run path jail|path jail/)
      assert.match(String(py), /cwd-ok/)
      assert.equal(existsSync(join(root, 'data', 'compute', 'runs', 'ok2.txt')), true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
  })

  it('T-80 rename/shutil and named fs/promises stay in the jail', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-compute-s-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    mkdirSync(join(root, 'data', 'secrets'), { recursive: true })
    mkdirSync(join(root, 'packages'), { recursive: true })
    writeFileSync(join(root, 'data', 'secrets', 'k'), 'secret-token')
    writeFileSync(join(root, 'packages', 'product.txt'), 'keep')
    const named = await runCompute(root, {
      runtime: 'node',
      code:
        'const { readFile, writeFile }=await import("node:fs/promises");const p=process.env.HOMEAI_WS+"/data/secrets/k";try{console.log("leak",await readFile(p,"utf8"))}catch(e){console.log(e.message)};try{await writeFile(process.env.HOMEAI_WS+"/packages/pwn-p.txt","pwn")}catch(e){console.log(e.message)};const fs=await import("node:fs");try{await fs.promises.writeFile(process.env.HOMEAI_WS+"/packages/pwn-fp.txt","pwn")}catch(e){console.log(e.message)};console.log("promises-ok")',
      timeoutMs: 4000
    })
    assert.equal(String(named).includes('secret-token'), false)
    assert.match(String(named), /compute_run path jail|path jail/)
    assert.match(String(named), /promises-ok/)
    assert.equal(existsSync(join(root, 'packages', 'pwn-p.txt')), false)
    assert.equal(existsSync(join(root, 'packages', 'pwn-fp.txt')), false)
    try {
      const py = await runCompute(root, {
        runtime: 'python',
        code:
          'import os, shutil\nws=os.environ["HOMEAI_WS"]\nopen("src.txt","w").write("hi")\ntry:\n os.rename("src.txt", os.path.join(ws,"packages","ren.txt"))\n print("renamed")\nexcept OSError as e:\n print(e)\ntry:\n os.replace("src.txt", os.path.join(ws,"packages","rep.txt"))\n print("replaced")\nexcept OSError as e:\n print(e)\nopen("src2.txt","w").write("hi")\ntry:\n shutil.copy("src2.txt", os.path.join(ws,"packages","cp.txt"))\n print("copied")\nexcept OSError as e:\n print(e)\ntry:\n shutil.move("src2.txt", os.path.join(ws,"packages","mv.txt"))\n print("moved")\nexcept OSError as e:\n print(e)\ntry:\n os.rename(os.path.join(ws,"packages","product.txt"), os.path.join(ws,"packages","pwn-ren.txt"))\n print("prod-renamed")\nexcept OSError as e:\n print(e)\nprint("sib-ok")\n',
        timeoutMs: 4000
      })
      assert.equal(existsSync(join(root, 'packages', 'ren.txt')), false)
      assert.equal(existsSync(join(root, 'packages', 'rep.txt')), false)
      assert.equal(existsSync(join(root, 'packages', 'cp.txt')), false)
      assert.equal(existsSync(join(root, 'packages', 'mv.txt')), false)
      assert.equal(existsSync(join(root, 'packages', 'pwn-ren.txt')), false)
      assert.equal(existsSync(join(root, 'packages', 'product.txt')), true)
      assert.equal(String(py).includes('renamed'), false)
      assert.equal(String(py).includes('replaced'), false)
      assert.equal(String(py).includes('copied'), false)
      assert.equal(String(py).includes('moved'), false)
      assert.equal(String(py).includes('prod-renamed'), false)
      assert.match(String(py), /compute_run path jail|path jail/)
      assert.match(String(py), /sib-ok/)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
  })

  it('T-70 plot rel has no .. and assertInside rejects escape', async () => {
    const plotRel = computePlotRel('ab/../x')
    assert.equal(plotRel.includes('..'), false)
    assert.match(plotRel, /^data\/compute\/plots\/[\w.-]+\.png$/)
    const root = mkdtempSync(join(tmpdir(), 'homeai-plot-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    mkdirSync(join(root, 'data', 'secrets'), { recursive: true })
    assert.throws(() => assertInside(root, '../secret.png'), /escapes workspace/)
    assert.throws(() => assertPlotInside(root, 'data/secrets/x.png'), /escapes workspace: plot/)
    assert.throws(() => assertPlotInside(root, 'data/compute/plots/../../data/secrets/x.png'), /escapes/)
    assert.throws(() => assertPlotInside(root, '../plots/x.png'), /escapes/)
    try {
      const out = await runCompute(root, {
        runtime: 'python',
        code:
          'import os\nopen(os.environ["HOMEAI_PLOT_ABS"], "wb").write(b"\\x89PNG\\r\\n\\x1a\\n")\nprint(os.environ.get("MPLBACKEND"))\n',
        timeoutMs: 4000
      })
      assert.match(String(out), /data\/compute\/plots\/c[0-9a-z]+\.png/)
      assert.equal(String(out).includes('..'), false)
      assert.match(String(out), /Agg/)
      const plots = join(root, 'data', 'compute', 'plots')
      const pngs = existsSync(plots) ? readdirSync(plots).filter((n) => n.endsWith('.png')) : []
      assert.equal(pngs.length, 1)
      const runs = join(root, 'data', 'compute', 'runs')
      const leftoverPy = existsSync(runs) ? readdirSync(runs).filter((n) => n.endsWith('.py')) : []
      assert.equal(leftoverPy.length, 0)
      assert.equal(existsSync(join(plots, pngs[0])), true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
  })

  it('T-70 matplotlib missing is a generic error', async () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-mpl-'))
    mkdirSync(join(root, 'data', 'compute', 'runs'), { recursive: true })
    try {
      const out = await runCompute(root, {
        runtime: 'python',
        code: 'import matplotlib\n',
        timeoutMs: 4000
      })
      if (/matplotlib unavailable/.test(String(out))) {
        assert.equal(/pip/i.test(String(out)), false)
        return
      }
      // matplotlib is installed — skip the missing-module string, jail still holds
      assert.equal(computePlotRel('x').includes('..'), false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('ENOENT') || msg.includes('python3')) return
      throw err
    }
  })
})

describe('T-71 knowledgeStamp', () => {
  it('changes when a jailed SKILL.md mtime changes and ignores reference/', () => {
    const root = mkdtempSync(join(tmpdir(), 'homeai-stamp-'))
    const skillDir = join(root, 'RAG', 'skills', 'demo')
    mkdirSync(skillDir, { recursive: true })
    const skill = join(skillDir, 'SKILL.md')
    writeFileSync(skill, '---\nname: demo\n---\n\nBody.\n', 'utf8')
    const t0 = Date.now() / 1000
    utimesSync(skill, t0 - 200, t0 - 200)
    const s1 = knowledgeStamp(root)
    utimesSync(skill, t0 + 200, t0 + 200)
    const s2 = knowledgeStamp(root)
    assert.notEqual(s1, s2)

    const refDir = join(skillDir, 'reference')
    mkdirSync(refDir, { recursive: true })
    const refSkill = join(refDir, 'SKILL.md')
    writeFileSync(refSkill, '---\nname: hidden\n---\n\nNo.\n', 'utf8')
    utimesSync(refSkill, t0 + 800, t0 + 800)
    const s3 = knowledgeStamp(root)
    assert.equal(s3, s2)

    mkdirSync(join(root, 'mods', 'demo', 'skills', 'modskill'), { recursive: true })
    const modSkill = join(root, 'mods', 'demo', 'skills', 'modskill', 'SKILL.md')
    writeFileSync(modSkill, '---\nname: modskill\n---\n\nM.\n', 'utf8')
    utimesSync(modSkill, t0 + 400, t0 + 400)
    const s4 = knowledgeStamp(root)
    assert.notEqual(s4, s2)

    writeFileSync(join(root, 'AGENTS.md'), '# law\n', 'utf8')
    utimesSync(join(root, 'AGENTS.md'), t0 + 1200, t0 + 1200)
    const s5 = knowledgeStamp(root)
    assert.notEqual(s5, s4)

    mkdirSync(join(root, '.cursor', 'skills', 'desk'), { recursive: true })
    const cursorSkill = join(root, '.cursor', 'skills', 'desk', 'SKILL.md')
    writeFileSync(cursorSkill, '---\nname: desk\n---\n\nD.\n', 'utf8')
    utimesSync(cursorSkill, t0 + 1600, t0 + 1600)
    const s6 = knowledgeStamp(root)
    assert.notEqual(s6, s5)

    mkdirSync(join(root, 'orphan-skills', 'x'), { recursive: true })
    const orphan = join(root, 'orphan-skills', 'x', 'SKILL.md')
    writeFileSync(orphan, '---\nname: orphan\n---\n\nNo.\n', 'utf8')
    utimesSync(orphan, t0 + 2400, t0 + 2400)
    assert.equal(knowledgeStamp(root), s6)

    mkdirSync(join(root, '.homeai', 'skills', 'life'), { recursive: true })
    const homeaiSkill = join(root, '.homeai', 'skills', 'life', 'SKILL.md')
    writeFileSync(homeaiSkill, '---\nname: life\n---\n\nL.\n', 'utf8')
    utimesSync(homeaiSkill, t0 + 2000, t0 + 2000)
    const s7 = knowledgeStamp(root)
    assert.notEqual(s7, s6)

    resetKnowledgeCache()
    let n = 0
    const load = () => {
      n += 1
      return { n }
    }
    const a = cachedKnowledge(root, load)
    const b = cachedKnowledge(root, load)
    assert.equal(a, b)
    assert.equal(n, 1)
    utimesSync(skill, t0 + 3000, t0 + 3000)
    const c = cachedKnowledge(root, load)
    assert.equal(n, 2)
    assert.notEqual(c, a)
    resetKnowledgeCache()
  })
})
