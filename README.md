# Static site (GitHub Pages)

This folder contains the static site files served locally by `live-server`.

How to publish to GitHub Pages:

1. Initialize git (if not already):

```bash
cd /Users/ivanskuda/my-server/public
git init
git add .
git commit -m "Initial commit for GitHub Pages"
git branch -M main
```

2. Create a repository on GitHub (via the website) and follow the instructions to add the remote, or use `gh` CLI:

```bash
# If using website, after creating repo on github.com
git remote add origin git@github.com:<your-username>/<repo>.git
git push -u origin main

# Or, with GitHub CLI installed and authenticated:
# brew install gh
# gh auth login
# gh repo create <repo> --public --source=. --remote=origin --push
```

3. Enable GitHub Pages in repository Settings → Pages → Source: `main` branch / `/ (root)`. Wait a few minutes — site will be available at:

```
https://<your-username>.github.io/<repo>/
```

Alternatives:
- Use `gh-pages` branch or deploy services (Netlify, Vercel) for automatic deploys.

## Running Ollama locally and exposing to the internet

You can run a local proxy and expose your Ollama instance so the published site can call the model.

1) Start the local proxy (from the `public` folder):

```bash
# starts an express proxy that forwards /api/generate to Ollama
node server.js
```

2) Open a public tunnel (temporary) so GitHub Pages or other remote clients can reach your local proxy:

```bash
# using localtunnel (temporary):
npx localtunnel --port 3000
```

The site also provides a small settings button (⚙) near the status indicator — click it and paste your tunnel URL (for example `https://hungry-rivers-give.loca.lt`). The UI will then use that endpoint for `/api/generate` and `/health`.

3) Run in the background with PM2 (recommended for persistent tunnels):

```bash
# install pm2 globally if needed
npm install -g pm2
pm2 start server.js --name ok-server
pm2 start ./start-localtunnel.sh --name ok-tunnel
pm2 save
pm2 startup   # follow printed instructions if you want pm2 to start at boot
```

4) Configuration and security notes

- To point the proxy at a different Ollama host, set `OLLAMA_HOST` before starting the proxy, for example:

```bash
export OLLAMA_HOST="https://your-tunnel-or-host"
node server.js
```

- The tunnel URL is temporary and should be kept private. For production use prefer Cloudflare Tunnel, a hosted inference endpoint, or ngrok with an authtoken and access controls.

- If you change site files, commit and push to the `main` branch; the `gh-pages` branch is already used for publishing the static site. You can use the `gh-pages` branch or `main` + Pages root depending on your preference.
