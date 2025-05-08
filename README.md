# Pulumi Angular Monorepo      - In progress

Pulumi Angular Monorepo is a template project, which uses pulumi as IaC for
deployment monorepo angular purpose. It leverages nix for environment management
and direnv for loading environment variables, providing a streamlined
development and deployment workflow.

Here is some benefit of `direnv` and `nix`:

- Load [12factor apps](https://12factor.net/) environment variables.
- Create project isolated development environments.
- Load secrets for coding stage.
- Load secrets for deployment stage.
- Supported multiple platforms. Ex: `(aarch64|x86_64)-darwin`,
  `(aarch64|x86_64)-linux`,...

## Features

- Pulumi Integration: Utilizes Pulumi for managing cloud infrastructure.
- Angular Monorepo: Supports multiple Angular applications within a single
  repository.
- Nix & Direnv: Employs nix for package management and direnv for environment
  variable management.
- Task Automation: Includes a Taskfile.yaml for automating common development
  tasks.

## Infrastructure

### Below is a detailed breakdown of the AWS resources and their interactions

#### 1. **AWS Resources**:

- **S3 Bucket**
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

- **CloudFront Distribution**
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

- **Route 53 Record**
  - **Purpose**: Maps the CloudFront distribution to a custom domain (e.g.,
    `app.example.com`).
  - **Configuration**:
    - Uses the CloudFront distribution's domain name and hosted zone ID.
    - Supports `A` record type with alias routing.
  - **Output**: The DNS record ID for reference.

- **ACM Certificate**
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

Use commands inside `Taskfile.yml` to start, lint, deploy... your project.

## Setup Instructions

### Prequisites

Install these package.

- [Direnv](https://direnv.net)
- (Optional) [Nix-Darwin](https://github.com/nix-darwin/nix-darwin) for MacOS or
  [Nix](https://nixos.org/download/#nix-install-linux) for linux

### Clone template repository

```bash
git clone https://github.com/cirius-go/pulumi-angular-monorepo your_project_name
cd your_project_name
```

### Install required packages

List of required packages is defined at `nix/shells/frontend/default.nix`. You
can use [NixOS Search](https://search.nixos.org/packages) to retrieve package
name.

This project is configured to support Nix package manager + Direnv. Whenever you
allow `direnv` to start or reload, Nix package manager will install required
packages if not exists.

NOTE: If you don't want to use Nix. You can install required packages by
yourself and remove these nix files and folder:

- Inside `.envrc` file, remove this snippet:

  ```bash
  #!/usr/bin/env bash
  # ...
  # remove this block
  if [[ $(type -t use_flake) != function ]]; then
    # ...
  fi

  # remove this block
  if ! has nix_direnv_version || ! nix_direnv_version 3.0.6; then
    # ...
  fi

  # remove this line
  use flake .#frontend --impure
  ```

- Remove `flake.nix`, `flake.lock` files and `nix` folder.

### Allow direnv to load env variables and nix packages

```bash
direnv allow

# To update package versions
nix flake update
direnv allow && direnv reload
```

After that:

- When you `cd` to this project, direnv will try to load or install packages
  from Nix package manager and expose environment variables defined in `.env`
  file and Pulumi ESC to current shell.

- Based on `STAGE` variable inside `.env`, the corresponding variables will be
  retrieved from Pulumi ESC and exported to current shell.

NOTE: This project is using `STAGE` value as Pulumi project's stack name (except
`local`) to consistent across enviroments.

If you develop app in multiple platforms, please reading carefully about the
package description because some packages are only defined for specific system.

### Init project and environment in Pulumi console.

Use the `project name` + `stack` to init the deployment config.

```bash
# Init pulumi module
pulumi new aws-typescript -s {your_org}/{project_name}/{stack} --dir deployment/aws
cd ./deployment/aws && npm i

# Install required packages
npm i @aws-sdk/client-cloudfront @pulumi/synced-folder
```

For example, I created project & env `pulumi-angular-monorepo` with stack `dev`
under `cirius-go` org in pulumi console. So the corresponding command will be:

```bash
pulumi new aws-typescript -s cirius-go/pulumi-angular-monorepo/dev --dir deployment/aws
cd ./deployment/aws && npm i
npm i @aws-sdk/client-cloudfront @pulumi/synced-folder
```

You can see the example config inside `deployment/aws-example`. Which will be
used to deploy all monorepos to AWS.

### Init monorepos codebase using NX

Here, I use [NX](https://nx.dev/getting-started/intro) package to init the
monorepo structure.

```bash
npx create-nx-workspace@latest \
  --preset=angular-monorepo \
  --name=your_mono_repo \
  --appName=your_app_name \
  --style=scss \
  --bundler=esbuild \
  --standalone \
  --routing \
  --pm=npm \
  --skipGit
```
