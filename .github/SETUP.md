# CI/CD Setup Guide

## Prerequisites

1. A GitHub repository for this project
2. CloudBase API keys (SecretId + SecretKey)
3. A staging CloudBase environment (created via `tcb env create`)

## Step 1: Create API Keys

Go to https://console.cloud.tencent.com/cam/capi → Create API key → Copy SecretId and SecretKey

## Step 2: Create Staging Environment

```bash
tcb env create --package baas_personal --alias xietiao-staging --region ap-shanghai --yes
```

Copy the new envId and set it as `TCB_ENV_STAGING` secret.

## Step 3: Add GitHub Secrets

Go to repo Settings → Secrets and variables → Actions → Add the following:

| Secret Name | Value |
|---|---|
| TCB_SECRET_ID | Your CloudBase API SecretId |
| TCB_SECRET_KEY | Your CloudBase API SecretKey |
| TCB_ENV_STAGING | The staging environment ID |

## Step 4: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git add .
git commit -m "Initial commit with CI/CD pipeline"
git push -u origin master
```

## Workflow Behavior

- `git push` to master → Auto-deploy to **staging** → Health check
- Manual trigger (`workflow_dispatch`) with `production` → Deploy to **production** → Health check → Build web admin

## Production Deployment

Go to Actions → Deploy → Run workflow → Select `production` → Run workflow
