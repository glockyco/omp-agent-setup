{
  description = "Immutable personal Oh My Pi plugin";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

    # Keep OMP on its upstream-supported package set for discovery checks.
    llm-agents.url = "github:numtide/llm-agents.nix";

    # Git hooks whose entries are absolute store paths, so a commit made outside
    # the devshell -- from an editor, a GUI client, or an agent -- runs the same
    # tools rather than failing on an ambient PATH.
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      llm-agents,
      git-hooks,
    }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;

      # Each entry names `bun` by store path and then a script from package.json,
      # so Nix decides which bun runs and `bun.lock` decides everything that bun
      # then runs. A hook carrying its own linter would be a second version of a
      # tool the lockfile already pins.
      gitHooks = forAllSystems (
        system:
        let
          bun = "${nixpkgs.legacyPackages.${system}.bun}/bin/bun";
        in
        git-hooks.lib.${system}.run {
          src = ./.;
          hooks = {
            check-lint = {
              enable = true;
              name = "biome";
              entry = "${bun} run check:lint";
              language = "system";
              types_or = [
                "ts"
                "javascript"
                "json"
                "markdown"
              ];
              pass_filenames = false;
            };
            check-types = {
              enable = true;
              name = "tsc";
              entry = "${bun} run check:types";
              language = "system";
              types_or = [
                "ts"
                "javascript"
              ];
              pass_filenames = false;
            };
            # The full gate at push time. Dead-code and advisory scans and the
            # test suite are worth waiting for once before a push, and not on
            # every commit.
            ci = {
              enable = true;
              name = "bun run ci";
              entry = "${bun} run ci";
              language = "system";
              pass_filenames = false;
              always_run = true;
              stages = [ "pre-push" ];
            };
          };
        }
      );
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
              llm-agents.packages.${system}.openspec
            ];

            # Entering the shell installs the hooks, so a clone is configured by
            # the step it already takes rather than by a separate instruction
            # nobody runs.
            inherit (gitHooks.${system}) shellHook;
          };
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt-tree);
    };
}
