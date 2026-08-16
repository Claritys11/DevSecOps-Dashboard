# GitHub Settings

Do not change repository settings silently from automation. Maintainers should configure these manually.

## Branch Protection

Protect `main`:

- require Pull Requests before merge;
- require at least one approving review;
- require CI checks to pass;
- require branches to be up to date before merge;
- block force pushes;
- block branch deletion;
- include administrators unless there is a documented break-glass process.

## Merge Strategy

- Prefer squash merge.
- Disable merge commits if maintainers want a linear history.
- Enable automatic branch deletion after merge.

## Security

- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection when available.
- Enable private vulnerability reporting.
- Review dependency and secret scan findings before release.

## Actions

CI pins GitHub Actions to immutable commit SHAs with a comment showing the tag used. To update a pin, resolve the desired tag with:

```bash
git ls-remote https://github.com/actions/checkout.git refs/tags/v4
```

Then update the workflow SHA and keep the tag comment.

## Maintainer Identity

Configure a GitHub noreply email for commits if maintainers do not want personal email addresses in public history:

```bash
git config user.email "USERNAME@users.noreply.github.com"
```
