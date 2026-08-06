# V169 Clean Staging Foundation

This staging environment is rebuilt from scratch. It does not load the root `style.css` or root `script.js`.

## Architecture
- One CSS file per section.
- One JavaScript controller per section.
- Shared copy lives in `content/site-copy.json`.
- Root fonts and media are referenced but not duplicated.
- Native page scrolling is never intercepted.
- Smooth drift is visual interpolation only.

## Removed from staging
- V160–V168 appended override blocks.
- Duplicate hero splitters and duplicated letter markup.
- Multiple loader generations.
- Vault 111 and Side Quests from Recent Works.
- Legacy timeline logic and proportional progress controls.
- Root stylesheet/script dependencies.

## Rollback
The prior V168 patch remains the rollback source outside this deployment package.
