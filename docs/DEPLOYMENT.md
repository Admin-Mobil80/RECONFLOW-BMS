# Deployment — BMS

**https://bms.reconflow.wingtheidea.com**

Deploys are automatic: every push to `main` runs
`.github/workflows/deploy.yml`, which builds with Vite and syncs `dist/` into
this app's folder of the shared bucket, then invalidates CloudFront. There is no
manual build-and-upload path and no long-lived AWS keys — the workflow assumes an
IAM role through GitHub's OIDC provider.

## Where it lands

Every WingTheIdea web app is served from one bucket, one folder per app:

```
wingtheidea-webapps-231427841372/
  RECONFLOW/
    PORTAL/   ->  https://reconflow.wingtheidea.com
    BMS/      ->  https://bms.reconflow.wingtheidea.com
```

This app writes only to `RECONFLOW/BMS/`. Its deploy role is scoped to that prefix —
including an `s3:prefix` condition on `ListBucket` — so `s3 sync --delete`
cannot see or remove a sibling app's files. A wrong `S3_PREFIX` fails with
AccessDenied rather than damaging another app.

(The bucket is not named `webapps.wingtheidea.com`: a bucket name containing
dots breaks TLS between CloudFront and the origin, because S3's wildcard
certificate matches only one label. The hostname comes from CloudFront and
Route 53 instead.)

## Infrastructure

The bucket, CloudFront distribution, ACM certificate, Route 53 records and the
deploy role are **not** created here. They are CloudFormation resources from the
CDK stacks in
[RECONFLOW-BACKEND](https://github.com/Admin-Mobil80/RECONFLOW-BACKEND):
`wingtheidea-webapps` (shared bucket), `reconflow-certificates` (us-east-1)
and `reconflow-bms`. Never create or change any of them by hand — that is a project
hard rule.

## Repo variables

Settings → Secrets and variables → Actions → **Variables** (not secrets; none of
these are sensitive):

```bash
aws cloudformation describe-stacks --stack-name reconflow-bms \
  --profile wingtheidea --region ap-south-1 \
  --query 'Stacks[0].Outputs' --output table
```

| Variable | Required | From stack output | Value |
| --- | --- | --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | yes | `AwsDeployRoleArn` | Role trusted only for `repo:Admin-Mobil80/RECONFLOW-BMS:*` |
| `S3_BUCKET` | yes | `S3Bucket` | `wingtheidea-webapps-231427841372` |
| `S3_PREFIX` | yes | `S3Prefix` | `RECONFLOW/BMS` |
| `CLOUDFRONT_DISTRIBUTION_ID` | recommended | `CloudfrontDistributionId` | Without it the sync runs but the cache is not invalidated |
| `AWS_REGION` | no | — | Defaults to `ap-south-1` |
| `BUILD_DIR` | no | — | Defaults to `dist`, which is what Vite emits |

Until `AWS_DEPLOY_ROLE_ARN`, `S3_BUCKET` and `S3_PREFIX` are all set, the
deploy job **skips** with a notice instead of failing, so `main` stays green.

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
