# Deployment Checklist

## Pre-Release Checks

- [ ] All tests passing
- [ ] No open blocking issues
- [ ] Code review completed
- [ ] Version number updated in `app.json`
- [ ] Changelog updated
- [ ] Commit message follows conventional commits

## Android AAB Release Steps

### 1. GitHub Secrets Configuration
- [ ] `EAS_TOKEN` is set in repository secrets
- [ ] Token has build permissions in Expo account

### 2. Code Preparation
```bash
# Update version in app.json
# Commit changes
git add app.json
git commit -m "chore: bump version to v1.x.x"
```

### 3. Tag Release
```bash
# Create semantic version tag
git tag v1.x.x
git push origin v1.x.x

# Workflow automatically triggers
```

### 4. Monitor Build
- [ ] Check GitHub Actions workflow progress
- [ ] Wait for AAB build to complete (~15-20 minutes)
- [ ] Verify artifact uploaded to release

### 5. Google Play Store Submission
- [ ] Download AAB from GitHub release
- [ ] Log in to [Google Play Console](https://play.google.com/console)
- [ ] Go to **Release** > **Production**
- [ ] Upload AAB file
- [ ] Fill in release notes
- [ ] Add screenshots/graphics if first release
- [ ] Review and submit

### 6. Post-Release
- [ ] Monitor for any crashes/issues
- [ ] Track user ratings and feedback
- [ ] Document any post-release patches

## Rollback Procedure

If critical issues found after release:

1. Identify and fix the issue
2. Create a patch release (v1.x.x+1)
3. Repeat deployment steps
4. Request expedited review on Play Store
5. Optionally unpublish previous version

## Monitoring

After release, monitor:
- Crash reports in Play Console
- User ratings and reviews
- Analytics dashboard
- Error tracking (if configured)

## Emergency Contacts

- Play Store Support: [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- Expo Support: [Expo Forums](https://forums.expo.dev/)
