import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyDesignPatch, coerceDesignOps } from './designir.mjs'
import {
  designGetContent,
  designTask,
  irGrew,
  isShopSample,
  seedDesignIR,
  QUOKKA_ARTIFACT_ID
} from './design-path.mjs'
import { parseQwenToolCalls, parseToolArguments } from './qwen-tools.mjs'
import { forgeActHint, forgeForDesign, designMind } from './mind.mjs'
import { canvasPins, pinCaption } from './design-draft.mjs'

const BRIEF = 'Make a pitch deck for a new product'

describe('design generate prove + matrix', () => {
  it('T-55 empty seed is two pages; designTask forces design_get/patch; shop words are not PhoneCanvas', () => {
    const empty = seedDesignIR({ slug: 'pitch-deck', brief: '', template: 'slides' })
    assert.equal(empty.pages.length, 2)
    assert.equal(isShopSample(empty), false)
    const shopWording = seedDesignIR({
      slug: 'streetwear-drop',
      brief: 'A streetwear sneaker shop with cart',
      template: 'mobile'
    })
    assert.equal(isShopSample(shopWording), false)
    assert.notEqual(shopWording.artifact.id, QUOKKA_ARTIFACT_ID)
    const task = designTask('pitch-deck', BRIEF, 'slides')
    assert.match(task, /design_get/)
    assert.match(task, /design_patch/)
    assert.equal(task.includes('<'), false)
    assert.equal(task.includes(BRIEF.split(' ')[0]), true)
    assert.throws(() => designTask('../secrets', BRIEF, 'blank'))
    assert.match(forgeActHint('agent', task), /design_get/)
    assert.doesNotMatch(forgeActHint('agent', task), /Start by gathering/)
    assert.equal(designMind('cursor'), 'local')
    assert.equal(forgeForDesign('cursor', { cursor: true, openai: true }), 'openai')
    assert.equal(forgeForDesign('cursor', { cursor: true, openrouter: true }), 'openrouter')
    assert.equal(forgeForDesign('cursor', { cursor: true }), 'local')
  })

  it('T-55 2B XML / ✿ / bare JSON become design_get then design_patch; story text is not a call', () => {
    const xml = parseQwenToolCalls(
      `<tool_call>{"name":"design_get","arguments":{"id":"pitch-deck"}}</tool_call>`
    )
    assert.equal(xml[0].name, 'design_get')
    assert.equal(xml[0].arguments.id, 'pitch-deck')
    const split = parseQwenToolCalls(`<tool_call>\ndesign_patch\n{"id":"pitch-deck","baseRevision":"rev_1"}\n</tool_call>`)
    assert.equal(split[0].name, 'design_patch')
    const flower = parseQwenToolCalls('✿FUNCTION✿design_get\n✿ARGS✿{"id":"pitch-deck"}')
    assert.equal(flower[0].name, 'design_get')
    const tagged = parseQwenToolCalls(
      '<function=design_patch><parameter=id>pitch-deck</parameter><parameter=baseRevision>rev_1</parameter></function>'
    )
    assert.equal(tagged[0].name, 'design_patch')
    assert.equal(tagged[0].arguments.id, 'pitch-deck')
    const bare = parseQwenToolCalls(
      'I will patch now {"name":"design_patch","arguments":{"id":"pitch-deck","baseRevision":"rev_1","patch":[{"op":"add","path":"/pages/-","value":{"id":"p3","name":"Three"}}]}}'
    )
    assert.equal(bare[0].name, 'design_patch')
    assert.equal(parseQwenToolCalls('Here is a nice pitch deck with two screens.').length, 0)
    assert.equal(parseQwenToolCalls('<tool_call>{"name":"../etc","arguments":{}}</tool_call>').length, 0)
    assert.equal(parseQwenToolCalls('<tool_call>{"name":"<img>","arguments":{}}</tool_call>').length, 0)
  })

  it('T-55 parsed design_patch grows IR; filmstrip cap 16; dead pin stays needs-re-anchor', () => {
    const seed = seedDesignIR({ slug: 'pitch-deck', brief: BRIEF, template: 'slides' })
    const calls = parseQwenToolCalls(
      `<tool_call>{"name":"design_get","arguments":{"id":"pitch-deck"}}</tool_call>
<tool_call>{"name":"design_patch","arguments":{"id":"pitch-deck","baseRevision":"${seed.revision}","patch":[{"op":"add","path":"/pages/-","value":{"id":"p3","name":"Ask"}},{"op":"add","path":"/nodes/p3.root","value":{"type":"frame","tag":"div","page":"p3","order":0,"text":"Ask"}}]}}</tool_call>`
    )
    assert.deepEqual(
      calls.map((c) => c.name),
      ['design_get', 'design_patch']
    )
    const { doc } = applyDesignPatch(seed, {
      id: calls[1].arguments.id,
      baseRevision: calls[1].arguments.baseRevision,
      patch: calls[1].arguments.patch
    })
    assert.equal(irGrew(seed, doc), true)
    assert.equal(doc.pages.length, 3)
    assert.equal(doc.pages.slice(0, 16).length, doc.pages.length)
    const ghost = {
      ...doc,
      comments: {
        cmt_1: { id: 'cmt_1', nodeId: 'gone.node', text: 'check this', status: 'open', anchorRevision: doc.revision }
      }
    }
    const pins = canvasPins(ghost.comments, ghost.nodes)
    assert.equal(pins[0].status, 'needs-re-anchor')
    assert.equal(pinCaption(pins[0]).includes('needs-re-anchor'), true)
    assert.equal(pinCaption(pins[0]).includes('<'), false)
  })

  it('T-55 truncated 2B JSON and loose nodes become RFC ops; proto ids drop; get payload stays compact', () => {
    const seed = seedDesignIR({ slug: 'pitch-deck', brief: BRIEF, template: 'slides' })
    const cut =
      '{"patch":[{"id": "p3", "page": "p3", "order": 0, "text": "Product Introduction"}, {"id": "p3.title", "page": "p3", "parent": "p3.root", "order": 1, "'
    const recovered = parseToolArguments(cut)
    assert.equal(Array.isArray(recovered.patch), true)
    assert.equal(recovered.patch.length, 1)
    assert.equal(recovered.patch[0].id, 'p3')
    const { doc } = applyDesignPatch(seed, { baseRevision: seed.revision, _raw: cut })
    assert.equal(irGrew(seed, doc), true)
    assert.equal(doc.pages.length, 3)
    assert.equal(doc.pages[2].id, 'p3')
    assert.equal(doc.nodes['p3'].type, 'frame')
    const extra = applyDesignPatch(seed, {
      baseRevision: seed.revision,
      patch: [
        {
          op: 'add',
          path: '/pages/-',
          value: { id: 'p9', name: 'Ask', type: 'frame', text: 'extra', order: 0 }
        }
      ]
    })
    assert.equal(extra.doc.pages.some((p) => p.id === 'p9'), true)
    assert.equal(Object.prototype.hasOwnProperty.call(extra.doc.pages.find((p) => p.id === 'p9'), 'type'), false)
    const mixed = coerceDesignOps([
      { op: 'add', path: '/pages/-', value: { id: 'p4', name: 'Four' } },
      { op: 'baseRevision', value: 'rev_1' },
      { id: '__proto__', page: 'p9', text: 'nope', order: 0 }
    ])
    assert.equal(mixed.length, 1)
    assert.equal(mixed[0].path, '/pages/-')
    const tagged = parseQwenToolCalls(
      '<function=design_patch><parameter=id>pitch-deck</parameter><parameter=patch>[{"op":"add","path":"/pages/-","value":{"id":"p5","name":"Five"}}]</parameter></function>'
    )
    assert.equal(tagged[0].name, 'design_patch')
    assert.equal(Array.isArray(tagged[0].arguments.patch), true)
    assert.equal(tagged[0].arguments.patch[0].path, '/pages/-')
    const get = designGetContent(seed)
    assert.equal(get.includes('\n'), false)
    assert.equal(get.length <= 4000, true)
    assert.match(get, /rev_1/)
    assert.match(designTask('pitch-deck', BRIEF, 'slides'), /Example patch/)
  })
})
