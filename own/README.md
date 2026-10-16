# PhotoCraft Own

PhotoCraft Own (short name: **pc**) is an independently maintained PhotoCraft desktop and local image-editing capability for Agents. The npm package manages verified native binaries, CLI/MCP sessions, and one portable companion Skill. macOS Apple Silicon and Windows x64 are the initial build targets. Node.js 22+ is required; end users do not need Rust.

## Ask your Agent

Install: “请安装 @petercjl/photocraft-own，并为当前 Agent 安装配套 Skill。”

Update: “请更新 @petercjl/photocraft-own、原生程序和配套 Skill，并检查安装状态。”

Use: “用 pc 调整所附图片的色调。”

Desktop: “请打开 pc 桌面端。”

Troubleshooting: “请检查 pc 的安装和运行状态。”

Local operations need no service login. AI services, external fonts, and their licenses are separate. Installation grants no file access or service access. MCP sessions explicitly scope input and output directories. Existing images are preserved unless their replacement is explicitly authorized.

Global npm installs check stable updates when the desktop or CLI/MCP/serve starts. The package updates its npm manager, pinned native program and existing managed Skills; running sessions defer updates, and offline checks preserve the installed version. Disable or re-enable this through an Agent: “请关闭 pc 的启动自动更新。” / “请开启 pc 的启动自动更新。” Development checkouts and non-global installations do not self-update.

## Verification and desktop signing

macOS Apple Silicon and Windows x64 have passed native builds, installation, CLI image editing, MCP, update/rollback, and packed npm entry checks. The macOS desktop has also been visually inspected. Host mapping, desktop bridge/UI coverage and clean-context Agent routing are separate evidence categories; verify the actual host and operation before claiming them supported by these protocol checks.

The macOS desktop is ad-hoc signed and is not notarized. The Windows desktop is unsigned. These signing limitations may require operating-system confirmation when launching the desktop.

Development and distribution instructions live in the repository’s `own/dev` directory, outside the npm package. Upstream synchronization uses candidate pull requests and platform checks before promotion.

## Release lifecycle

The canonical [companion Skill](skills/photocraft-own/SKILL.md) is the Agent operating manual for CLI/MCP. Its main line covers probing, surface selection, discovery, execution/recovery and verification; on-demand query routes explain session ownership, scope, batches, fonts and Smart Objects. Runtime use needs the bundled manual and installed-version discovery, rather than contributor/API documents. Applications retain artistic and business decisions.

The npm manager version and immutable native program version are independent. A manager or Skill patch can bind the same verified native release. `update check` reports both update types; unchanged program updates transfer zero native bytes, preserve headless mode and retain the active state and running desktop.

The committed `native-release.json` records the native input fingerprint, classification policy, compatibility contract, original source commit, successful platform QA run, and exact published manifest. Ordinary reuse verifies that proof against npm and GitHub; it does not depend on expiring Actions artifacts. Unknown/native inputs or missing proof require full native QA; explicit manager mode refuses unverified reuse. Both paths verify package installation and real CLI/MCP operations on macOS Apple Silicon and Windows x64.

Publish using npm-release-kit and the committed OIDC workflow. `auto` selects the path; `manager` requires valid reuse; `native` forces a new program version. `runtime_version` can explicitly select the native version independently of the npm manager. `verified_run` is reserved for recovering a failed publication, with successful native QA and unchanged native inputs. The existing content-addressed npm payload transport is retained.
