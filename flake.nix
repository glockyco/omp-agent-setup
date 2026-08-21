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

      # Regenerates the OpenSpec adapters into "$scratch/.omp".
      #
      # The generator only writes into a project root, so it runs against a
      # throwaway root holding nothing but an openspec config. Callers set
      # "$adapterConfig" first and read the result afterwards; both the sync app
      # and the freshness check use this, so generation and verification cannot
      # disagree about how the payload is produced.
      generateAdapters = ''
        scratch="$(mktemp -d)"
        trap 'rm -rf "$scratch"' EXIT
        mkdir -p "$scratch/openspec"
        cp "$adapterConfig" "$scratch/openspec/config.yaml"
        (
          cd "$scratch"
          CI=1 OPENSPEC_TELEMETRY=0 openspec init --tools oh-my-pi . >/dev/null
        )
      '';
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

      # The only sanctioned writer of the generated payload. Everything else,
      # including the repository formatter, leaves those paths alone so that
      # reproducing them byte for byte stays a meaningful check.
      apps = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          openspec = llm-agents.packages.${system}.openspec;
          sync = pkgs.writeShellApplication {
            name = "sync-openspec-adapters";
            runtimeInputs = [ openspec ];
            text = ''
              repo="$PWD"
              if [ ! -f "$repo/plugin/package.json" ] || [ ! -f "$repo/openspec/config.yaml" ]; then
                echo "Run this from the repository root." >&2
                exit 1
              fi

              adapterConfig="$repo/openspec/config.yaml"
              ${generateAdapters}

              rm -rf "$repo/plugin/commands"
              rm -rf "$repo"/plugin/skills/openspec-*
              cp -R "$scratch/.omp/commands" "$repo/plugin/commands"
              cp -R "$scratch"/.omp/skills/openspec-* "$repo/plugin/skills/"
              chmod -R u+w "$repo/plugin/commands" "$repo"/plugin/skills/openspec-*

              commands=( "$repo"/plugin/commands/*.md )
              skills=( "$repo"/plugin/skills/openspec-*/ )
              echo "Synced ''${#commands[@]} commands and ''${#skills[@]} skills into plugin/."
            '';
          };
        in
        {
          sync-openspec-adapters = {
            type = "app";
            program = nixpkgs.lib.getExe sync;
          };
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          plugin = self.packages.${system}.default;
          omp = llm-agents.packages.${system}.omp;
          openspec = llm-agents.packages.${system}.openspec;
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

          bun-runtime =
            pkgs.runCommand "personal-omp-plugin-bun-runtime"
              {
                nativeBuildInputs = [ pkgs.bun ];
              }
              ''
                test "$(bun --version)" = "${pkgs.bun.version}"
                touch "$out"
              '';

          openspec-contracts =
            pkgs.runCommand "personal-omp-plugin-openspec-contracts"
              {
                nativeBuildInputs = [ openspec ];
              }
              ''
                export CI=1
                export HOME="$TMPDIR/home"
                export OPENSPEC_TELEMETRY=0
                mkdir -p "$HOME"
                cd ${./.}
                openspec validate --all --strict --no-interactive
                openspec validate --archived --strict --no-interactive
                touch "$out"
              '';

          openspec-adapters =
            pkgs.runCommand "personal-omp-plugin-openspec-adapters"
              {
                nativeBuildInputs = [
                  openspec
                  pkgs.diffutils
                ];
              }
              ''
                export CI=1
                export HOME="$TMPDIR/home"
                export OPENSPEC_TELEMETRY=0
                mkdir -p "$HOME"
                cp -R ${./.} source
                chmod -R u+w source
                cd source
                openspec update . --force
                diff -ru ${./.}/.omp/commands .omp/commands
                diff -ru ${./.}/.omp/skills .omp/skills
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
              pkgs.lefthook
              llm-agents.packages.${system}.openspec
            ];

            # Installing is idempotent, so it is safe on every entry. The guard
            # keeps it quiet outside a work tree.
            shellHook = ''
              if [ -d .git ]; then
                lefthook install >/dev/null
              fi
            '';
          };
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt-tree);
    };
}
