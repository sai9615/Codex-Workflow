# Compact execution context

One machine-checkable JSON entry point per execution. It carries exactly what a worker or reviewer needs — task, criteria, identities, risk, authority, budget and evidence pointers — while history, conversation and prior verdicts stay outside routine prompts. Validate it with `scripts/context-check.mjs` before dispatch; a context that fails validation blocks the work it describes.

## Format

```json
{
  "version": 1,
  "taskId": "NW020-K2",
  "criteria": ["acceptance pointer 1", "acceptance pointer 2"],
  "baseline": { "head": "<40-hex commit>", "manifestSha256": "<64-hex baseline manifest>" },
  "candidateSha256": "<64-hex manifest of the exact candidate bytes>",
  "risk": "low|normal|high",
  "complexity": "simple|normal|complex",
  "authority": {
    "approvedBy": "user decision reference",
    "scope": "what is authorized",
    "maxUsd": "8",
    "expiresAt": "ISO-8601 expiry"
  },
  "evidence": ["path/to/task-package.md", "path/to/raw-results.json"],
  "budget": { "maxRequests": 4, "maxOutputTokens": 8192, "timeoutMs": 60000 }
}
```

## Rules

1. Validate before every dispatch: `node scripts/context-check.mjs --context ctx.json`. Exit 2 with a coded error blocks; there is no warning mode.
2. Stale identities block conclusions: when a candidate manifest is available, pass `--manifest FILE`; a hash mismatch exits `E_STALE`. Do not patch a context to match drifted bytes — regenerate it from the actual state and record why.
3. Expired authority blocks: `authority.expiresAt` must be in the future at validation time (`E_EXPIRED`). An expired context is renewed only by a fresh user/coordinator decision, not by editing the date.
4. Extra keys are rejected: the entry point is deliberately closed. Add content by updating this contract and the validator together, never by smuggling fields.
5. Keep it compact: pointers, not payloads. Essential source remains inspectable through the evidence and baseline/candidate identities; routine prompts embed only what the current role needs.
6. One context per execution scope: corrections get an updated context (new candidate hash, extended evidence), preserving the old one as evidence.
