import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const SKILLNAAV_TAB_TITLE = "Skill Naav - Navigate Your Skills";
const FAVICON_VERSION = "20260401";
const buildAssetPath = (fileName) =>
  `${process.env.PUBLIC_URL}/${fileName}?v=${FAVICON_VERSION}`;

export const SKILLNAAV_FAVICON_PATH = buildAssetPath("favicon-32x32.png");
export const SKILLNAAV_FAVICON_16_PATH = buildAssetPath("favicon-16x16.png");
export const SKILLNAAV_FAVICON_32_PATH = buildAssetPath("favicon-32x32.png");
export const SKILLNAAV_FAVICON_192_PATH = buildAssetPath("favicon-192x192.png");
export const SKILLNAAV_FAVICON_512_PATH = buildAssetPath("favicon-512x512.png");
export const SKILLNAAV_APPLE_TOUCH_ICON_PATH = buildAssetPath("apple-touch-icon.png");
export const SKILLNAAV_SHORTCUT_ICON_PATH = buildAssetPath("favicon.ico");
const MANAGED_FAVICON_ATTR = "data-skillnaav-favicon";

const FAVICON_LINKS = [
  {
    key: "icon-16",
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: SKILLNAAV_FAVICON_16_PATH,
  },
  {
    key: "icon-32",
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: SKILLNAAV_FAVICON_32_PATH,
  },
  {
    key: "icon-192",
    rel: "icon",
    type: "image/png",
    sizes: "192x192",
    href: SKILLNAAV_FAVICON_192_PATH,
  },
  {
    key: "icon-512",
    rel: "icon",
    type: "image/png",
    sizes: "512x512",
    href: SKILLNAAV_FAVICON_512_PATH,
  },
  {
    key: "shortcut-icon",
    rel: "shortcut icon",
    type: "image/x-icon",
    href: SKILLNAAV_SHORTCUT_ICON_PATH,
  },
  {
    key: "apple-touch-icon",
    rel: "apple-touch-icon",
    type: "image/png",
    sizes: "180x180",
    href: SKILLNAAV_APPLE_TOUCH_ICON_PATH,
  },
];

const FAVICON_RELS = new Set(["icon", "shortcut icon", "apple-touch-icon"]);

const upsertLinkTag = ({ key, ...attributes }) => {
  let link = document.head.querySelector(
    `link[${MANAGED_FAVICON_ATTR}="${key}"]`
  );

  if (!link) {
    link = document.createElement("link");
    document.head.appendChild(link);
  }

  link.setAttribute(MANAGED_FAVICON_ATTR, key);

  Object.entries(attributes).forEach(([attribute, value]) => {
    if (value) {
      link.setAttribute(attribute, value);
    } else {
      link.removeAttribute(attribute);
    }
  });

  return link;
};

const isFaviconLink = (node) => {
  if (!(node instanceof HTMLLinkElement)) {
    return false;
  }

  const rel = (node.getAttribute("rel") || "").toLowerCase().trim();
  return FAVICON_RELS.has(rel);
};

const getExpectedLinkConfig = (link) => {
  const key = link.getAttribute(MANAGED_FAVICON_ATTR);
  return FAVICON_LINKS.find((faviconLink) => faviconLink.key === key);
};

const linkMatchesExpectedConfig = (link) => {
  const expected = getExpectedLinkConfig(link);

  if (!expected) {
    return false;
  }

  return Object.entries(expected).every(([attribute, value]) => {
    if (attribute === "key") {
      return true;
    }

    return link.getAttribute(attribute) === value;
  });
};

export const applySkillnaavFavicon = () => {
  document.head
    .querySelectorAll("link[rel]")
    .forEach((link) => {
      if (isFaviconLink(link) && !link.hasAttribute(MANAGED_FAVICON_ATTR)) {
        link.remove();
      }
    });

  FAVICON_LINKS.forEach((faviconLink) => {
    upsertLinkTag(faviconLink);
  });
};

export const getSkillnaavPageTitle = (pageTitle) =>
  pageTitle ? `${pageTitle} | Skill Naav` : SKILLNAAV_TAB_TITLE;

export const useSkillnaavFavicon = () => {
  const location = useLocation();

  useEffect(() => {
    applySkillnaavFavicon();
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const restoreFavicon = () => {
      applySkillnaavFavicon();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        restoreFavicon();
      }
    };

    const observer = new MutationObserver((mutations) => {
      const needsRestore = mutations.some((mutation) => {
        if (mutation.type === "attributes") {
          return (
            isFaviconLink(mutation.target) &&
            !linkMatchesExpectedConfig(mutation.target)
          );
        }

        if (mutation.type === "childList") {
          const addedOrRemovedNodes = [
            ...mutation.addedNodes,
            ...mutation.removedNodes,
          ];

          return addedOrRemovedNodes.some((node) => {
            if (!isFaviconLink(node)) {
              return false;
            }

            if (!node.hasAttribute(MANAGED_FAVICON_ATTR)) {
              return true;
            }

            return !linkMatchesExpectedConfig(node);
          });
        }

        return false;
      });

      if (needsRestore) {
        window.requestAnimationFrame(restoreFavicon);
      }
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel", "sizes", "type"],
    });

    window.addEventListener("pageshow", restoreFavicon);
    window.addEventListener("focus", restoreFavicon);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", restoreFavicon);
      window.removeEventListener("focus", restoreFavicon);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);
};

const useSkillnaavTabBranding = (pageTitle) => {
  const location = useLocation();

  useEffect(() => {
    document.title = getSkillnaavPageTitle(pageTitle);
    applySkillnaavFavicon();
  }, [location.pathname, location.search, location.hash, pageTitle]);
};

export default useSkillnaavTabBranding;
