# Loup Glacé Royale 3D : prototype

Version 3D (three.js) du prototype, rendu doux façon film d’animation (lumière chaude, contre-jour, grands yeux expressifs), avec vestiaire de création de personnage. Un seul fichier : `index.html` (logos intégrés).
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

## Personnages
4 héros construits d'après les dessins fournis : Pépito le clown, Nuage, Ananas, Banano (+ « Crée le tien »).
Les bots jouent ces héros. Les modèles sont faits en code (primitives 3D) : pour atteindre le niveau des dessins,
il faudra des modèles 3D importés (GLB), voir « Suite ».

## Visée
Croix au centre de l'écran, caméra par-dessus l'épaule. La croix devient rouge quand un adversaire est verrouillé ;
sinon la boule part vers le point visé au sol.

## Tirage au sort
Au début de chaque partie, les 2 loups sont tirés au sort. Le joueur a 1 chance sur 4 d'être loup
(réglable : `PLAYER_WOLF_CHANCE`).

## Objets
- Survivant : boule de neige (infinie, ralentit), méga boule ×2 (gèle 3 s), trou-piège (un loup tombe dedans 3 s), filet ×2 (bloque 2,5 s), turbo, dégel-éclair, déguisement.
- Loup : filet ×2, hurlement (révèle tout le monde), turbo.
- **Déguisement** : le coureur se transforme 12 s en sapin, bonhomme de neige ou gros caillou (les mêmes modèles que le décor). Immobile, il est invisible pour les loups ; en bougeant, il se trahit.

## Cadeaux des partenaires
Les cadeaux sont sur des affiches : clouées sur 9 sapins, sur le mur arrière des chalets, en bannière sur 5 lampadaires,
plus 3 grands panneaux. Chaque affiche donne le pouvoir de sa marque dans plus de la moitié des cas :
- **J2R → moto électrique** : 8 s de vitesse ×1,9, logo J2R sur les flancs de la moto.
- **MVP ROOM → force MVP** : 8 s, course façon potion magique (jambes en roue, aura dorée, logo MVP au-dessus de la tête) ; le loup qui touche le coureur est glacé à sa place.
- **JuL → radio** : posée au sol 10 s avec un logo JuL, elle joue un beat original (pas de titre de l'artiste) et repousse les loups à 5 m.

## Décor
Place du village pavée avec grand sapin de Noël illuminé, chemins de neige tassée, bouleaux, clôtures, nuages, relief de la neige, chalets en bois, bonshommes de neige, lampadaires, sucres d'orge, cristaux de glace, trampolines, lacs gelés, blocs de glace, buissons, sapins, rochers, montagnes.

## Partenaires
Panneaux : MVP ROOM, J2R, JuL (sources dans `assets/`). L'écran de fin affiche par marque :
vues, secondes à l'écran, objets pris, pouvoirs utilisés. Autorisation écrite des marques requise avant toute diffusion publique.

## Vestiaire
Avant chaque partie : pseudo, 9 profils tout prêts, couleurs (veste, pantalon, peau, yeux, chaussures), 11 choses sur la tête,
4 styles d'yeux, 6 accessoires dans le dos, 3 petits plus (casque audio, médaille, nœud papillon). Bouton « Hasard ».
Le look est gardé sur l'appareil. Un joueur loup garde son chapeau et ses accessoires.

## Suite : modèles 3D de qualité
Générer un modèle 3D par personnage à partir des dessins (outil image vers 3D type Meshy ou Tripo), le riguer et
l'animer (Mixamo : course, saut, lancer), exporter en GLB, puis le brancher dans le jeu à la place du modèle en code.
