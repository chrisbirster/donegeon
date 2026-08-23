# Donegeon asset licensing

Donegeon uses the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`) for project-authored source code, documentation, configuration, scripts, and project-specific artwork committed to this repository.

The following project-specific artwork is distributed under `AGPL-3.0-only` by the repository owner and project contributors:

- `web/apps/client/public/images/donegeon-board-city.png`
- `web/apps/client/public/images/cards/deck.png`
- `web/apps/client/public/images/cards/food.png`
- `web/apps/client/public/images/cards/loot-coin.svg`
- `web/apps/client/public/images/cards/modifier.png`
- `web/apps/client/public/images/cards/resource.png`
- `web/apps/client/public/images/cards/task.png`
- `web/apps/client/public/images/cards/villager.png`
- `web/apps/marketing/public/images/donegeon-hero-city.png`
- `DGN-0003-marketing-homepage-refresh:web/apps/marketing/public/images/marketing/board-action.png` (work-in-progress branch artwork)

The same licensing declaration applies to earlier revisions of those project-specific assets that remain reachable in Git history or project branches.

Third-party packages and their own bundled assets retain their upstream licenses and are not relicensed by Donegeon.

## Adding assets

Do not commit third-party fonts, images, audio, icons, templates, or other media unless the repository has the right to redistribute them under terms compatible with Donegeon. If a future asset has attribution requirements or uses a license other than `AGPL-3.0-only`, document its exact path, source, author, and license in this file before merging it.

Generated build output, dependency caches, test recordings, screenshots, and local database files must not be committed unless they are deliberately maintained project artifacts.
