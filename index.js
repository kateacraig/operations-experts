// ===================================
// Operations Experts Podcast RSS Feed Handler
// VERSION 3 - FIXED EPISODE IMAGES
// ===================================

const RSS_FEED_URL = "https://anchor.fm/s/105eedd50/podcast/rss";
const EPISODES_TO_SHOW = 10;

// Method 1: Using RSS2JSON API - Now extracts images properly
async function fetchPodcastEpisodesRSS2JSON() {
  try {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
      RSS_FEED_URL
    )}&count=${EPISODES_TO_SHOW}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch RSS feed via RSS2JSON");
    }

    const data = await response.json();

    if (data.status !== "ok") {
      throw new Error("RSS2JSON returned error status");
    }

    // Get channel image as fallback
    const channelImage = data.feed?.image || "Website_Header.png";

    const episodes = data.items.map((item) => {
      // Try multiple sources for episode image
      let episodeImage = null;

      // 1. Try thumbnail (RSS2JSON extracts iTunes image here)
      if (item.thumbnail && item.thumbnail !== "") {
        episodeImage = item.thumbnail;
      }

      // 2. Try enclosure link (if it's an image)
      if (!episodeImage && item.enclosure?.link) {
        const enclosureUrl = item.enclosure.link;
        const enclosureType = item.enclosure.type || "";
        if (enclosureType.includes("image")) {
          episodeImage = enclosureUrl;
        }
      }

      // 3. Check if there's an image in content
      if (!episodeImage && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) {
          episodeImage = imgMatch[1];
        }
      }

      // 4. Fallback to channel image
      if (!episodeImage) {
        episodeImage = channelImage;
      }

      return {
        title: item.title || "Untitled Episode",
        description: item.description || item.content || "",
        pubDate: item.pubDate || "",
        link: item.link || item.guid || "#",
        image: episodeImage,
        duration: item.itunes?.duration || "",
        guid: item.guid || item.link,
      };
    });

    console.log("Successfully fetched episodes via RSS2JSON:", episodes.length);
    console.log("Sample episode image:", episodes[0]?.image);
    return episodes;
  } catch (error) {
    console.error("RSS2JSON method failed:", error);
    return null;
  }
}

// Method 2: Using AllOrigins with proper iTunes namespace parsing
async function fetchPodcastEpisodesAllOrigins() {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
      RSS_FEED_URL
    )}`;
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error("Failed to fetch via AllOrigins proxy");
    }

    const data = await response.json();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.contents, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("XML parsing error");
    }

    // Get channel image as fallback
    let channelImage = null;

    // Try iTunes channel image first
    const itunesChannelImage = xmlDoc.getElementsByTagNameNS(
      "http://www.itunes.com/dtds/podcast-1.0.dtd",
      "image"
    );
    if (itunesChannelImage.length > 0) {
      channelImage = itunesChannelImage[0].getAttribute("href");
    }

    // Fallback to regular channel image
    if (!channelImage) {
      const regularImage = xmlDoc.querySelector("channel > image > url");
      channelImage = regularImage?.textContent || "Website_Header.png";
    }

    const items = xmlDoc.querySelectorAll("item");
    const episodes = [];

    items.forEach((item, index) => {
      if (index < EPISODES_TO_SHOW) {
        let episodeImage = null;

        // 1. Try iTunes episode image (most common for Anchor)
        const itunesImage = item.getElementsByTagNameNS(
          "http://www.itunes.com/dtds/podcast-1.0.dtd",
          "image"
        );
        if (itunesImage.length > 0) {
          episodeImage = itunesImage[0].getAttribute("href");
        }

        // 2. Try enclosure if it's an image
        if (!episodeImage) {
          const enclosure = item.querySelector("enclosure");
          if (enclosure) {
            const enclosureUrl = enclosure.getAttribute("url");
            const enclosureType = enclosure.getAttribute("type") || "";
            if (enclosureType.includes("image")) {
              episodeImage = enclosureUrl;
            }
          }
        }

        // 3. Try media:content or media:thumbnail
        if (!episodeImage) {
          const mediaContent = item.getElementsByTagNameNS(
            "http://search.yahoo.com/mrss/",
            "content"
          );
          if (mediaContent.length > 0) {
            episodeImage = mediaContent[0].getAttribute("url");
          }

          if (!episodeImage) {
            const mediaThumbnail = item.getElementsByTagNameNS(
              "http://search.yahoo.com/mrss/",
              "thumbnail"
            );
            if (mediaThumbnail.length > 0) {
              episodeImage = mediaThumbnail[0].getAttribute("url");
            }
          }
        }

        // 4. Fallback to channel image
        if (!episodeImage) {
          episodeImage = channelImage;
        }

        const episode = {
          title: item.querySelector("title")?.textContent || "Untitled Episode",
          description: item.querySelector("description")?.textContent || "",
          pubDate: item.querySelector("pubDate")?.textContent || "",
          link:
            item.querySelector("link")?.textContent ||
            item.querySelector("guid")?.textContent ||
            "#",
          image: episodeImage,
          duration:
            item.getElementsByTagNameNS(
              "http://www.itunes.com/dtds/podcast-1.0.dtd",
              "duration"
            )[0]?.textContent || "",
          guid: item.querySelector("guid")?.textContent || "",
        };

        episodes.push(episode);
      }
    });

    console.log(
      "Successfully fetched episodes via AllOrigins:",
      episodes.length
    );
    console.log("Sample episode image:", episodes[0]?.image);
    return episodes;
  } catch (error) {
    console.error("AllOrigins method failed:", error);
    return null;
  }
}

// Main fetch function with fallbacks
async function fetchPodcastEpisodes() {
  console.log("Starting podcast episode fetch with image extraction...");

  // Try RSS2JSON first (most reliable for images)
  let episodes = await fetchPodcastEpisodesRSS2JSON();
  if (episodes && episodes.length > 0) {
    return episodes;
  }

  console.log(
    "RSS2JSON failed, trying AllOrigins proxy with iTunes namespace..."
  );

  // Try AllOrigins proxy with proper namespace handling
  episodes = await fetchPodcastEpisodesAllOrigins();
  if (episodes && episodes.length > 0) {
    return episodes;
  }

  console.error("All fetch methods failed");
  return [];
}

// Function to format date
function formatDate(dateString) {
  try {
    const options = { year: "numeric", month: "long", day: "numeric" };
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return "Recently";
    }

    return date.toLocaleDateString("en-US", options);
  } catch (error) {
    return "Recently";
  }
}

// Function to strip HTML tags from description
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// Function to truncate text
function truncateText(text, maxLength = 200) {
  const cleanText = stripHtml(text);
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substr(0, maxLength).trim() + "...";
}

// Function to check if episode is new (within last 7 days)
function isNewEpisode(pubDate) {
  try {
    const episodeDate = new Date(pubDate);
    const now = new Date();
    const daysDiff = (now - episodeDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7 && daysDiff >= 0;
  } catch (error) {
    return false;
  }
}

// Function to validate and fix image URL
function getValidImageUrl(imageUrl) {
  // If no image or invalid URL, return fallback
  if (!imageUrl || imageUrl === "") {
    return "Website_Header.png";
  }

  // If it's already a full URL, use it
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  // If it's a relative path, return fallback
  return "Website_Header.png";
}

// Function to render episodes
function renderEpisodes(episodes) {
  const container = document.getElementById("episodes-container");

  if (!container) {
    console.error("Episodes container not found!");
    return;
  }

  if (episodes.length === 0) {
    container.innerHTML = `
            <div class="loading">
                <p>Unable to load episodes at this time.</p>
                <p>Please visit our <a href="https://open.spotify.com/show/00IlbNyMAOiWGj5lBHCm7H" target="_blank">Spotify page</a> to listen.</p>
            </div>
        `;
    return;
  }

  container.innerHTML = "";

  episodes.forEach((episode, index) => {
    const episodeCard = document.createElement("div");
    episodeCard.className = "episode-card";

    const isNew = isNewEpisode(episode.pubDate);
    const validImageUrl = getValidImageUrl(episode.image);

    episodeCard.innerHTML = `
            <img src="${validImageUrl}" 
                 alt="${episode.title}" 
                 class="episode-image" 
                 loading="lazy"
                 onerror="this.src='Website_Header.png'; this.onerror=null;">
            <div class="episode-content">
                <div>
                    <div class="episode-date">${formatDate(
                      episode.pubDate
                    )}</div>
                    <h3 class="episode-title">
                        ${episode.title}
                        ${isNew ? '<span class="new-badge">NEW</span>' : ""}
                    </h3>
                    <p class="episode-description">${truncateText(
                      episode.description,
                      200
                    )}</p>
                </div>
                <a href="${
                  episode.link
                }" class="episode-button" target="_blank" rel="noopener noreferrer">
                    VIEW EPISODE
                </a>
            </div>
        `;

    container.appendChild(episodeCard);
  });

  console.log(`Successfully rendered ${episodes.length} episodes with images`);
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded, initializing Operations Experts podcast feed...");

  const container = document.getElementById("episodes-container");
  if (!container) {
    console.error("Episodes container element not found in DOM");
    return;
  }

  // Show loading state
  container.innerHTML = '<div class="loading">Loading episodes...</div>';

  try {
    const episodes = await fetchPodcastEpisodes();
    renderEpisodes(episodes);
  } catch (error) {
    console.error("Fatal error loading episodes:", error);
    container.innerHTML = `
            <div class="loading">
                <p>Unable to load episodes. Please try refreshing the page.</p>
                <p><a href="https://open.spotify.com/show/00IlbNyMAOiWGj5lBHCm7H" target="_blank">Listen on Spotify</a></p>
            </div>
        `;
  }
});

// Export for WordPress/testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fetchPodcastEpisodes,
    renderEpisodes,
    formatDate,
    truncateText,
    isNewEpisode,
    getValidImageUrl,
  };
}
