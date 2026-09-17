# Deployment — BMS

Deploys are automatic: every push to `main` runs
`.github/workflows/deploy.yml`, which builds with Vite and syncs `dist/` to
S3, then invalidates CloudFront. There is no manual build-and-upload path, and
no long-lived AWS keys — the workflow assumes an IAM role through GitHub's OIDC
provider.

## Infrastructure

The bucket, the CloudFront distribution and the deploy role are **not** created
here. They come from the CDK stack `reconflow-bms` in
[RECONFLOW-BACKEND](https://github.com/Admin-Mobil80/RECONFLOW-BACKEND). Never
create or change them by hand — that is a project hard rule.

## Repo variables

Settings → Secrets and variables → Actions → **Variables** (not secrets; none of
these are sensitive). Take the values from the stack outputs:

```bash
aws cloudformation describe-stacks --stack-name reconflow-bms \
  --profile wingtheidea --region ap-south-1 \
  --query 'Stacks[0].Outputs' --output table
```

| Variable | Required | From stack output | Notes |
| --- | --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | yes | `AwsDeployRoleArn` | Role trusted only for `repo:Admin-Mobil80/RECONFLOW-BMS:*` |
| `S3_BUCKET` | yes | `S3Bucket` | Private bucket; CloudFront reads it via OAC |
| `CLOUDFRONT_DISTRIBUTION_ID` | recommended | `CloudfrontDistributionId` | Without it the sync still runs but the cache is not invalidated |
| `AWS_REGION` | no | — | Defaults to `ap-south-1` |
| `BUILD_DIR` | no | — | Defaults to `dist`, which is what Vite emits |

Until `AWS_DEPLOY_ROLE_ARN` and `S3_BUCKET` are set, the deploy job
**skips** with a notice instead of failing, so `main` stays green.

## Caching

The sync runs twice on purpose: hashed assets get
`max-age=31536000,immutable`, while `*.html` and `*.json` get
`max-age=0,must-revalidate` so a deploy is visible immediately. Any other
root-level file you add (e.g. `robots.txt`) falls in the immutable pass — move
it into the second pass if it needs to change between deploys.

## Client-side routing

CloudFront maps 403 and 404 from S3 to `/index.html` with status 200, so deep
links work and React Router renders the 404 page itself.

## Manual run

`workflow_dispatch` is enabled — run **Deploy** from the Actions tab to
redeploy `main` without a new commit.
