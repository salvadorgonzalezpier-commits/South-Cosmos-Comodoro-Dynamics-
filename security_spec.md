# Security Specification & Red Team Spec (Firestore)

## 1. Data Invariants
1. **Identity Isolation**: Every `/users/{userId}`, `/whitelistDomains/{domainId}`, and `/knowledgeEntries/{entryId}` document belongs to an authenticated user whose `request.auth.uid` matches `{userId}` or `ownerUid`, and whose email is verified (`request.auth.token.email_verified == true`).
2. **No Self-Assigned Privilege**: Standard users cannot write to `/admins/{userId}` or alter `ownerUid`, `createdAt`, or immutable IDs after creation.
3. **Strict Key & Size Bounds**: Every `create` verifies `hasAll` and `hasOnly` with bounded string lengths, numeric physical limits (`temperatura` in `[0, 1000]`, `presion` in `[0, 1e7]`, `viento` in `[0, 150]`, `luz` in `[0, 1500]`), and server timestamps (`request.time`).
4. **No Blanket List Reads**: Every `allow list` validates `resource.data.ownerUid == request.auth.uid || isAdmin()` without performing `get()` or `exists()` per-row lookups.
5. **Terminal State Lock on Knowledge Review**: Once a `knowledgeEntry` reaches `status == 'rechazado'`, non-admin owners cannot mutate it back to `'aprobado'`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated read/write** on `/users/u1`, `/whitelistDomains/d1`, `/knowledgeEntries/k1` -> `PERMISSION_DENIED`.
2. **Unverified email write** (`email_verified: false`) -> `PERMISSION_DENIED`.
3. **Cross-user PII read** (`get /users/otherUid` by non-owner non-admin) -> `PERMISSION_DENIED`.
4. **Blanket list query without owner filter** (`list /knowledgeEntries`) -> `PERMISSION_DENIED`.
5. **Identity spoofing on create** (`ownerUid: "victim"` while `auth.uid == "attacker"`) -> `PERMISSION_DENIED`.
6. **Shadow key injection** (`isAdmin: true` or `extraField: 1` on create/update) -> `PERMISSION_DENIED`.
7. **ID poisoning** (`domainId` > 128 chars or containing invalid characters `/$`) -> `PERMISSION_DENIED`.
8. **Out-of-range physical value poisoning** (`temperatura: 99999` or `luz: -500`) -> `PERMISSION_DENIED`.
9. **Client-forged timestamp** (`createdAt != request.time` on create, `updatedAt != request.time` on update) -> `PERMISSION_DENIED`.
10. **Immutable field tampering** (changing `ownerUid` or `createdAt` on update) -> `PERMISSION_DENIED`.
11. **Terminal state bypass** (non-admin updating a `'rechazado'` entry back to `'aprobado'`) -> `PERMISSION_DENIED`.
12. **Privilege escalation into `/admins/{uid}`** by non-admin user -> `PERMISSION_DENIED`.
