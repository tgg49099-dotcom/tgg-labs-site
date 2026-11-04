# Tgg Labs — vitrine

Site statique de Tgg Labs : HTML + CSS, **sans dépendance et sans build**.
On peut ouvrir `index.html` directement dans un navigateur, ou le servir tel quel.

- `index.html` — la page d'accueil : les 2 plugins JetBrains et les 7 produits Gumroad,
  chacun avec son lien vers la fiche où il est réellement publié.
- `<produit>.html` — une page par produit : ce qu'il fait, pour qui, son prix, ses limites.
- `style.css` — la seule feuille de style (aucune police distante, aucun CDN).
- `media/` — les captures d'écran (projet de démonstration, aucun compte, aucun secret).
- `CNAME` — le domaine personnalisé `labs.chiffreo.ch` (le site est donc servi à cette
  adresse, et non sous `tgg49099-dotcom.github.io`).

## Mettre en ligne

```bash
git clone https://github.com/tgg49099-dotcom/tgg-labs-site.git
cd tgg-labs-site
# ... remplacer les fichiers ...
git add -A && git commit -m "vitrine"
git push origin main
```

GitHub Pages est déjà activé sur ce dépôt (`main` / racine) : le push suffit, il n'y a
rien à cocher dans les réglages.

## Règles de contenu

- un lien par produit et par page : jamais deux liens vers la même fiche ;
- aucun chiffre qui n'a pas été mesuré ;
- pas de capture d'écran contenant un compte, un jeton ou une URL privée ;
- pas de promesse de conformité, pas de faux avis, pas de chiffre inventé.

Contrôle : `python3 -I /work/vitrine-outils/controle_vitrine.py` (hors dépôt).
