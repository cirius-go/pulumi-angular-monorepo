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
Install its by yourself 󰇵

## Setup pulumi workspace

## Init Angular project
