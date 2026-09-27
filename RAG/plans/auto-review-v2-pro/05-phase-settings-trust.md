# Phase 4 — Settings Trust screen

Depends on: `04` (mode must persist). Renderer is untrusted; sanitizers in main stay the source of truth.

## Goal

The human can select Auto Review and edit standing allow/block instructions. Save uses the existing IPC. No new channel.

## File

`apps/renderer/src/panes/SettingsPane.tsx`

### State

Next to `termList` / `netList`:

```
const [allowReview, setAllowReview] = useState('')
const [blockReview, setBlockReview] = useState('')
```

On `permissions()` load:

```
setAllowReview((file.autoReview?.allow_instructions ?? []).join('\n'))
setBlockReview((file.autoReview?.block_instructions ?? []).join('\n'))
```

After save, reset from the **returned** file (already sanitized). If `autoReview` omitted, both strings `''`.

### Approval `<select>`

Keep existing three options. Add:

```
<option value="auto-review">auto-review (judge, then reviewer, then you)</option>
```

`value={perms.approvalMode}` already works once core type includes `'auto-review'`.

### Copy

Keep chips: pending / allow / deny / file delete / `writes Ask · no Landlock`.

Add a muted paragraph under the extra-root textarea (plain text, no HTML injection of user strings):

> Auto-review: a deterministic Judge allows known-safe git/test/read argv. Unknown commands go to a classifier (risk / authorization / correctness) or Ask. Too-destructive never runs. Not a sandbox and not Landlock.

Do **not** say “AST”, “mvdan”, “82%”, “Landlock on”, or “sandbox”.

### Textareas (only useful in auto-review; still always visible so the mode is discoverable)

```
<label>Auto-review allow instructions (one line; never skips too-destructive)</label>
<textarea rows={3} value={allowReview} onChange=... />

<label>Auto-review block instructions (one line; forces Ask)</label>
<textarea rows={3} value={blockReview} onChange=... />
```

Placeholder-style helper in the muted `<p>`, not in the value.

Sanitize is **main-side** (`instructionList` drops `<>` and newlines). Renderer may still send junk; tests already cover `takeInstructionPair`.

### Save button

Existing `permissionsSet` spread:

```
{
  ...perms,
  terminalAllowlist: termList.split('\n'),
  netAllowlist: netList.split('\n'),
  mcpAllowlist: mcpList.split('\n'),
  fsExtraRoots: extraRoots.split('\n'),
  autoReview: {
    allow_instructions: allowReview.split('\n'),
    block_instructions: blockReview.split('\n')
  }
}
```

Empty lists: `takeInstructionPair` returns undefined/null and omits the key. That is OK.

Do **not** send `autoRun` unless already on `perms` (leave untouched).

No new IPC. Preload already has `permissionsSet`.

### Trust chip on this card

Optional: if `perms.approvalMode === 'auto-review'`, add a `set-chip` `auto-review · judge then you`. Text node only.

## IPC reminder

`homeai:permissions:set` (`index.ts` ~667) already `savePermissions(workspace, file)` → `takePermissionsPatch`. After clamp knows `auto-review`, round-trip works.

## Do not

- Add a second permissions file.
- Render instruction lines as HTML.
- Let the renderer “enable Landlock”.
- Auto-switch default mode.

## Done when

- Selecting auto-review + Save + reload Settings shows `auto-review` selected.
- Allow line `review me` round-trips; line `review\nme` or `<img>` is dropped (existing T in `policy.test.mjs`).
- Extra-root / unrestricted copy still says Ask · no Landlock.
