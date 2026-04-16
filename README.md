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
