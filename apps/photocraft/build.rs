//! Windows only: embed the app icon and version info (VERSIONINFO) into `photocraft.exe`.
//!
//! On every other target this does nothing. A missing resource compiler is a warning, so a
//! cross-compile from macOS or Linux still links, unless `PHOTOCRAFT_REQUIRE_WINRES=1` (set by the
//! release workflow) turns it into an error.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../../assets/app-icon/photocraft.ico");
    println!("cargo:rerun-if-env-changed=PHOTOCRAFT_REQUIRE_WINRES");
    println!("cargo:rerun-if-env-changed=PHOTOCRAFT_OWN_VERSION");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }
    let own = cfg!(feature = "own");
    let mut res = winresource::WindowsResource::new();
    res.set_icon("../../assets/app-icon/photocraft.ico")
        .set("ProductName", if own { "PhotoCraft Own" } else { "PhotoCraft" })
        .set("FileDescription", if own { "PhotoCraft Own image editor" } else { "PhotoCraft image editor" })
        .set("CompanyName", if own { "PhotoCraft Own contributors" } else { "Learning Machines LLC" })
        .set("LegalCopyright", "Copyright (c) the PhotoCraft authors. MIT OR Apache-2.0.")
        .set("OriginalFilename", if own { "photocraft-own.exe" } else { "photocraft.exe" })
        .set("InternalName", if own { "photocraft-own" } else { "photocraft" });
    if own && let Ok(version) = std::env::var("PHOTOCRAFT_OWN_VERSION") {
        res.set("ProductVersion", &version);
    }
    if let Err(e) = res.compile() {
        if std::env::var_os("PHOTOCRAFT_REQUIRE_WINRES").is_some() {
            panic!("embedding Windows resources failed: {e}");
        }
        println!("cargo:warning=photocraft.exe built without icon/version resources: {e}");
    }
}
