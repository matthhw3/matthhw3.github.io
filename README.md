# Matthew Wong portfolio

Static GitHub Pages version of Matthew's hiking portfolio. Includes the animated landscape, project cards, local Ginseng reporting demo, photo gallery, and downloadable résumé.

## Publish
Create a public repository named `matthhw3.github.io`, upload this folder's contents (including `.github`), and use `main` as its branch. In Settings → Pages, select **GitHub Actions**. The included workflow builds and publishes the site on each push to main.

## Edit
- Sentences, experience, education, project descriptions, and links: edit `content.json`. Unspecified sentences use `defaults.json`.
- New cards: add entries to `content.json` → `blocks`, using an existing card as a model. Sections: home, interests, experience, projects, photos, contact. Tech stack is a comma-separated `stack` string.
- Photos: place image files in `photos/`, then add their relative path, unique id, caption, and category (`hiking`, `cooking`, or `travel`) to `photos.json`.
- Résumé: replace `assets/Matthew-Wong-Resume.pdf`.
- Layout: edit `template.html`; styles and browser scripts are in `assets/`.

GitHub Pages is static hosting, so editing and uploads happen through the repository. No login or backend is required for visitors. All demo transactions and dashboard numbers are fictional and run locally in the visitor's browser.

## Preview
Run `npm run build`, then `python3 -m http.server 8000 --directory _site`. Open http://localhost:8000. No npm dependencies are required.
