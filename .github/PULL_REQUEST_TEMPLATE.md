## Summary

- What changed
- Why it changed
- Risk level

## Validation

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] Relevant tests pass

## Performance and Build Checklist

- [ ] Route is server-first unless interactivity is required
- [ ] No new broad client layout boundary added
- [ ] Heavy modules are lazy loaded where possible
- [ ] No new persistent expensive animations above the fold
- [ ] No hardcoded localhost app links
- [ ] Perf budgets reviewed for touched routes
- [ ] If budget exemption added: reason + owner + expiry included

## Notes

- Any trade-offs, exemptions, or rollout constraints
