use std::env;
use std::error::Error;
use std::time::Duration;

use reqwest::header::{ACCEPT, AUTHORIZATION, HeaderMap, HeaderValue};
use semver::Version;
use serde::Deserialize;

use super::error;

const API_ACCEPT: &str = "application/vnd.github+json";
const USER_AGENT_VALUE: &str = "choral-forma-self-update";

#[derive(Debug, Clone)]
pub struct Release {
    pub version: Version,
    pub tag: String,
    assets: Vec<Asset>,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubRelease {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    assets: Vec<Asset>,
}

#[derive(Debug, Clone, Deserialize)]
struct Asset {
    name: String,
    state: String,
    browser_download_url: String,
}

impl TryFrom<GithubRelease> for Release {
    type Error = Box<dyn Error>;

    fn try_from(value: GithubRelease) -> Result<Self, Self::Error> {
        if value.draft {
            return Err(error(format!(
                "GitHub Release {} is still a draft",
                value.tag_name
            )));
        }
        let normalized = value.tag_name.strip_prefix('v').ok_or_else(|| {
            error(format!(
                "Forma Release tag {} is not v-prefixed",
                value.tag_name
            ))
        })?;
        let version = Version::parse(normalized).map_err(|source| {
            error(format!(
                "Forma Release tag {} is not valid SemVer: {source}",
                value.tag_name
            ))
        })?;
        Ok(Self {
            version,
            tag: value.tag_name,
            assets: value.assets,
        })
    }
}

impl Release {
    pub fn validate_assets(&self, target_asset: &str) -> Result<(), Box<dyn Error>> {
        self.asset_url(target_asset)?;
        self.asset_url(&format!("{target_asset}.sha256"))?;
        Ok(())
    }

    pub fn asset_url(&self, name: &str) -> Result<&str, Box<dyn Error>> {
        let mut matching = self
            .assets
            .iter()
            .filter(|asset| asset.name == name && asset.state == "uploaded");
        let asset = matching.next().ok_or_else(|| {
            error(format!(
                "Forma Release {} does not contain uploaded asset {}",
                self.tag, name
            ))
        })?;
        if matching.next().is_some() {
            return Err(error(format!(
                "Forma Release {} contains duplicate asset {}",
                self.tag, name
            )));
        }
        let url = reqwest::Url::parse(&asset.browser_download_url)
            .map_err(|source| error(format!("invalid GitHub asset URL for {name}: {source}")))?;
        if url.scheme() != "https"
            || url.host_str() != Some("github.com")
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(error(format!(
                "refusing non-GitHub asset URL for {name}: {}",
                asset.browser_download_url
            )));
        }
        Ok(&asset.browser_download_url)
    }
}

pub struct ReleaseClient {
    repository: String,
    client: reqwest::Client,
    api_headers: HeaderMap,
}

impl ReleaseClient {
    pub fn new(repository: &str) -> Result<Self, Box<dyn Error>> {
        validate_repository(repository)?;
        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static(API_ACCEPT));
        if let Some(token) = env::var_os("GH_TOKEN").or_else(|| env::var_os("GITHUB_TOKEN")) {
            let token = token
                .into_string()
                .map_err(|_| error("GitHub token contains invalid Unicode"))?;
            let authorization = HeaderValue::from_str(&format!("Bearer {token}"))
                .map_err(|source| error(format!("invalid GitHub token header: {source}")))?;
            headers.insert(AUTHORIZATION, authorization);
        }
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT_VALUE)
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 {
                    return attempt.error("too many GitHub Release redirects");
                }
                if attempt.url().scheme() != "https"
                    || !attempt.url().host_str().is_some_and(is_trusted_github_host)
                {
                    return attempt.error("refusing a non-GitHub Release redirect");
                }
                attempt.follow()
            }))
            .timeout(Duration::from_secs(30))
            .build()?;
        Ok(Self {
            repository: repository.to_owned(),
            client,
            api_headers: headers,
        })
    }

    pub async fn exact(&self, version: &Version) -> Result<Release, Box<dyn Error>> {
        let tag = format!("v{version}");
        let url = format!(
            "https://api.github.com/repos/{}/releases/tags/{tag}",
            self.repository
        );
        let response = self
            .client
            .get(url)
            .headers(self.api_headers.clone())
            .send()
            .await?
            .error_for_status()?;
        let release = response.json::<GithubRelease>().await?;
        let release = Release::try_from(release)?;
        if release.version != *version || release.tag != tag {
            return Err(error(format!(
                "GitHub returned Release {} while resolving {tag}",
                release.tag
            )));
        }
        Ok(release)
    }

    pub async fn latest_after(&self, current: &Version) -> Result<Option<Release>, Box<dyn Error>> {
        let url = format!(
            "https://api.github.com/repos/{}/releases?per_page=100",
            self.repository
        );
        let response = self
            .client
            .get(url)
            .headers(self.api_headers.clone())
            .send()
            .await?
            .error_for_status()?;
        let releases = response.json::<Vec<GithubRelease>>().await?;
        Ok(select_latest(releases, current))
    }

    pub async fn download(&self, url: &str) -> Result<Vec<u8>, Box<dyn Error>> {
        let response = self.client.get(url).send().await?.error_for_status()?;
        Ok(response.bytes().await?.to_vec())
    }

    pub async fn download_text(&self, url: &str) -> Result<String, Box<dyn Error>> {
        let response = self.client.get(url).send().await?.error_for_status()?;
        Ok(response.text().await?)
    }
}

fn select_latest(releases: Vec<GithubRelease>, current: &Version) -> Option<Release> {
    let allow_prerelease = !current.pre.is_empty();
    let mut candidates = Vec::new();
    for source in releases {
        if source.draft || (!allow_prerelease && source.prerelease) {
            continue;
        }
        let Ok(release) = Release::try_from(source) else {
            continue;
        };
        if release.version > *current {
            candidates.push(release);
        }
    }
    candidates.sort_by(|left, right| left.version.cmp(&right.version));
    candidates.pop()
}

pub fn validate_repository(repository: &str) -> Result<(), Box<dyn Error>> {
    let mut segments = repository.split('/');
    let owner = segments.next().unwrap_or_default();
    let name = segments.next().unwrap_or_default();
    if owner.is_empty()
        || name.is_empty()
        || matches!(owner, "." | "..")
        || matches!(name, "." | "..")
        || segments.next().is_some()
        || !owner.chars().all(valid_repository_character)
        || !name.chars().all(valid_repository_character)
    {
        return Err(error(format!(
            "invalid GitHub repository identity {repository:?}"
        )));
    }
    Ok(())
}

fn valid_repository_character(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
}

fn is_trusted_github_host(host: &str) -> bool {
    matches!(host, "github.com" | "api.github.com") || host.ends_with(".githubusercontent.com")
}

pub fn target_asset_name() -> Result<&'static str, Box<dyn Error>> {
    target_asset_for(
        std::env::consts::OS,
        std::env::consts::ARCH,
        compiled_target_environment(),
    )
}

fn compiled_target_environment() -> &'static str {
    if cfg!(target_env = "gnu") {
        "gnu"
    } else if cfg!(target_env = "musl") {
        "musl"
    } else if cfg!(target_env = "msvc") {
        "msvc"
    } else {
        ""
    }
}

fn target_asset_for(
    operating_system: &str,
    architecture: &str,
    target_environment: &str,
) -> Result<&'static str, Box<dyn Error>> {
    match (operating_system, architecture, target_environment) {
        ("linux", "x86_64", "gnu" | "") => Ok("forma-linux-x64"),
        ("linux", "aarch64", "gnu" | "") => Ok("forma-linux-arm64"),
        ("macos", "x86_64", _) => Ok("forma-macos-x64"),
        ("macos", "aarch64", _) => Ok("forma-macos-arm64"),
        ("windows", "x86_64", "msvc" | "") => Ok("forma-windows-x64.exe"),
        _ => Err(error(format!(
            "Forma self-update does not publish an asset for {operating_system}-{architecture}-{target_environment}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(name: &str) -> Asset {
        Asset {
            name: name.to_owned(),
            state: "uploaded".to_owned(),
            browser_download_url: format!(
                "https://github.com/choral-io/choral-forma/releases/download/v0.1.29/{name}"
            ),
        }
    }

    #[test]
    fn maps_supported_release_targets_exactly() {
        assert_eq!(
            target_asset_for("linux", "x86_64", "gnu").unwrap(),
            "forma-linux-x64"
        );
        assert_eq!(
            target_asset_for("linux", "aarch64", "gnu").unwrap(),
            "forma-linux-arm64"
        );
        assert_eq!(
            target_asset_for("macos", "x86_64", "").unwrap(),
            "forma-macos-x64"
        );
        assert_eq!(
            target_asset_for("macos", "aarch64", "").unwrap(),
            "forma-macos-arm64"
        );
        assert_eq!(
            target_asset_for("windows", "x86_64", "msvc").unwrap(),
            "forma-windows-x64.exe"
        );
        assert!(target_asset_for("linux", "x86_64", "musl").is_err());
        assert!(target_asset_for("windows", "aarch64", "msvc").is_err());
    }

    #[test]
    fn requires_exact_payload_and_checksum_assets() {
        let target = "forma-windows-x64.exe";
        let release = Release {
            version: Version::new(0, 1, 29),
            tag: "v0.1.29".to_owned(),
            assets: vec![asset(target), asset(&format!("{target}.sha256"))],
        };
        release.validate_assets(target).unwrap();
        assert!(release.asset_url("forma-windows-x64").is_err());
    }

    #[test]
    fn validates_repository_identity() {
        validate_repository("choral-io/choral-forma").unwrap();
        assert!(validate_repository("choral-io").is_err());
        assert!(validate_repository("../choral-forma").is_err());
        assert!(validate_repository("choral-io/choral-forma/extra").is_err());
    }

    #[test]
    fn restricts_release_redirect_hosts() {
        assert!(is_trusted_github_host("github.com"));
        assert!(is_trusted_github_host(
            "release-assets.githubusercontent.com"
        ));
        assert!(!is_trusted_github_host("github.com.example.test"));
        assert!(!is_trusted_github_host("example.test"));
    }

    #[test]
    fn parses_v_prefixed_release_identity() {
        let source = GithubRelease {
            tag_name: "v0.1.29".to_owned(),
            draft: false,
            prerelease: false,
            assets: Vec::new(),
        };
        let release = Release::try_from(source).unwrap();
        assert_eq!(release.version, Version::new(0, 1, 29));
    }

    #[test]
    fn selects_newest_stable_release_for_a_stable_installation() {
        let release = |tag: &str, draft: bool, prerelease: bool| GithubRelease {
            tag_name: tag.to_owned(),
            draft,
            prerelease,
            assets: Vec::new(),
        };
        let selected = select_latest(
            vec![
                release("v0.1.29", false, false),
                release("v0.2.0-beta.1", false, true),
                release("v0.1.30", true, false),
                release("invalid", false, false),
            ],
            &Version::new(0, 1, 28),
        )
        .unwrap();
        assert_eq!(selected.version, Version::new(0, 1, 29));
    }
}
