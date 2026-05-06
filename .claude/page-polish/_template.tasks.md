# Page Polish Tasks — <route>

| # | Step | Status | Output | Verified by |
|---|------|--------|--------|-------------|
| 1 | Locate (pwd / branch / url / component count) | ⏳ | locate.* fields in run.yml | shell pwd + git + ls |
| 2 | Walkthrough (no skills loaded) | ⏳ | walkthrough.* fields | manual visual inspection |
| 3 | Load skills | ⏳ | skills_loaded[] | grep skill load actions |
| 4 | Speed test cold + warm | ⏳ | speed_test.* | Lighthouse |
| 5 | Bottleneck hunt (parallel with #4) | ⏳ | bottlenecks[] | Performance recording |
| 6 | Datapoint mapping | ⏳ | datapoints[] | trace useQuery + Server Action sites |
| 7 | API routing (cross-check ROUTES.md) | ⏳ | api_routes[] | grep + ROUTES.md cross-ref |
| 8 | Page Knowledge copy (header / desc / empty / error) | ⏳ | page_knowledge.* + DB row | manual + sync to page_knowledge table |
| 9 | Harness tools registration | ⏳ | harness_tools[] | useRegisterTools call sites |
| 10 | Design pass (motion + color audit) | ⏳ | design.* | grep counts must be 0 |
| 11 | Re-test | ⏳ | retest.* | Lighthouse — must improve vs step 4 |
| 12 | Verification | ⏳ | all checklist[] true | self-audit |

Status legend: ⏳ pending · 🔄 in progress · ✅ done · ❌ failed (with comment)

## Notes

- ALWAYS update both this table AND the run.yml — they MUST stay in sync
- Do NOT mark `verified: true` in run.yml until ALL checklist items are true
- Pre-commit hook blocks commits to `apps/web/src/app/dashboard/<route>/**` unless run.yml has `verified: true`
- Bypass hook only with `SKIP_PAGE_POLISH=1` env var (use sparingly, document why)
