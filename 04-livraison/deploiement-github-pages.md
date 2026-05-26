# Deploiement GitHub Pages - SEVEN Chantier

## Etat de la V1

L'application est une V1 statique, deployable sur GitHub Pages:

- `index.html`: interface principale.
- `styles.css`: responsive desktop/mobile.
- `app.js`: logique chantiers, corps d'etat, import PDF, checklists et generation imprimable.
- `.nojekyll`: force GitHub Pages a servir les fichiers tels quels.

## Publication

1. Creer un depot GitHub.
2. Pousser le dossier `seven-group-app` dans ce depot.
3. Dans GitHub, ouvrir `Settings > Pages`.
4. Choisir `Deploy from a branch`.
5. Source: branche `main`, dossier `/root`.
6. Enregistrer puis attendre la publication.

L'URL attendue est de type:

```text
https://<compte-github>.github.io/<nom-du-repo>/
```

## Test local

Depuis le dossier du projet:

```powershell
node tools/dev-static-server.cjs
```

Puis ouvrir:

```text
http://127.0.0.1:4173/
```

## Point important sur les acces

GitHub Pages publie une application statique. La V1 permet de modeliser les roles et les acces par chantier dans l'interface, mais elle ne protege pas reellement les donnees par utilisateur.

Pour un usage chantier reel avec artisans, administratifs et droits par chantier, il faudra ajouter un backend d'authentification et de stockage:

- Supabase: authentification, base Postgres, stockage PDF, droits par chantier.
- Firebase: authentification, Firestore, stockage PDF, droits par chantier.
- Ou API maison: Node/NestJS, PostgreSQL, stockage S3 compatible.

## Roadmap technique recommandee

1. Garder GitHub Pages pour l'interface front.
2. Ajouter Supabase Auth pour comptes utilisateurs.
3. Creer les tables `projects`, `members`, `documents`, `trade_checklists`, `execution_exports`.
4. Stocker les PDF sources dans un bucket prive.
5. Generer les PDF d'execution cote serveur pour avoir un fichier partageable et historise.
6. Ajouter un journal d'audit: import, validation, generation, modification checklist, levee reserve.
