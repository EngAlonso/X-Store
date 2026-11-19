---
name: API code generation runtime
description: Node compatibility required by Orval's Zod generator in this workspace.
---

Orval's Zod generator uses `Map.groupBy`, which is missing from this workspace's Node 20 runtime. A failed codegen run can clean the generated Zod output before stopping.

**Why:** the workspace's current Node runtime is older than the built-in feature expected by the installed Orval dependency.

**How to apply:** if codegen fails with `Map.groupBy is not a function`, rerun it with a temporary `NODE_OPTIONS=--require=...` polyfill or use Node 21+; verify generated API files are restored. Do not add a project dependency solely for this compatibility gap.
