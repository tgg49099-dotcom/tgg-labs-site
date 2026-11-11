# Tgg Labs — vitrine

Site statique de Tgg Labs : HTML + CSS, **sans dépendance, sans script et sans build**.
On peut ouvrir `index.html` directement dans un navigateur, ou le servir tel quel.

- `index.html` — la page d'accueil (refaite le 11/11/2026) : Standby Atlas, les outils pour
  développeurs (2 plugins JetBrains, l'app Atlassian), les modèles vendus sur Gumroad, les principes.
  Les ancres `#data`, `#jetbrains`, `#gumroad` et `#about` sont utilisées par les autres pages : ne pas les renommer.
- `<produit>.html` — une page par produit : ce qu'il fait, pour qui, son prix, ses limites.
  Garder les classes existantes (`site`, `nav`, `produit`, `fil`, `lead`, `prix`, `shot`, `puces`,
  `limites`, `faits`, `fact`, `src`, `cta`, `btn`, `note`, `site-foot`) : la feuille de style les met en forme.
- `style.css` — la seule feuille de style, partagée par toutes les pages, thème sombre automatique.
- `fonts/` — la police Archivo (licence SIL OFL, `fonts/OFL-Archivo.txt`), servie par le site lui-même.
- `img/` — les images de l'accueil (captures de Standby Atlas et des outils), l'icône et l'image de partage `og.jpg`.
- `favicon.svg` — la marque : un T dont le pied est une colonne ambre, comme les colonnes de la carte de Standby Atlas.
- `media/` — les captures d'écran des pages produit (projet de démonstration, aucun compte, aucun secret).
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
- chaque chiffre de l'accueil porte sa date (« Figures as of… », « Prices as listed on… ») : la mettre à jour avec le chiffre ;
- aucune ressource tierce (police, script, mesure d'audience) : le site ne dépose aucun cookie.

Contrôle : `python3 -I /work/vitrine-outils/controle_vitrine.py` (hors dépôt).
