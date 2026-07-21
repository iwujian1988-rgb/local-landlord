# Project delivery rules

The user considers every CloudRun deployment and WeChat miniapp upload expensive. All changes must be delivered as release candidates with a high-confidence, one-deployment workflow.

## Mandatory release gate

1. Audit the entire affected data and request chain, plus adjacent failure modes, before changing code. Avoid symptom-by-symptom releases.
2. Test realistic stateful scenarios. Database deletion or statistics work must include populated historical records, paid and partial-payment data where applicable, and production MySQL foreign-key ordering—not only empty data or SQL.js happy paths.
3. For destructive UI actions, require explicit confirmation, scope operations to the authenticated landlord, validate `response.code === 0`, and never display success after an API failure.
4. Before handoff, run the relevant type-check and builds, focused regression tests, and the full affected backend test suite. Do not call work complete while required tests are failing.
5. Confirm local `HEAD` is pushed to `origin/master` before asking for deployment. Report the exact commit hash and clearly distinguish:
   - server-only change: CloudRun redeploy only;
   - miniapp-only change: rebuild and upload a new experience version;
   - shared change: both operations are required.
6. After deployment, verify health and the changed route against the live service when access permits. Do not treat a health check alone as proof that a business operation works.
7. Preserve unrelated worktree changes, local WeChat DevTools configuration, spreadsheets, and user-created files.

If production-only evidence is unavailable, stop and state exactly what remains unverified instead of asking the user to repeatedly deploy speculative fixes.
