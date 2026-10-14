//! Identity of the optional independently distributed desktop build.
pub const IS_OWN: bool = cfg!(feature = "own");
pub const TITLE: &str = if IS_OWN { "PhotoCraft Own" } else { "PhotoCraft" };
pub const APP_ID: &str = if IS_OWN { "dev.petercjl.photocraft-own" } else { "ai.storyteller.photocraft" };
pub const REPOSITORY: &str = "https://github.com/petercjl/photocraft-own";

#[cfg(test)]
mod tests {
    #[test]
    fn optional_identity_does_not_alias_the_official_app() {
        if super::IS_OWN {
            assert_eq!(super::TITLE, "PhotoCraft Own");
            assert_eq!(super::APP_ID, "dev.petercjl.photocraft-own");
        } else {
            assert_eq!(super::TITLE, "PhotoCraft");
            assert_eq!(super::APP_ID, "ai.storyteller.photocraft");
        }
    }
}
