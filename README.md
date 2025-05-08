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

### Technical Stack

This template is cloud native project using Pulumi as IaC tool to deploy project
to AWS.

#### Infrastructure

1. **AWS Resources**:
   - **S3 Bucket**: Stores the static files synced from the local directory for
     each monorepo.
   - **CloudFront Distribution**: Serves the content from a S3 folder with
     caching, HTTPS, and custom error handling.
   - **Route 53 Record**: Maps each CloudFront distribution to a custom domain.
   - **ACM Certificate**: Provides SSL/TLS for each CloudFront distribution.

2. **AWS Dependencies**:
   - The S3 bucket policy allows CloudFront to read objects.
   - CloudFront uses the S3 bucket as its origin.
   - Route 53 points to the CloudFront distribution.

3. **Pulumi**:
   - Uses the `Pulumi Config` to fetch deployment settings.
   - Orchestrates the creation of AWS resources (S3, CloudFront, Route 53) via
     `Setup Functions`.

4. **Local System**:
   - The `Built Directory` is synced to the S3 bucket using the `Synced Folder`
     component.

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
