{
  description = "Pulumi Angular Monorepo";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    darwin = {
      url = "github:lnl7/nix-darwin";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    snowfall-lib = {
      url = "github:snowfallorg/lib";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs:
    let
      lib = inputs.snowfall-lib.mkLib {
        inherit inputs;
        src = ./.;
        snowfall = {
          root = ./nix;
          meta = {
            name = "Pulumi Angular Monorepo";
            title = "Pulumi Angular Monorepo";
          };
          namespace = "pulumi-angular-monorepo";
        };
      };
    in
    lib.mkFlake {
      channels-config = {
        allowUnfree = false;
      };
      overlays = [ ];
      systems.modules = {
        nixos = [ ];
        darwin = [ ];
      };
      outputs-builder = channels: { formatter = channels.nixpkgs.nixfmt-rfc-style; };
    };
}
