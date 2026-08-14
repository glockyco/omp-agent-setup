{
  description = "Immutable personal Oh My Pi plugin";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    # Keep OMP on its upstream-supported package set for discovery checks.
    llm-agents.url = "github:numtide/llm-agents.nix";
  };

  outputs =
    {
      self,
      nixpkgs,
      llm-agents,
    }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        rec {
          personal-omp-plugin = pkgs.stdenvNoCC.mkDerivation {
            pname = "personal-omp-plugin";
            version = "0.1.0";
            src = ./plugin;
            nativeBuildInputs = [ pkgs.python3 ];
            dontBuild = true;
            installPhase = ''
              runHook preInstall
              cp -R . "$out"
              patchShebangs "$out/skills/research-evidence/scripts/fetch_pdf.py"
              runHook postInstall
            '';
          };

          default = personal-omp-plugin;
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          plugin = self.packages.${system}.default;
          omp = llm-agents.packages.${system}.omp;
        in
        {
          package-shape =
            pkgs.runCommand "personal-omp-plugin-package-shape"
              {
                nativeBuildInputs = [
                  pkgs.jq
                  omp
                ];
              }
              ''
                test "$(jq -r .name ${plugin}/package.json)" = "@glockyco/personal-omp-plugin"
                test "$(jq -r '.omp.extensions | length' ${plugin}/package.json)" = 1
                test -f ${plugin}/extensions/personal-commit.ts
                test -f ${plugin}/rules/personal-policy.md
                test -f ${plugin}/lsp.json
                test -x ${plugin}/skills/research-evidence/scripts/fetch_pdf.py
                test ! -e ${plugin}/agents
                test ! -e ${plugin}/models
                omp --plugin-dir=${plugin} --help >/dev/null
                touch "$out"
              '';

          python-payload =
            pkgs.runCommand "personal-omp-plugin-python-tests"
              {
                nativeBuildInputs = [ pkgs.python3 ];
              }
              ''
                export PERSONAL_PLUGIN_DIR=${plugin}
                python -m unittest discover -s ${./plugin/tests} -p 'test_*.py'
                touch "$out"
              '';

          bun-payload =
            pkgs.runCommand "personal-omp-plugin-bun-tests"
              {
                nativeBuildInputs = [
                  pkgs.bun
                  pkgs.git
                ];
              }
              ''
                export HOME="$TMPDIR/home"
                mkdir -p "$HOME"
                export PERSONAL_PLUGIN_DIR=${plugin}
                bun test ${./plugin}/tests/plugin-load.test.ts ${./plugin}/tests/personal-commit.test.ts
                touch "$out"
              '';
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShellNoCC {
            packages = [
              pkgs.bun
              pkgs.git
            ];
          };
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt-tree);
    };
}
