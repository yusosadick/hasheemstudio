# Scoped source-first review — upload signature repair

Scope: the API-to-Storage destination in `infra/compose/docker-compose.yml`, its DNS regression,
`apps/api/src/{storage,actor,auth,jwt,freeSlot}.ts`, upload/job/download routes, the browser TUS
client, Envoy storage routing, and migrations 0008/0013. This is a focused review using the
installed security-audit skill, not a comprehensive audit or a guarantee against compromise.

The production configuration previously used the non-unique `api-gw` alias. Read-only Docker
DNS inspection from the Studio API returned both Studio and another project's gateway addresses.
The normal browser upload reproduced the exact reported HTTP 500 / upstream 400 / AccessDenied
signature failure. The corresponding failed requests did not arrive in Studio Storage logs;
successful requests did. All inspected Studio service-role/signing configuration hashes matched,
the HS256 service-role signature validated locally, issuer was `hasheemstudio`, no audience was
present (as issued by the repository generator), and expiry was in the future. Studio Storage's
installed verifier checks the signature and expiry with its configured HS256 secret; the standard
TUS path has no separate S3 request signature. Envoy preserves Authorization on the storage route.
No credential or request was deliberately sent to another project's address during diagnosis.

The one-line functional fix uses the existing unique `hasheemstudio-envoy` container name. It
removes the observed cross-project destination ambiguity without changing secrets, token claims,
JWT verification, gateway forwarding, bucket visibility, RLS, quotas, or browser contracts.
The regression checks real DNS answers against the actual dedicated gateway's addresses, without
making authenticated requests; it failed before the fix and passes for the candidate destination.
Runtime mode also checks that the deployed API actually uses the reviewed destination.

Source controls retained: requireActor authenticates before proxy access; session ownership,
pending state, expiry, chunk size and offsets are checked; stored TUS paths cannot supply another
host; finalize checks actual object size; guest admission is serialized; downloads require a
verified account, workspace/job ownership and an atomic quota grant; output reads and client
signing remain denied by private storage/RLS. Frontend/worker code is unchanged. All 22 deployed
API source files matched this checkout before deployment; resolved API environment differs only
in API_STORAGE_HOST.

No unresolved material finding in the changed boundary. Live upload/retry, authenticated upload,
negative authorization and gated download remain mandatory release acceptance, recorded separately.
The source review itself used no production attack probes or credential-bearing audit fixtures.
Owner-authorized functional reproduction and acceptance are separate from this source review.

Limits: no whole-host/network-isolation audit, historical credential-access investigation, or
proof of other projects' log handling. Credentials were not rotated. Shared-network service
aliases remain present for compatibility; the fixed API no longer uses the ambiguous alias.
Existing API_TRUST_PROXY is IP-pinned and unchanged; its lifecycle should be reviewed separately
when the shared ingress address changes. No owner video was supplied, only its screenshot; generated
H.264/AAC MOV fixtures are used for upload-boundary verification.

Reference: Docker documents that a shared network alias need not resolve to a particular container:
https://docs.docker.com/reference/compose-file/services/#aliases
