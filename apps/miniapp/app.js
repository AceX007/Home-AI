/* HOME glass — same kernel, no markup injection */
(function () {
  const root = document.getElementById('app')
  if (!root) return

  const tg = window.Telegram && window.Telegram.WebApp
  if (tg) {
    try {
      tg.ready()
      tg.expand()
      if (tg.setHeaderColor) tg.setHeaderColor('#070709')
      if (tg.setBackgroundColor) tg.setBackgroundColor('#070709')
    } catch (_e) {
      /* desktop loopback */
    }
  }

  const MODES = ['ask', 'think', 'agent', 'plan', 'debug', 'multitask']
  const MINDS = [
    ['local', 'Local'],
    ['openai', 'OpenAI'],
    ['openrouter', 'Cloud'],
    ['cursor', 'Cursor']
  ]
  const SHEETS = [
    ['pulse', 'Pulse'],
    ['stack', 'Stack'],
    ['skills', 'Skills'],
    ['board', 'Board'],
    ['glance', 'Stage'],
    ['mind', 'Mind'],
    ['think', 'Think'],
    ['threads', 'Threads'],
    ['fleet', 'Fleet']
  ]

  const state = {
    mode: 'ask',
    mindId: 'local',
    healthLine: '',
    runId: '',
    sheet: 'pulse',
    pulse: 'HOME · IDLE\n────────────────\nThe kernel is on the desk.',
    stack: '',
    skills: '',
    board: '',
    glance: '',
    mind: '',
    think: '',
    threads: '',
    fleet: '',
    health: '',
    cursor: '',
    llama: '',
    fleetRepos: [],
    hold: false,
    ask: false,
    prompt: '',
    options: [],
    docs: [],
    threadRows: [],
    draft: ''
  }

  function el(name, cls, text) {
    const n = document.createElement(name)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function buzz(kind) {
    try {
      const h = tg && tg.HapticFeedback
      if (!h) return
      if (kind === 'ok' && h.notificationOccurred) h.notificationOccurred('success')
      else if (kind === 'hold' && h.notificationOccurred) h.notificationOccurred('warning')
      else if (h.impactOccurred) h.impactOccurred('medium')
    } catch (_e) {
      /* ignore */
    }
  }

  function initData() {
    return (tg && tg.initData) || ''
  }

  async function api(body) {
    const res = await fetch('/api', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-init-data': initData()
      },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(function () {
      return { error: 'bad json' }
    })
    if (!res.ok) throw new Error(json.error || 'denied')
    return json
  }

  function shipLabel() {
    if (state.mode === 'agent' || state.mode === 'debug' || state.mode === 'multitask') return 'Ship on PC'
    if (state.mode === 'think' || state.mode === 'plan') return 'Deep pass'
    return 'Ask'
  }

  function sheetText() {
    if (state.sheet === 'stack') return state.stack || 'Loading stack…'
    if (state.sheet === 'skills') return state.skills || 'Loading skills…'
    if (state.sheet === 'board') return state.board || 'Loading board…'
    if (state.sheet === 'glance') return state.glance || 'Loading stage…'
    if (state.sheet === 'health') return state.health || 'Loading health…'
    if (state.sheet === 'cursor') return state.cursor || 'Loading Cursor…'
    if (state.sheet === 'llama') return state.llama || 'Warming llama…'
    if (state.sheet === 'mind') return state.mind || 'Loading mind…'
    if (state.sheet === 'think') return state.think || 'Loading think…'
    if (state.sheet === 'threads') return state.threads || 'Loading threads…'
    if (state.sheet === 'fleet') return state.fleet || 'Loading fleet…'
    return state.pulse
  }

  let mainFn = null
  function bindMain() {
    if (!tg || !tg.MainButton) return
    const mb = tg.MainButton
    if (mainFn && mb.offClick) mb.offClick(mainFn)
    mainFn = function () {
      void send(state.mode)
    }
    mb.setText(shipLabel())
    mb.onClick(mainFn)
    mb.show()
  }

  function render() {
    root.replaceChildren()
    const brand = el('div', 'brand')
    const left = el('b', '', 'HOME')
    const right = el('span', '', state.hold ? 'HOLD' : state.ask ? 'ASK' : state.runId ? 'LIVE' : 'GLASS')
    if (state.hold || state.ask) right.className = 'hold'
    else if (state.runId) right.className = 'ok'
    brand.append(left, right)
    root.append(brand, el('div', 'rule'))
    root.append(el('h1', 'hero', state.sheet === 'glance' ? 'Stage on the desk.' : 'Command the desk.'))
    root.append(
      el(
        'p',
        'kicker',
        state.healthLine || 'Ship writes the tree. Deep pass thinks first. Drop lands in inbox. Same kernel.'
      )
    )

    const modes = el('div', 'modes')
    MODES.forEach(function (m) {
      const b = el('button', state.mode === m ? 'on' : '', m)
      b.addEventListener('click', function () {
        void setMode(m)
      })
      modes.append(b)
    })
    root.append(modes)

    const minds = el('div', 'modes')
    MINDS.forEach(function (pair) {
      const b = el('button', state.mindId === pair[0] ? 'on' : '', pair[1])
      b.addEventListener('click', function () {
        void setMind(pair[0])
      })
      minds.append(b)
    })
    root.append(minds)

    const box = el('div', 'composer')
    const ta = el('textarea')
    ta.rows = 4
    ta.placeholder = state.runId ? 'Steer the live job…' : 'What should the kernel do?'
    ta.maxLength = 8000
    ta.value = state.draft || ''
    ta.addEventListener('input', function () {
      state.draft = ta.value
    })
    box.addEventListener('dragover', function (e) {
      e.preventDefault()
    })
    box.addEventListener('drop', function (e) {
      e.preventDefault()
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) void dropFile(file)
    })
    const row = el('div', 'row')
    const ship = el('button', 'ship', shipLabel())
    ship.addEventListener('click', function () {
      void send(state.mode)
    })
    const halt = el('button', '', 'Halt')
    halt.addEventListener('click', function () {
      void stop()
    })
    row.append(ship, halt)
    const extra = el('div', 'row')
    const pin = el('button', '', 'Pin')
    pin.addEventListener('click', function () {
      void pinDraft()
    })
    const goal = el('button', '', 'Goal')
    goal.addEventListener('click', function () {
      void setGoal()
    })
    const neu = el('button', '', 'New')
    neu.addEventListener('click', function () {
      void newSession()
    })
    const drop = el('button', '', 'Drop')
    const file = el('input', 'hid')
    file.type = 'file'
    file.accept = '.jpg,.jpeg,.png,.webp,.gif,.txt,.md,.pdf,.ogg,.wav,.mp3,.webm,.m4a'
    file.addEventListener('change', function () {
      const f = file.files && file.files[0]
      if (f) void dropFile(f)
      file.value = ''
    })
    drop.addEventListener('click', function () {
      file.click()
    })
    extra.append(pin, goal, neu, drop, file)
    const desk = el('div', 'row')
    ;[
      ['health', 'Health'],
      ['cursor', 'Cursor'],
      ['llama', 'Llama']
    ].forEach(function (pair) {
      const b = el('button', '', pair[1])
      b.addEventListener('click', function () {
        void loadSheet(pair[0])
      })
      desk.append(b)
    })
    extra.append(desk)
    box.append(ta, row, extra)
    root.append(box)

    const dock = el('div', 'dock')
    SHEETS.forEach(function (pair) {
      const b = el('button', state.sheet === pair[0] ? 'on' : '', pair[1])
      b.addEventListener('click', function () {
        state.sheet = pair[0]
        if (pair[0] === 'stack') void loadSheet('stack')
        if (pair[0] === 'skills') void loadSheet('skills')
        if (pair[0] === 'board') void loadSheet('board')
        if (pair[0] === 'glance') void loadSheet('glance')
        if (pair[0] === 'mind') void loadSheet('mind')
        if (pair[0] === 'think') void loadThink()
        if (pair[0] === 'threads') void loadThreads()
        if (pair[0] === 'fleet') void loadSheet('fleet')
        render()
      })
      dock.append(b)
    })
    root.append(dock)

    const body = el('pre', 'pulse')
    body.textContent = sheetText()
    root.append(body)

    if ((state.sheet === 'think' || state.sheet === 'glance') && state.docs.length) {
      const list = el('div', 'chips')
      state.docs.forEach(function (d) {
        if (d.status !== 'ready' && d.status !== 'implementing') return
        const b = el('button', 'ship', 'Implement · ' + (d.title || 'plan'))
        b.addEventListener('click', function () {
          void implement(d.path)
        })
        list.append(b)
      })
      if (list.childNodes.length) root.append(list)
    }

    if (state.sheet === 'threads' && state.threadRows.length) {
      const list = el('div', 'chips')
      state.threadRows.forEach(function (t) {
        const b = el('button', '', t.title || t.id)
        b.addEventListener('click', function () {
          void useThread(t.id)
        })
        list.append(b)
      })
      root.append(list)
    }

    if (state.sheet === 'fleet') {
      const form = el('div', 'composer')
      const url = el('textarea')
      url.rows = 1
      url.placeholder = 'https://github.com/org/repo.git'
      url.maxLength = 200
      const fid = el('textarea')
      fid.rows = 1
      fid.placeholder = 'id  e.g. site-clone'
      fid.maxLength = 32
      const rel = el('textarea')
      rel.rows = 1
      rel.placeholder = 'Repos/existing-folder'
      rel.maxLength = 180
      const row = el('div', 'row')
      const cloneBtn = el('button', 'ship', 'Clone https')
      cloneBtn.addEventListener('click', function () {
        void fleetAct({ action: 'fleet-clone', url: url.value, id: fid.value })
      })
      const addBtn = el('button', '', 'Add repo')
      addBtn.addEventListener('click', function () {
        void fleetAct({ action: 'fleet-add', id: fid.value, rel: rel.value })
      })
      const subBtn = el('button', '', 'Subscribe')
      subBtn.addEventListener('click', function () {
        void fleetAct({ action: 'fleet-sub' })
      })
      row.append(cloneBtn, addBtn, subBtn)
      form.append(url, fid, rel, row)
      root.append(form)
      if (state.fleetRepos.length) {
        const chips = el('div', 'chips')
        state.fleetRepos.forEach(function (r) {
          if (!r || !r.id) return
          const b = el('button', '', (r.running ? 'Stop ' : 'Start ') + r.id)
          b.addEventListener('click', function () {
            void fleetAct({ action: r.running ? 'fleet-stop' : 'fleet-start', id: r.id })
          })
          chips.append(b)
          const rst = el('button', '', 'Restart ' + r.id)
          rst.addEventListener('click', function () {
            void fleetAct({ action: 'fleet-restart', id: r.id })
          })
          chips.append(rst)
        })
        if (chips.childNodes.length) root.append(chips)
      }
    }

    if (state.ask && state.options.length) {
      const chips = el('div', 'chips')
      state.options.forEach(function (opt, i) {
        const b = el('button', '', opt)
        b.addEventListener('click', function () {
          void answer(i)
        })
        chips.append(b)
      })
      root.append(chips)
    }

    if (state.hold) {
      const allow = el('div', 'row')
      const yes = el('button', 'ship', 'Allow')
      const no = el('button', '', 'Deny')
      yes.addEventListener('click', function () {
        void approve(true)
      })
      no.addEventListener('click', function () {
        void approve(false)
      })
      allow.append(yes, no)
      root.append(allow)
    }

    root.append(el('div', 'foot', 'PAIRED KERNEL · OFFLINE 2B · CURSOR CLOUD · EVERY MCP'))
    bindMain()
  }

  function healthLine(h) {
    if (!h || typeof h !== 'object') return ''
    const keys = []
    if (h.openai) keys.push('openai')
    if (h.openrouter) keys.push('openrouter')
    if (h.cursor) keys.push('cursor')
    return 'llama ' + String(h.llama || 'off') + ' · keys ' + (keys.join(' · ') || 'none')
  }

  async function setMode(mode) {
    try {
      const r = await api({ action: 'mode', mode: mode })
      if (r.mode) state.mode = r.mode
      else state.mode = mode
      if (r.card) state.pulse = r.card
      buzz('ok')
      render()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function setMind(provider) {
    try {
      const r = await api({ action: 'provider', provider: provider })
      if (r.provider) state.mindId = r.provider
      if (r.health) state.healthLine = healthLine(r.health)
      if (r.card) state.pulse = r.card
      buzz('ok')
      render()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function send(mode) {
    const task = String(state.draft || '').trim()
    if (!task) return
    if (state.runId) {
      try {
        const r = await api({ action: 'steer', runId: state.runId, text: task })
        state.draft = ''
        if (r.card) state.pulse = r.card
        state.sheet = 'pulse'
        buzz('ok')
        render()
      } catch (err) {
        state.pulse = String(err && err.message ? err.message : err)
        render()
      }
      return
    }
    try {
      const r = await api({ action: 'chat', task: task, mode: mode })
      state.runId = r.runId || ''
      state.pulse = r.card || state.pulse
      state.sheet = 'pulse'
      state.draft = ''
      buzz('ok')
      render()
      poll()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function stop() {
    if (!state.runId) return
    let ok = true
    if (tg && tg.showConfirm) {
      ok = await new Promise(function (resolve) {
        tg.showConfirm('Halt the live job?', resolve)
      })
    }
    if (!ok) return
    try {
      await api({ action: 'stop', runId: state.runId })
      state.pulse = 'HOME · IDLE\n────────────────\nHalted.'
      state.runId = ''
      state.hold = false
      state.ask = false
      render()
    } catch (_e) {
      /* ignore */
    }
  }

  async function approve(ok) {
    if (!state.runId) return
    try {
      await api({ action: 'approve', runId: state.runId, ok: ok })
      state.hold = false
      buzz(ok ? 'ok' : 'hold')
      render()
    } catch (_e) {
      /* ignore */
    }
  }

  async function answer(pick) {
    if (!state.runId) return
    try {
      await api({ action: 'answer', runId: state.runId, pick: pick })
      state.ask = false
      state.options = []
      buzz('ok')
      render()
    } catch (_e) {
      /* ignore */
    }
  }

  async function pinDraft() {
    const title = String(state.draft || '').trim()
    if (!title) return
    try {
      const r = await api({ action: 'pin', title: title })
      state.pulse = r.card || state.pulse
      state.sheet = 'pulse'
      render()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function setGoal() {
    try {
      const r = await api({ action: 'goal', text: String(state.draft || '').trim() })
      state.pulse = r.card || state.pulse
      state.sheet = 'pulse'
      render()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function newSession() {
    try {
      const r = await api({ action: 'new' })
      state.pulse = r.card || state.pulse
      state.sheet = 'pulse'
      buzz('ok')
      render()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function dropFile(file) {
    if (!file || file.size > 2_000_000) {
      state.pulse = 'HOME · FAULT\n────────────────\nDrop must be 2 MB or less.'
      state.sheet = 'pulse'
      render()
      return
    }
    const reader = new FileReader()
    reader.onload = function () {
      const data = String(reader.result || '').split(',')[1] || ''
      api({ action: 'inbox', name: file.name || 'drop.bin', data: data })
        .then(function (r) {
          state.pulse = r.card || state.pulse
          if (r.rel) state.draft = (state.draft ? state.draft + ' ' : '') + '@' + r.rel
          if (r.transcript) {
            const spoken = String(r.transcript).replace(/[<>]/g, '').slice(0, 800)
            if (spoken) state.draft = (state.draft ? state.draft + '\n' : '') + spoken
          }
          state.sheet = 'pulse'
          buzz('ok')
          render()
        })
        .catch(function (err) {
          state.pulse = String(err && err.message ? err.message : err)
          state.sheet = 'pulse'
          render()
        })
    }
    reader.readAsDataURL(file)
  }

  async function loadSheet(action) {
    try {
      const r = await api({ action: action })
      state.sheet = action
      if (action === 'glance') {
        const phases = typeof r.phases === 'string' ? String(r.phases).replace(/[<>]/g, '').slice(0, 80) : ''
        state.glance = (phases ? phases + '\n' : '') + (r.card || '')
        if (r.hold === true) {
          state.hold = true
          if (r.runId) state.runId = r.runId
        }
      } else {
        state[action] = r.card || ''
      }
      if (r.health) state.healthLine = healthLine(r.health)
      if (Array.isArray(r.docs)) state.docs = r.docs
      if (action === 'fleet' && Array.isArray(r.repos)) state.fleetRepos = r.repos
      render()
    } catch (err) {
      state[action] = String(err && err.message ? err.message : err)
      state.sheet = action
      render()
    }
  }

  async function fleetAct(body) {
    try {
      const r = await api(body)
      state.fleet = r.card || state.fleet
      if (Array.isArray(r.repos)) state.fleetRepos = r.repos
      state.sheet = 'fleet'
      buzz('ok')
      render()
    } catch (err) {
      state.fleet = String(err && err.message ? err.message : err)
      state.sheet = 'fleet'
      render()
    }
  }

  async function loadThink() {
    try {
      const r = await api({ action: 'think' })
      state.think = r.card || ''
      state.docs = Array.isArray(r.docs) ? r.docs : []
      render()
    } catch (err) {
      state.think = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function loadThreads() {
    try {
      const r = await api({ action: 'threads' })
      state.threads = r.card || ''
      state.threadRows = Array.isArray(r.threads) ? r.threads : []
      render()
    } catch (err) {
      state.threads = String(err && err.message ? err.message : err)
      render()
    }
  }

  async function implement(path) {
    try {
      const r = await api({ action: 'implement', path: path })
      state.runId = r.runId || ''
      state.pulse = r.card || state.pulse
      state.sheet = 'pulse'
      buzz('ok')
      render()
      poll()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      state.sheet = 'pulse'
      render()
    }
  }

  async function useThread(id) {
    try {
      const r = await api({ action: 'use', threadId: id })
      state.pulse = r.card || state.pulse
      state.sheet = 'pulse'
      render()
    } catch (err) {
      state.pulse = String(err && err.message ? err.message : err)
      render()
    }
  }

  let timer = 0
  function poll() {
    if (timer) clearInterval(timer)
    timer = setInterval(function () {
      if (!state.runId) {
        clearInterval(timer)
        return
      }
      api({ action: 'pulse', runId: state.runId })
        .then(function (r) {
          state.pulse = r.card || state.pulse
          const wasHold = state.hold
          const wasAsk = state.ask
          state.hold = r.hold === true
          state.ask = r.ask === true
          state.prompt = r.prompt || ''
          state.options = Array.isArray(r.options) ? r.options : []
          if (state.hold && !wasHold) buzz('hold')
          if (state.ask && !wasAsk) buzz('hold')
          if (r.done) {
            state.runId = ''
            state.hold = false
            state.ask = false
            buzz('ok')
            clearInterval(timer)
          }
          render()
        })
        .catch(function () {
          /* keep last card */
        })
    }, 800)
  }

  api({ action: 'session' })
    .then(function (r) {
      if (r.mode) state.mode = r.mode
      if (r.provider) state.mindId = r.provider
      if (r.health) state.healthLine = healthLine(r.health)
      if (r.card) state.pulse = r.card
      render()
    })
    .catch(function (err) {
      state.pulse = String(err && err.message ? err.message : 'Pair this Telegram account first.')
      render()
    })

  render()
})()
