# Pulumi Angular Monorepo     

Pulumi Angular Monorepo is a template project, which uses pulumi as IaC for
deployment monorepo angular purpose.

I recommend using `direnv` package + `nix` package manager with current project.
Here is some benefit of `direnv`:

- Load [12Factor apps](https://12factor.net/) environment variables.
- Create project isolated development environments.
- Load secrets for coding stage.
- Load secrets for deployment stage.
- Supported multiple platforms. Ex: `(aarch64|x86_64)-darwin`,
  `(aarch64|x86_64)-linux`,...

References:

- [Direnv](https://direnv.net/)
- [Nix](https://nixos.org/)
- [Nix Snowfall](https://snowfall.org/)

## Prequisites

### If you use Nix `flake` to manage your project packages

This project is configured to support Nix package manager. You should install
direnv to auto install required packages for your project. All cli applications
and environment variables will be injected to your current shell.

```bash
direnv allow
```

New package for this project should be defined in
`nix/shells/frontend/default.nix`. You can browse package from
[NixOS Search](https://search.nixos.org/packages).

If you develop app in multiple platforms, please reading carefully about the
package description because some packages are only defined for specific system.

To update package versions

```bash
nix flake update
direnv allow && direnv reload
```

### In the case you're not using Nix `flake`

The list of required packages are listed in `nix/shells/frontend/default.nix`
Install its by yourself 󰱱

## Explaining Technical Stack And Development Workflow

### Infrastructure

This template is a cloud-native project using Pulumi as Infrastructure as Code
(IaC) to deploy Angular applications to AWS. Below is a detailed breakdown of
the AWS resources and their interactions:

#### 1. **AWS Resources**:

- **S3 Bucket**:
  - **Purpose**: Stores static files (HTML, CSS, JS, assets) for each monorepo
    application.
  - **Configuration**:
    - Bucket ownership is set to `BucketOwnerPreferred` to ensure proper access
      control.
    - Public access is blocked to enforce security (`blockPublicAcls`,
      `ignorePublicAcls`, etc.).
    - Files are synced from the local `builtDir` (e.g., `dist/apps`) to the S3
      bucket using the `@pulumi/synced-folder` package.
  - **Output**: The bucket's regional domain name (e.g.,
    `bucket.s3.region.amazonaws.com`) is used as the CloudFront origin.

- **CloudFront Distribution**:
  - **Purpose**: Acts as a CDN to serve content from the S3 bucket with
    optimizations like caching, HTTPS, and custom error handling.
  - **Configuration**:
    - **Origin**: The S3 bucket is configured as the origin with
      `Origin Access Control (OAC)` for secure access.
    - **Caching**: Uses AWS-managed cache policies (`CachePolicyId`) and
      response headers policies (`ResponseHeadersPolicyId`).
    - **Custom Errors**: Redirects `404` and `403` errors to `index.html` for
      SPAs (Single Page Applications).
    - **SSL/TLS**: Uses an ACM certificate for HTTPS (`acmCertificateArn`).
    - **Aliases**: Maps to a custom domain (e.g., `app.example.com`).
  - **Output**: The CloudFront distribution domain name (e.g.,
    `d123.cloudfront.net`).

- **Route 53 Record**:
  - **Purpose**: Maps the CloudFront distribution to a custom domain (e.g.,
    `app.example.com`).
  - **Configuration**:
    - Uses the CloudFront distribution's domain name and hosted zone ID.
    - Supports `A` record type with alias routing.
  - **Output**: The DNS record ID for reference.

- **ACM Certificate**:
  - **Purpose**: Provides SSL/TLS certificates for secure HTTPS connections.
  - **Note**: The certificate must be provisioned in the `us-east-1` region
    (required by CloudFront).

#### 2. **AWS Dependencies**:

- **S3 Bucket Policy**:
  - Allows CloudFront to read objects via an IAM policy tied to the CloudFront
    distribution's ARN.
- **CloudFront Origin**:
  - Uses the S3 bucket as its origin, secured via OAC.
- **Route 53**:
  - Points the custom domain to the CloudFront distribution.

#### 3. **Pulumi**:

- **Configuration**:
  - Uses `Pulumi Config` to fetch deployment settings (e.g., `builtDir`,
    `region`, `repos`).
  - Supports dynamic resource naming (e.g., `util.mkResourceName`) for
    uniqueness.
- **Setup Functions**:
  - Modular functions (`setupS3BucketFolder`, `setupCloudFrontDistribution`,
    etc.) orchestrate resource creation.
  - Dependencies are managed explicitly (e.g., `dependsOn` for synced folders).
- **Outputs**:
  - Exposes critical IDs (e.g., `distributionId`, `dnsRecordId`) for debugging
    and automation.

#### 4. **Local System**:

- **Synced Folder**:
  - The `@pulumi/synced-folder` package syncs the local `builtDir` (e.g.,
    `dist/apps`) to the S3 bucket during deployment.
  - Ensures only the owner can modify files
    (`acl: "bucket-owner-full-control"`).
- **Environment**:
  - Uses `direnv` and `nix` to manage CLI tools and environment variables (e.g.,
    `AWS_REGION`, `PULUMI_CONFIG`).

### Development Workflow

```bash
 .
├──  .envrc                        # auto load cli-packages & environment variables
├──  flake.nix                     # nix flake inputs
├──  nix
│   └──  shells
│       └──  frontend
│           └──  default.nix       # list of cli-packages
└──  Taskfile.yaml                 # contains list of command to control your applications.
```

When you `cd` to this project, direnv will try to load cli-packages from Nix
package manager (which defined in `flake.nix` & `frontend/default.nix`) and
environment variables defined in `.env` file and Pulumi ESC.

Based on stage variable that you defined in `.env`, the corresponding variables
will be retrieved from Pulumi ESC and exported to current shell.

Use commands inside `Taskfile.yml` to start, lint, deploy... your project.

## Hands On

After created a new project in `Pulumi` console. Use the `project name` +
`stack` to init the deployment config.

```bash
# Init pulumi module
pulumi new aws-typescript -s {your_org}/{project_name}/{stack} --dir deployment/aws
cd ./deployment/aws && npm i

# Install required packages
npm i @aws-sdk/client-cloudfront @pulumi/synced-folder
```

### Example

Stack inside `deployment/aws-example`
