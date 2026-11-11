# BRUDEL

A fitness, nutrition and recovery tracker anyone can use in their phone's browser.

- **Food database:** Open Food Facts (free, no key), for barcode scans and packaged-food search.
- **AI features:** meal ideas, nutrition-label photos, macro estimates, restaurant food search and supplement lookups, through your own Anthropic API key, kept secret on the server.
- **Friends leagues:** 6-character codes, stored with Netlify Blobs.
- **Personal data** (food, weight, workouts) stays on each person's phone.

## Folder layout

```
site/                   the app (index.html, icons, manifest)
netlify/functions/      server code: ai.mjs, off.mjs, league.mjs
netlify.toml            tells Netlify where everything is
package.json            one dependency (@netlify/blobs)
```

## Settings (Netlify environment variables)

| Name | Required | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes, for AI | Your key from console.anthropic.com |
| `DAILY_LIMIT_PER_PERSON` | No (default 25) | AI requests per person per day |
| `DAILY_LIMIT_TOTAL` | No (default 500) | AI requests for the whole site per day |
| `AI_MODEL` | No (default `claude-haiku-5-5`) | Which Claude model to use |

Without `ANTHROPIC_API_KEY` the app still works; the AI buttons are hidden.

Food data © Open Food Facts contributors, ODbL.
