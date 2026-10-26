{
  buildNpmPackage,
  fetchurl,
  installShellFiles,
  lib,
  runCommand,
}:

let
  manifest = lib.importJSON ../../package.json;
  version = manifest.devDependencies."@fission-ai/openspec";
  hashes = lib.importJSON ./hashes.json;
  lock = lib.importJSON ./package-lock.json;
  # Hashes authenticate the manifest-selected package, rather than selecting a version.
  srcWithLock = runCommand "openspec-src-with-lock" { } ''
    mkdir -p "$out"
    tar -xzf ${
      fetchurl {
        url = "https://registry.npmjs.org/@fission-ai/openspec/-/openspec-${version}.tgz";
        hash = hashes.sourceHash;
      }
    } -C "$out" --strip-components=1
    cp ${./package-lock.json} "$out/package-lock.json"
  '';
in
assert lib.assertMsg (builtins.match "[0-9]+\\.[0-9]+\\.[0-9]+" version != null)
  "OpenSpec must have an exact version in the root package.json";
assert lib.assertMsg (
  lock.name == "@fission-ai/openspec"
  && lock.version == version
  && lock.packages."".name == "@fission-ai/openspec"
  && lock.packages."".version == version
) "The vendored OpenSpec npm lock must match the root package.json";
buildNpmPackage {
  pname = "openspec";
  inherit version;
  src = srcWithLock;
  npmDepsFetcherVersion = 2;
  npmDepsHash = hashes.npmDepsHash;
  makeCacheWritable = true;
  dontNpmBuild = true;
  nativeBuildInputs = [ installShellFiles ];

  postInstall = ''
    export OPENSPEC_TELEMETRY=0
    installShellCompletion --cmd openspec \
      --bash <($out/bin/openspec completion generate bash) \
      --fish <($out/bin/openspec completion generate fish) \
      --zsh <($out/bin/openspec completion generate zsh)
  '';

  meta = {
    description = "Spec-driven development for AI coding assistants";
    homepage = "https://github.com/Fission-AI/OpenSpec";
    changelog = "https://github.com/Fission-AI/OpenSpec/releases/tag/v${version}";
    downloadPage = "https://www.npmjs.com/package/@fission-ai/openspec";
    license = lib.licenses.mit;
    sourceProvenance = with lib.sourceTypes; [ binaryBytecode ];
    mainProgram = "openspec";
  };
}
