# Concise worker results

Every worker reply to the coordinator follows one contract, validated by `scripts/worker-result-check.mjs`. The goal: the coordinator can verify exact artifacts and risk-appropriate evidence with a concise result. Schema validation checks the supplied structure and verdict consistency; it cannot prove artifact bytes, evidence existence or actual test execution. The coordinator verifies those separately.

## Contract

```json
{
  "version": 1,
  "taskId": "NW020-K4",
  "role": "development|testing|review|debugging|correction",
  "verdict": "pass|fail|blocked",
  "artifacts": [{ "path": "scripts/x.mjs", "sha256": "<64-hex of exact bytes>" }],
  "tests": { "executed": 13, "passed": 13, "failed": 0, "evidence": "path/to/raw-output.txt" },
  "usage": { "inputTokens": 100, "outputTokens": 50, "estimatedUsd": "0.005" },
  "findings": [{ "id": "F-1", "severity": "critical|major|minor|note", "location": "file:line", "summary": "what and why" }],
  "blockers": ["exact blocker"]
}
```

## Rules

1. Validate every result: `node scripts/worker-result-check.mjs --result FILE`. Exit 2 blocks; there is no warning mode.
2. Evidence-gated verdicts: `pass` requires at least one hashed artifact and one executed test with an evidence pointer, zero failed tests, no blockers and no critical/major/minor findings (only nonblocking notes are allowed); `fail` requires findings; `blocked` requires blockers. Missing support is `E_EVIDENCE` — the verdict is void, not downgraded.
3. Hashes identify exact bytes: the coordinator re-hashes applied artifacts before trusting them. A path without a matching hash is unverified content.
4. Incremental usage only: per-reply input/output tokens and estimated cost; `usage: null` means unknown and is never read as zero. Cached/reasoning subsets stay out of these totals (see journal accounting).
5. Findings are actionable: stable id, severity, exact location, summary. "Looks good" is not a finding; absence of findings under `pass` still requires rule 2 evidence.
6. Extra keys are rejected: extend this contract and the validator together.
