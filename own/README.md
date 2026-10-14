# PhotoCraft Own

An independently maintained PhotoCraft desktop and local image-editing capability for Agents. The npm package manages verified native binaries, CLI/MCP sessions, and one portable companion Skill. macOS Apple Silicon and Windows x64 are the initial build targets. Node.js 22+ is required; end users do not need Rust.

## Ask your Agent

Install: “请安装 @petercjl/photocraft-own，并为当前 Agent 安装配套 Skill。”

Update: “请更新 @petercjl/photocraft-own、原生程序和配套 Skill，并检查安装状态。”

Use: “用 PhotoCraft Own 调整所附图片的色调，保存为新文件。”

Desktop: “请打开 PhotoCraft Own 桌面端。”

Troubleshooting: “请检查 PhotoCraft Own 的安装和运行状态。”

Local operations need no service login. AI services, external fonts, and their licenses are separate. Installation grants no file access or service access. MCP sessions explicitly scope input and output directories. Existing images are preserved unless their replacement is explicitly authorized.

## Development status

This is an unpublished prerelease under development. macOS native builds and local integration tests are being validated. Windows and SealSeek remain pending runtime verification. Developer builds are ad-hoc signed on macOS; notarization and Windows signing remain release prerequisites for frictionless public desktop distribution.

Development and distribution instructions live in the repository’s `own/dev` directory, outside the npm package. Upstream synchronization uses candidate pull requests and platform checks before promotion.
