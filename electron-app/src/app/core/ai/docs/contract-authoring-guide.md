# Contract Authoring Guide

## Required Fields

Each `DialogContractV2` entry must define:

- `dialogId`
- `componentType`
- `family`
- `description`
- `operations`
- `params`
- `retrievalHints.keywords`
- `migration.parityStatus`

## Authoring Rules

- Reuse schema parameter semantics currently enforced by resolver validation.
- Keep operation IDs aligned with `OPERATION_REGISTRY`.
- Keep retrieval keywords concise and intent-focused.
- Link parity evidence path when status is complete.

## Adapter Expectations

A valid contract must adapt cleanly into:

- schema registry (`DialogSchema`)
- operation mapping (`mappedDialogs`)
- identity mapping (`dialogId -> componentType`)
- prompt contract serialization
