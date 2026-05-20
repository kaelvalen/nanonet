{
  description = "nanonet dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" "clippy" ];
          targets = [ "x86_64-unknown-linux-musl" ];
        };
      in {
        devShells.default = pkgs.mkShell {
          name = "nanonet-dev";

          packages = with pkgs; [
            # Docker
            docker
            docker-compose

            # Go (backend)
            go
            gotools
            gopls
            air

            # Rust (agent)
            rustToolchain

            # Node.js (frontend)
            nodejs_20

            # Araçlar
            gnumake
            git
            curl
            jq
            openssl
          ];

          shellHook = ''
            echo "nanonet dev shell hazır"

            # .env yoksa örneği kopyala
            if [ ! -f .env ]; then
              cp .env.example .env
              echo ".env oluşturuldu — JWT_SECRET ve CLAUDE_API_KEY doldurmayı unutma"
            fi

            # Docker daemon çalışıyor mu?
            if ! docker info &>/dev/null; then
              echo "UYARI: Docker daemon çalışmıyor — 'sudo systemctl start docker' çalıştır"
            fi
          '';
        };
      });
}
