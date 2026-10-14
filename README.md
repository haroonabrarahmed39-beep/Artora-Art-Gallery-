# ARTORA — Complete Art Gallery

## Requirements
- Node.js 20+ recommended
- npm
- VS Code

## Install
1. Back up your existing `artora.db` before replacing any project files.
2. Put `server.js`, `db.js`, `package.json` in the project root.
3. Put `index.html`, `style.css`, and `script.js` in `public/`.
4. If you already have `artora.db`, keep it in the project root. Do not replace it with another database.
5. In VS Code, open Terminal → New Terminal and run:

   ```bash
   npm install
   npm start
   ```

6. Open http://localhost:3000

For development auto-restart, run `npm run dev`.

## API endpoints
- `GET /api/health` — server health
- `GET /api/artworks` — list artwork; optional `category`, `search`, `page`, `limit`
- `GET /api/artworks/:id` — one artwork
- `GET /api/categories` — categories with counts
- `POST /api/contact` — body: `{ "name": "...", "email": "...", "subject": "...", "message": "..." }`
- `POST /api/subscribe` — body: `{ "email": "..." }`
- `GET /api/favourites/:visitorId` — list saved artwork IDs
- `POST /api/favourites` — body: `{ "visitorId": "...", "artworkId": 1 }`
- `DELETE /api/favourites` — body: `{ "visitorId": "...", "artworkId": 1 }`

## Database safety
`db.js` uses `CREATE TABLE IF NOT EXISTS`, which doesn't replace existing tables. Starter art is inserted only if `artworks` is empty. Because your real schema has not been provided, inspect/backup the database first. If existing table columns differ from the expected schema, update the code to match them before running.

## Notes
- Newsletter subscriptions are stored in SQLite; no emails are sent automatically.
- Contact form submissions are stored in SQLite; no email notifications are sent automatically.
- Favourites are browser-visitor-based, not user-account-based.
- This starter project does not include an admin panel or artwork upload endpoint.
- Before public deployment, add rate limiting, spam protection, HTTPS, and stronger moderation/access controls.
