# Submission and release readiness

The public release repository is [dcftradingcrypt/feed-research-memory](https://github.com/dcftradingcrypt/feed-research-memory). A GHCR OCI CLI release is prepared at `ghcr.io/dcftradingcrypt/feed-research-memory:0.1.0`; actual image publication, public visibility and digest-bound GitHub build-attestation verification remain pending. The registry submission will use manual Docker installation only after those steps produce verifiable evidence. Equivalent-registry eligibility remains a committee decision. npm publication is separate and pending. No bounty acceptance, award or reward receipt is claimed.

The named maintainer, **dcftradingcrypt**, commits to **at least six months of support after the approved OriginTrail integration-registry PR is merged**. The intended registry install kind is `cli`, memory layer `WM`, public interface `http-api`, and contributor trust tier `community`.

## Concrete outstanding gates

| Gate | Required evidence/action before submission |
| --- | --- |
| Repository ownership | Public `dcftradingcrypt/feed-research-memory` exists. Manifest repository, homepage and issue-tracker metadata now use its confirmed URL. Upload the approved source tree and pin its actual full commit before release. |
| Package ownership/access | Publish the GHCR image from this repository with its workflow token; confirm owner control, package linkage, public visibility and independent digest-pinned pull. An npm name claim is not required for this OCI route and has not been established. |
| Maintainer and support | Confirmed maintainer `dcftradingcrypt`; support is committed for at least six months after approved registry merge. Include that exact commitment in the submission. |
| Local-node evidence | Complete: 20 unit tests and the real local DKG 10.0.24 HTTP/WM-store integration passed; independent acceptance used 20 selected entries from the actual Node.js blog feed. See `VERIFICATION.md` for topology and mock-chain/transport-harness boundaries. |
| Working demo | Complete: `demo/session.cast` and self-contained `demo/replay.html` record 13 actual CLI commands, including research notes, cited packets, corrected-source recall and reversion. The benchmark feed is explicitly fictional. |
| Package/release review | A local production audit on 2026-10-17 passed with zero advisories for the current lock (`saxes@6.0.0`, `xmlchars@2.2.0`). Recheck at release; inspect the final packed files, licence and CLI execution, and resolve or explicitly triage any new advisories. Include the security declaration in the release or a pinned public source link. |
| Publication and provenance | Publish the reviewed GHCR version from its exact public version-tag commit, then verify the image digest and official GitHub build attestation stored in the OCI registry. Record the release run, digest and commit. `container.yml` is prepared only; no successful image or provenance verification is yet claimed. |
| Registry entry | Add one entry to `OriginTrail/dkg-integrations` using its current schema: real maintainer, public repo, full 40-character commit, exact published GHCR version/digest, manual CLI installation, `Apache-2.0`, accurate primitives, WM/public-HTTP declarations and security posture. Use working pinned design/demo/container URLs. Do not describe OCI publication as npm publication or guarantee equivalent-registry acceptance. |
| Attestations | The actual contributor must confirm ownership/proper licensing and absence of intentional backdoors, and accept the program terms. Do not fabricate these on their behalf. |
| Current round | Refresh the official status, scope, competition and pool information at submission time. Label the PR `cfi-dkgv10-r1` as required. No reserved reward or guaranteed acceptance is claimed. |

## Prepared workflows

`.github/workflows/ci.yml` installs the locked dependency with scripts disabled, runs the unit suite on Node 22.13.0 and 24, and checks the pack list. It does not start a DKG node. Provision an isolated local node separately for `npm run test:integration`, setting `DKG_API_URL` and `DKG_AUTH_TOKEN_FILE` to its endpoint and a private UTF-8 bearer-token file (not the node's encrypted token file). A trusted runner may resolve this through the official authentication interface without logging it. This test leaves its new Context Graph/WM data in the test node.

`.github/workflows/container.yml` is the selected prepared release path. It supports version-tag pushes and manual invocation using that same tag as both workflow ref and input. It checks exact source/tag/version identity, runs unit tests and a dependency audit, builds one nonroot Node 24 `linux/amd64` image, and parses the real CLI help from `docker run --network none`. Only then does it push the tested image using `GITHUB_TOKEN` with `packages:write`, create a digest-bound official GitHub build attestation stored in GHCR, and verify that bundle against the source commit/ref/workflow. The owner must independently confirm public visibility, digest-pinned installation and provenance. [CONTAINER.md](CONTAINER.md) supplies the exact commands and host-node networking caveat. No new account/login, reusable package token, local image build or publication was performed to prepare these files.

## Dormant npm fallback

`.github/workflows/publish.yml` is **manual only** (`workflow_dispatch`), taking an existing release tag such as `v0.1.0`. Invoke the workflow from that same tag, not from a different branch: the workflow ref, event commit, checkout and package version must agree. Preflight also requires the confirmed public repository and matching manifest repository URL. It then installs, tests, checks production advisories and invokes `npm publish --provenance --access public`. None of those future publishing steps has been executed by preparing this workflow.

Publishing setup remains owner work. Configure the npm trusted publisher as GitHub owner `dcftradingcrypt`, repository `feed-research-memory`, workflow filename `publish.yml`, with direct `npm publish` explicitly allowed. This workflow requires GitHub-hosted runners, npm ≥11.5.1 and Node ≥22.14.0; it uses Node 24, OIDC (`id-token:write`) and no stored npm token. The workflow does not prove that npm-side configuration exists or that a publish will succeed. A newly configured trusted publisher must complete its first successful publication within two days.

References checked 2026-10-17: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) and [npm provenance](https://docs.npmjs.com/generating-provenance-statements/). Recheck them when performing the actual release.

## Contingent npm package setup

This section is a dormant alternative, not a prerequisite for GHCR. The connected release environment returned `ENEEDAUTH` from `npm whoami`; an authenticated npm owner identity is not yet available. No additional npm authentication, staging or publishing is authorized by this document. If the owner later resumes a legitimate npm setup, it requires a free npm account with verified contact details, interactive login and account 2FA for package publication/settings. The npm username need not match the GitHub maintainer handle. Do not paste passwords, recovery codes, one-time codes or reusable tokens into this repository.

The current [`npm trust` documentation](https://docs.npmjs.com/cli/v11/commands/npm-trust/) requires that the package already exist, the caller have write access and account 2FA be enabled. The management command requires npm ≥11.15.0. OIDC alone does not establish ownership of a new name.

The [staged-publication guide](https://docs.npmjs.com/staged-publishing/) permits staging a new name: npm creates a public `0.0.0-stage` placeholder, while the staged contents remain withheld until 2FA approval. This is an actual registry write. A possible bootstrap is to stage a distinct temporary prerelease such as `0.0.0-bootstrap`, retain it pending while verifying package ownership and configuring OIDC, then publish final `0.1.0` from CI. Pending stages do not block direct publication of a different version under the [npm stage contract](https://docs.npmjs.com/cli/v11/commands/npm-stage/). Reject the unused temporary stage only after a real provenance-bearing release exists. Trust configuration on a placeholder-only package is still unverified; check that actual registry gate before advancing. No staging or authentication attempt was made by preparing this sequence.

A documented fallback is an authenticated local `0.1.0` bootstrap using explicit `--provenance=false`, followed by trusted-publisher setup and a new provenance-bearing `0.1.1` release. The bootstrap alone is not the bounty artifact. Published versions cannot be overwritten; do not claim provenance on the initial local publication. No fallback publication has been performed.

After ownership exists, the exact management command is:

```sh
npm trust github feed-research-memory \
  --repo dcftradingcrypt/feed-research-memory \
  --file publish.yml --allow-publish --yes
```

This performs a registry configuration write and requires the owner's interactive authentication/2FA. It is a release instruction, not a command already run. Official account/publication reference: [creating and publishing public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/).

## Local source staging plan

The release operator controls git/upload. Stage only the project-owned source, fixtures, demonstrations and workflow files; the sibling `runtime`, upstream `dkg` and private proof-node homes stay outside this repository.

```sh
git add -- .gitignore .dockerignore .github Dockerfile package.json package-lock.json \
  README.md DESIGN.md SECURITY.md VERIFICATION.md SUBMISSION.md CONTAINER.md LICENSE \
  src test scripts demo
git diff --cached --check
git diff --cached --stat
```

Inspect the staged file list and use the contributor's real git identity. Exclude `node_modules`, tarballs and local credential/evidence directories. Preserve existing remote history. Tag only the reviewed source commit that matches the selected package version. The release operator controls all git staging, commits, pushes, tags and publication; this document does not perform them.

## Scope and award qualification

The [official Round1 call](https://github.com/OriginTrail/dkg/blob/7210ccda86ab845ec3161957ed42d2b5c5e02489/docs/active-now/dkg-v10-bounty.md) explicitly welcomes agent-tagged RSS inboxes. Eligibility requires both real WM/SWM use and an LLM-Wiki/autoresearch workflow; the documented design addresses both through source revisions and agent research packets. The selected implementation is WM-only, so it does not depend on sealing, SHARE, VM publication, a funded wallet or a paid model. The proposed future promotion path is documentation, not an implemented feature.

Open registry PR #6 already covers arXiv paper ingestion with provenance and tags. This proposal's distinction is local RSS/Atom revision tracking, annotation of exact versions and cited research continuity. That is a scope rationale, not a committee ruling or a promise of uniqueness. A public repository should link the final implementation and evidence rather than assert adoption that has not occurred.

The call lists a 50,000 TRAC Round1 cap and experimental awards of 1,000–3,000 TRAC, with other tiers up to 10,000 TRAC. Awards are discretionary committee decisions and disbursed after approved registry merge; an opened PR or passing CI is not an amount owed. Remaining pool balance has not been established. Payout network/identity details must be handled separately if accepted, without including keys or credentials in this repository.
