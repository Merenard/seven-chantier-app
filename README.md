# SEVEN Chantier

Application web responsive pour preparer des dossiers d'execution par chantier de maison individuelle.

La V1 permet de:

- creer et suivre des chantiers;
- importer des plans PDF et documents techniques;
- organiser les acces par chantier et par role;
- suivre les checklists par corps d'etat;
- generer des dossiers d'execution imprimables en PDF pour chaque artisan.

## Lancer localement

```powershell
node tools/dev-static-server.cjs
```

Puis ouvrir:

```text
http://127.0.0.1:4173/
```

L'application peut aussi etre publiee directement sur GitHub Pages. Voir `04-livraison/deploiement-github-pages.md`.

## Structure du dossier

- `00-cadrage/`: brief initial, questions, reponses et decisions.
- `01-produit/`: specification fonctionnelle, parcours utilisateur, priorisation MVP.
- `02-technique/`: architecture, choix techniques, modele de donnees, securite.
- `03-design/`: direction artistique, UX, wireframes, design system.
- `04-livraison/`: plan de lancement, tests, stores, exploitation.

## Etat actuel

V1 applicative statique creee a la racine:

- `index.html`
- `styles.css`
- `app.js`
- `.nojekyll`
