# Loup Glacé Royale 3D : prototype

Version 3D (three.js) du prototype, rendu pixel art, avec vestiaire de création de personnage. Un seul fichier : `index.html` (logos intégrés).
Ouvrir dans un navigateur récent, mobile ou ordinateur. Connexion internet requise (moteur 3D chargé depuis un CDN).

## Mouvements
| Action | Mobile | Ordinateur |
|---|---|---|
| Courir | pouce gauche (joystick) | ZQSD / WASD / flèches |
| Caméra | pouce droit (glisser) | souris (clic pour verrouiller) |
| Sauter (esquive un loup par le dessus, monte sur les blocs de glace) | bouton Sauter | Espace |
| Glisser (sprint éclair, plus long sur la glace) | bouton Glisser | Maj ou C |
| Lancer chargé (trajectoire affichée, visée assistée) | maintenir LANCER, relâcher | maintenir F ou clic gauche (souris verrouillée) |
| Objet instantané | bouton jaune | E |

## Objets
- Survivant : boule de neige (infinie, ralentit), méga boule ×2 (gèle 3 s), trou-piège (un loup tombe dedans 3 s), filet ×2 (bloque 2,5 s), turbo, dégel-éclair.
- Loup : filet ×2, hurlement (révèle tout le monde), turbo.

## Partenaires
Panneaux : MVP ROOM, J2R, JuL (sources dans `assets/`). L'écran de fin affiche par marque :
vues, secondes à l'écran, objets pris. Autorisation écrite des marques requise avant toute diffusion publique.

## Vestiaire
Avant chaque partie : pseudo (10 caractères), couleur de veste, pantalon, peau, chapeau (bonnet, casquette,
oreilles de lapin, couronne, cheveux), yeux (ronds, joyeux, masque de ski, lunettes), accessoire (écharpe,
cape, sac à dos) et leurs couleurs. Bouton « Hasard ». Le look est gardé sur l'appareil (stockage local).
Un joueur transformé en loup garde son chapeau et son accessoire.
