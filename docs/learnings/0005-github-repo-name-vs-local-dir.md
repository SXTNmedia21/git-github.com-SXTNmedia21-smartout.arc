---
id: 0005
title: GitHub repo name differs from local directory name
date: 2026-02-28
tags: [git, github, tooling]
---

# Learning-0005: GitHub repo name differs from local directory name

## Context

While posting inline code review comments on PR #6 via the GitHub API, all requests returned 404. The API calls used `SXTNmedia21/smartout_v3` as the repo path.

## Discovery

The local directory is `smartout_v3/` but the GitHub remote repo is `SXTNmedia21/smartout.ai`. The `gh` CLI resolves this automatically for most commands, but when constructing raw API URLs or code links, you must use the actual repo name.

Correct way to get the repo name:

```bash
gh repo view --json nameWithOwner -q '.nameWithOwner'
# → SXTNmedia21/smartout.ai
```

## Impact

- Always use `gh repo view --json nameWithOwner` to get the correct repo identifier
- Never assume the local folder name matches the GitHub repo name
- Code review links must use the actual repo name for GitHub markdown rendering to work

## References

- PR: #6 (Platform Admin Backoffice) code review
- Remote: `origin` → `https://github.com/SXTNmedia21/smartout.ai.git`
