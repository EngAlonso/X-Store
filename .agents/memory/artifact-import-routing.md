---
name: Artifact import routing
description: How Replit routes previews for imported artifacts and their managed workflows.
---

Keep a registered artifact's `.replit-artifact/artifact.toml` under its canonical `artifacts/<slug>/` path. Restoring source packages alone is not enough: the managed workflow can start while the preview router still returns “no previewable artifacts.” When relocating an existing artifact, preserve its ID and service port, update the development command for the new working directory, stop the stale workflow, then restart and verify the canonical one.

**Why:** The preview proxy depends on registered artifact metadata at the canonical path; a running server does not guarantee that the artifact is routable.

**How to apply:** During an import from `.migration-backup`, restore packages into the root workspace, move rather than duplicate the existing artifact metadata, adjust its run command, then confirm both the preview page and API health endpoint.
