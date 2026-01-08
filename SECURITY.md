# Zeeb Game - Security & Access Control

## Bot and Crawler Blocking

### robots.txt
Location: `Public/robots.txt`

All search engines and crawlers are blocked from indexing this site. The file explicitly denies access to:
- All user agents (wildcard block)
- Major search engines: Googlebot, Bingbot, DuckDuckBot, Baiduspider, YandexBot, etc.
- AI crawlers: GPTBot, ChatGPT-User, CCBot, anthropic-ai, Claude-Web, Bytespider
- SEO tools: AhrefsBot, MJ12bot, SemrushBot
- Archive bots: ia_archiver, archive.org_bot

### Why Block Everything
This is a private game not intended for public search indexing.

---

## Route Protection (netlify.toml)

### Whitelist Approach
Only explicitly defined routes serve content. All undefined routes return 404.

### Allowed Routes
| Path | Purpose |
|------|---------|
| `/` | Homepage (index.html) |
| `/level2/*` | Level 2 game files |
| `/level3/*` | Level 3 game files |
| `/level4/*` | Level 4 game files |
| `/start/*` | Start screen |
| `/zeeb-show/*` | Zeeb Show episodes |
| `/img/*` | Image assets |
| `/audio/*` | Audio assets |
| `/game.js`, `/styles.css`, `/stars.js` | Root game files |
| `/manifest.json` | PWA manifest |
| `/robots.txt` | Bot instructions |

### Everything Else → 404
Any path not explicitly whitelisted returns `404.html`.

This prevents:
- WordPress vulnerability probes (`/wp-admin/*`, `/wp-login.php`, etc.)
- Common attack paths (`/admin/*`, `/phpmyadmin/*`, `/.env`, `/.git/*`)
- Random URL guessing
- Serving game content to invalid paths

---

## 404 Page
Location: `Public/404.html`

Custom 404 page with:
- `noindex, nofollow` meta tag
- Robotic/space theme matching the game aesthetic
- Proper 404 HTTP status code

---

## Updates
- **2026-01-07**: Initial security setup - robots.txt, whitelist routing, 404 page
