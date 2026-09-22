# Security Specification & Threat Model

## Data Invariants
1. A user can only read, create, update, or delete their own documents where `ownerId == request.auth.uid` or document ID matches `request.auth.uid`.
2. Document creation must bind `ownerId` (or user ID) strictly to `request.auth.uid`.
3. Path variables must be valid string identifiers conforming to `isValidId()` (`^[a-zA-Z0-9_\-]+$`, size <= 128).
4. No blanket read permissions: list queries must evaluate `resource.data.ownerId == request.auth.uid`.
5. PII such as email addresses must only be visible to the resource owner.
6. Updates must not alter immutable fields (`ownerId`, `createdAt`).

## The "Dirty Dozen" Threat Payloads
1. **Identity Spoofing**: Attempt to insert a Trade with `ownerId: "victim-uid"`.
2. **Path Poisoning**: Attempt to write to a path with a 2KB junk string ID.
3. **Cross-Tenant List**: Attempting `collection('trades')` without scoping `where('ownerId', '==', auth.uid)`.
4. **Field Injection (Ghost Fields)**: Injecting arbitrary keys like `isAdmin: true` into the `User` or `Setting` entity.
5. **State Escaping**: Mutating `createdAt` during an update.
6. **Type Poisoning**: Sending `riskPercentage: "one hundred"` instead of a number.
7. **Size Attack**: Injecting a 2MB analysis text exceeding the 5000 character boundary.
8. **Unauthenticated Read**: Attempting to read `/agents` without a valid Firebase auth token.
9. **Unverified Token Write**: Standard writes requiring `request.auth.token.email_verified == true`.
10. **Trade Status Corruption**: Changing trade status to an arbitrary string not in enum `["OPEN", "CLOSED", "CANCELLED"]`.
11. **Agent Ownership Hijack**: Updating an existing agent document owned by another user.
12. **Settings API Key Leak**: Attempting to read another user's `/settings` document containing their BingX API keys.
