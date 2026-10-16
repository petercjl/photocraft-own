# PhotoCraft Own

PhotoCraft Own (short name: **pc**) is an independently maintained PhotoCraft desktop and local image-editing capability for Agents. The npm package manages verified native binaries, CLI/MCP sessions, and one portable companion Skill. macOS Apple Silicon and Windows x64 are the initial build targets. Node.js 22+ is required; end users do not need Rust.

## Ask your Agent

Install: “请安装 @petercjl/photocraft-own，并为当前 Agent 安装配套 Skill。”

Update: “请更新 @petercjl/photocraft-own、原生程序和配套 Skill，并检查安装状态。”

Use: “用 pc 调整所附图片的色调。”

Desktop: “请打开 pc 桌面端。”

Troubleshooting: “请检查 pc 的安装和运行状态。”

Local operations need no service login. AI services, external fonts, and their licenses are separate. Installation grants no file access or service access. MCP sessions explicitly scope input and output directories. Existing images are preserved unless their replacement is explicitly authorized.

## Verification and desktop signing

macOS Apple Silicon and Windows x64 have passed native builds, installation, CLI image editing, MCP, update/rollback, and packed npm entry checks. The macOS desktop has also been visually inspected. Windows desktop interaction and live SealSeek conversation invocation remain unverified.

The macOS desktop is ad-hoc signed and is not notarized. The Windows desktop is unsigned. These signing limitations may require operating-system confirmation when launching the desktop.

Development and distribution instructions live in the repository’s `own/dev` directory, outside the npm package. Upstream synchronization uses candidate pull requests and platform checks before promotion.
