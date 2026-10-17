# Container CLI installation and release

The prepared OCI package is `ghcr.io/dcftradingcrypt/feed-research-memory:0.1.0`. This document does not yet establish that it has been published, made public or verified. Record the successful release run, exact image digest and source commit before using it in a registry submission. OCI distribution is separate from npm publication; whether this package satisfies the bounty's equivalent-registry requirement is the committee's decision.

The image runs the one-shot CLI as the unprivileged `node:node` user on Node.js 24. The release workflow currently targets `linux/amd64`; other architectures are not claimed. It does not contain or start a DKG daemon. The application payload is the source CLI, package/lock metadata, Apache licence and locked production dependencies. The allowlisted build context excludes local credentials, node homes, tests, demo captures and the outside-package daemon harness. Dependency lifecycle scripts are disabled during the image build.

## Pull, verify and run

After a successful public release, obtain the actual `sha256:...` image digest and full source commit from that run's summary. Set these variables to the recorded values; the placeholders below are not usable digests.

```sh
IMAGE='ghcr.io/dcftradingcrypt/feed-research-memory@sha256:<recorded-image-digest-hex>'
SOURCE_COMMIT='<recorded-40-character-source-commit>'

gh attestation verify "oci://$IMAGE" \
  --repo dcftradingcrypt/feed-research-memory \
  --signer-workflow dcftradingcrypt/feed-research-memory/.github/workflows/container.yml \
  --source-ref refs/tags/v0.1.0 --source-digest "$SOURCE_COMMIT" \
  --signer-digest "$SOURCE_COMMIT" --deny-self-hosted-runners \
  --bundle-from-oci --format json

docker pull "$IMAGE"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges "$IMAGE" --help
```

Use a current GitHub CLI with artifact-attestation support. Its documented OCI verification flow requires registry authentication; use an already authorized local GitHub/registry session when needed. Anonymous pulling of a public image and authenticated provenance verification are different operations. No reusable registry token is provided by this project. Verification checks the expected repository, workflow, version ref, commit and artifact digest; it does not certify research conclusions or committee acceptance.

For actual research commands, provision a DKG node and its bearer token separately. Container loopback is normally the container itself. On **Linux Docker Engine**, `--network host` lets the CLI reach a host node bound to `127.0.0.1`; it shares the host network namespace and is not the network-disabled help check above. Docker Desktop host networking requires its supported opt-in setting. Otherwise use a DKG HTTP origin reachable from the container under the operator's existing access policy; do not assume a host's `127.0.0.1` is reachable through ordinary bridge networking. The CLI accepts an origin, without a path prefix or embedded credentials.

The following Linux example assumes `DKG_API_URL` and `DKG_AUTH_TOKEN` are already set in the operator's shell. It forwards the variable names, without putting token values in this document or command history. Docker administrators can inspect container environment variables, so use a trusted local Docker host. The feed directory must be readable by container UID 1000.

```sh
# DKG_API_URL is the provisioned node's origin, for example http://127.0.0.1:9200.
# DKG_AUTH_TOKEN is supplied privately by the node operator.
docker run --rm --network host --read-only --cap-drop ALL \
  --security-opt no-new-privileges --env DKG_API_URL --env DKG_AUTH_TOKEN \
  "$IMAGE" create-graph research-inbox

docker run --rm --network host --read-only --cap-drop ALL \
  --security-opt no-new-privileges --env DKG_API_URL --env DKG_AUTH_TOKEN \
  --mount "type=bind,src=$PWD/feeds,dst=/feeds,readonly" \
  "$IMAGE" import /feeds/research.atom \
  --source https://example.org/research.atom --graph research-inbox

docker run --rm --network host --read-only --cap-drop ALL \
  --security-opt no-new-privileges --env DKG_API_URL --env DKG_AUTH_TOKEN \
  "$IMAGE" inbox --graph research-inbox
```

The example feed URL is an identifier, not an endpoint the CLI fetches. Supply the real canonical feed URL for actual data. Follow the annotation, packet and recall commands in [README.md](README.md), placing those arguments after `"$IMAGE"`. Every invocation exits after the command. No ports, writable host directories, wallet files, background jobs or paid model accounts are required.

## Release operator procedure

1. Review and push the exact source commit, including this workflow. Create `v0.1.0` only at the commit whose manifest version is `0.1.0`; do not move a released tag or overwrite an already distributed version. Tag pushes trigger `.github/workflows/container.yml`. For a manual retry, select that same tag as both workflow ref and `release_tag` input.
2. Preflight rejects any mismatch among workflow ref, event SHA, checkout, version tag, public repository and manifest repository. The workflow runs locked, script-disabled installation, unit tests and the production dependency audit. It builds one image, checks the `node:node` configuration, and executes the actual CLI help with no network and a read-only root filesystem, parsing the result as JSON.
3. The job logs into GHCR using only its short-lived `GITHUB_TOKEN` with `packages:write`, pushes that same smoke-tested image, and obtains its registry manifest digest. It creates official GitHub SLSA build provenance with `actions/attest`, bound to that digest and stored in GHCR, then verifies the registry bundle against the exact source/ref/workflow. No npm account, npm token or npm website interaction is involved.
4. New GHCR packages can initially be private. The owner must check package visibility and enable public access before claiming anonymous installation. Independently pull the digest, run its CLI help and verify the attestation, retaining the run URL, digest and commit for the registry entry. A successful source commit or workflow preparation alone proves none of these publication steps.

Build provenance records the GitHub release workflow and artifact identity. The Node 24 base tag is resolved at build time; it is not a promise of byte-identical future rebuilds. Use the published digest for installation. The container smoke validates packaging/entrypoint; the separately recorded real DKG HTTP/Working Memory workflow remains described in [VERIFICATION.md](VERIFICATION.md).

Official references checked 2026-10-17: [GitHub's container publication guide](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [official attest action](https://github.com/actions/attest), [GitHub CLI attestation verification](https://cli.github.com/manual/gh_attestation_verify), [Docker host networking](https://docs.docker.com/engine/network/drivers/host/) and [official Node images](https://github.com/nodejs/docker-node). Release-action versions are pinned to their official release commits in `container.yml`.
