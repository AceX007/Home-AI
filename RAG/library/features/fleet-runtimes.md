---
id: feat-fleet-runtimes
---
# Fleet runtimes

- **Works:** Fleet activity starts/stops/restarts jailed stacks. Telegram stacks and websites nest local clones under each repo (and under each bot’s `repoId`). Website hostname is a label via `takeSiteDomain` (Save domain). Clone https or add an existing folder from the pane, `/fleet`, `/fleet fork`, or Mini App `fleet-fork`. Bot tokens stay in `data/secrets/fleet/` (PC pane only). Announce + AI-drafted broadcasts go to an explicit subscriber list. Email uses Proton Bridge or Tuta SMTP hosts only.
- **Made:** [`fleet.mjs`](../../../packages/runtime/src/fleet.mjs) [`fleet-host.ts`](../../../apps/desktop/src/main/fleet-host.ts) [`FleetPane.tsx`](../../../apps/renderer/src/panes/FleetPane.tsx) `takeFleetCommand` + Telegram `/fleet` + Mini App Fleet sheet + `homeai:fleet:cloneLocal` / `patchRepo` + `kindFromAddRel` / `defaultRecipeForKind`
- **Recipe:** [fleet-runtimes](../../recipes/fleet-runtimes.md)
- **Tests:** T-73 T-84 T-94
- **Edges:** E-66 E-67 E-77 E-78 E-86 E-87 · AP-20260904-55 AP-20260904-67 AP-20260904-80 AP-20260904-81
