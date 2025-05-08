{ mkShell, pkgs, ... }:
mkShell {
  packages = with pkgs; [
    # Task runner / simpler Make alternative written in Go
    go-task
    # Analyse & Linting tools
    pre-commit
    prettierd
    eslint
    # Node environment
    nodejs_22
    # Infrastructure required packages
    pulumi
    pulumictl
    pulumi-esc
    pulumiPackages.pulumi-command
    pulumiPackages.pulumi-aws-native
    pulumiPackages.pulumi-language-nodejs
  ];
}
