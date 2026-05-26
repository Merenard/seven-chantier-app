const STORAGE_KEY = "seven-chantier-state-v1";
const DB_NAME = "seven-chantier-documents";
const DB_STORE = "pdfs";

const tradeCatalog = [
  {
    id: "pilotage",
    group: "Preparation",
    name: "Pilotage, administratif et securite",
    summary: "Cadrage chantier, autorisations, planning, assurances et interfaces.",
    needs: ["Permis et plans indexes", "Assurances et attestations", "Planning general", "PPSPS si requis"],
    checklist: [
      "Verifier permis de construire, affichage, recours et prescriptions communales.",
      "Constituer le dossier marche avec plans, CCTP, devis signes et limites de prestation.",
      "Controler attestations decennales, RC pro, qualifications et validite des artisans.",
      "Publier le planning general avec jalons: terrassement, fondations, hors d'eau, hors d'air, essais, reception.",
      "Preparer le plan d'installation chantier: acces, stockage, bennes, eau, electricite, base vie.",
      "Ouvrir le registre chantier et le suivi des decisions validees par le maitre d'ouvrage.",
      "Planifier les reunions et diffuser comptes rendus avec actions, responsables et dates limites.",
      "Centraliser DOE, notices, PV d'essais, garanties et fiches techniques au fil de l'eau."
    ],
    interfaces: [
      "Aucun lot ne demarre sans plans indexes et version de reference.",
      "Les changements client sont traces avant commande ou execution."
    ],
    controls: [
      "Dossier administratif complet.",
      "Planning diffuse a tous les intervenants.",
      "Liste des reserves et decisions ouverte."
    ]
  },
  {
    id: "geometre",
    group: "Preparation",
    name: "Geometre et implantation",
    summary: "Bornage, axes, altimetrie, limites et reperes chantier.",
    needs: ["Plan topographique", "Limites cadastrales", "Altimetrie projet", "Plans fondations"],
    checklist: [
      "Verifier bornage et limites separatives avant terrassement.",
      "Implanter axes principaux de la maison, niveaux finis et niveau zero.",
      "Reporter les reculs reglementaires, servitudes, limites de terrassement et acces chantier.",
      "Poser reperes durables hors zone de fouille et communiquer le plan d'implantation.",
      "Controler coherence entre plan masse, plan VRD et plans fondations.",
      "Faire valider les altimetries avant ouverture de fouilles.",
      "Signaler toute incoherence de terrain avant intervention du terrassier."
    ],
    interfaces: [
      "Le terrassier travaille sur axes et niveaux geles.",
      "Le gros oeuvre reprend les reperes pour fondations et dallage."
    ],
    controls: [
      "PV d'implantation disponible.",
      "Reperes visibles et proteges.",
      "Niveau zero confirme."
    ]
  },
  {
    id: "sol",
    group: "Preparation",
    name: "Etude de sol et adaptation fondations",
    summary: "Validation G2, aleas de sol, profondeur hors gel et prescriptions structure.",
    needs: ["Etude G1/G2", "Descente de charges", "Plan fondations", "Niveau nappe connu"],
    checklist: [
      "Verifier presence d'une etude de sol G2 AVP ou G2 PRO avant dimensionnement definitif.",
      "Identifier argiles, remblais, eau, cavites, pente et risques de tassement differentiel.",
      "Faire valider type de fondation par bureau d'etudes structure.",
      "Reporter profondeurs, largeurs, armatures et betons prescrits sur plans d'execution.",
      "Prevoir drainage, protection soubassement ou vide sanitaire selon prescriptions.",
      "Geler les hypothese de plateforme avant chiffrage final terrassement.",
      "Archiver les comptes rendus et avis du BET dans le dossier chantier."
    ],
    interfaces: [
      "Le macon ne coule pas sans avis structure et fond de fouille valide.",
      "Le terrassier adapte les purges et evacuations selon rapport sol."
    ],
    controls: [
      "Rapport sol present.",
      "Plan fondations coherent avec etude.",
      "Visa structure obtenu."
    ]
  },
  {
    id: "terrassement",
    group: "Infrastructure",
    name: "Terrassement, fouilles et plateforme",
    summary: "Acces, decapage, fouilles, remblais, evacuation et plateforme de travail.",
    needs: ["DICT", "Implantation geometre", "Etude de sol", "Plan terrassement"],
    checklist: [
      "Verifier DICT, reseaux existants, acces engins et zones de stockage avant demarrage.",
      "Decaper terre vegetale et stocker separement pour reutilisation exterieure.",
      "Realiser fouilles selon axes, largeurs, profondeurs et niveau hors gel prescrits.",
      "Mettre en securite talus, fouilles et circulations pietonnes.",
      "Controler fond de fouille: portance, eau, remblais, points mous et purge necessaire.",
      "Evacuer deblais non reutilisables vers filiere autorisee avec bons de depot.",
      "Preparer plateforme stable pour maçonnerie, grue ou livraison materiaux.",
      "Proteger fouilles avant coulage si pluie annoncee."
    ],
    interfaces: [
      "Fond de fouille a faire valider avant ferraillage.",
      "Reserver passages VRD si traversées sous dallage prevues."
    ],
    controls: [
      "Niveaux de fouilles controles.",
      "Absence d'eau stagnante.",
      "Photos avant coulage archivees."
    ]
  },
  {
    id: "vrd",
    group: "Infrastructure",
    name: "VRD, raccordements et assainissement",
    summary: "Eaux usees, eaux pluviales, reseaux secs, regards, gaines et attentes.",
    needs: ["Plan VRD", "Cotes fil d'eau", "Reglement assainissement", "Position compteurs"],
    checklist: [
      "Identifier points de raccordement concessionnaires, regards existants et altimetries.",
      "Tracer reseaux EU, EP, AEP, telecom, electricite et gaines en attente.",
      "Respecter pentes, diametres, profondeurs, grillages avertisseurs et distances entre reseaux.",
      "Poser regards de visite, tabourets, siphons disconnecteurs et clapets si requis.",
      "Prevoir fourreaux traversant soubassement avant remblaiement.",
      "Realiser essais d'ecoulement et controle d'etancheite avant fermeture.",
      "Relever positions des reseaux avec photos et plan de recollement.",
      "Proteger attentes pendant le gros oeuvre."
    ],
    interfaces: [
      "Les reservations doivent etre validees avec macon et plombier avant coulage.",
      "Les niveaux exterieurs conditionnent seuils, acces PMR et evacuation des eaux."
    ],
    controls: [
      "Essais d'ecoulement faits.",
      "Photos des tranchees ouvertes.",
      "Plan de recollement disponible."
    ]
  },
  {
    id: "gros-oeuvre",
    group: "Structure",
    name: "Gros oeuvre, fondations et dallage",
    summary: "Semelles, soubassements, dallage, planchers, elevations et chainages.",
    needs: ["Plan structure", "Etude de sol", "Plan architecte", "Plan reservations"],
    checklist: [
      "Verifier fonds de fouille, armatures, enrobages et attentes avant coulage fondations.",
      "Couler beton selon classe, dosage, vibration et conditions meteo prescrites.",
      "Monter soubassements avec arase et coupure capillaire conformes.",
      "Integrer fourreaux, attentes plomberie, electricite, aerations et evacuations avant remblai.",
      "Realiser dallage ou plancher avec isolant, treillis, joints, niveaux et seuils controles.",
      "Monter murs porteurs, poteaux, linteaux, chainages et raidisseurs selon plan structure.",
      "Verifier aplombs, equerrages, dimensions de baies et cotes finies apres chaque niveau.",
      "Proteger ouvrages contre eau, gel et chocs jusqu'au hors d'eau."
    ],
    interfaces: [
      "Les menuiseries exterieures dependent des cotes de baies finies.",
      "Electricien, plombier et chauffagiste valident reservations avant coulage."
    ],
    controls: [
      "PV ferraillage si requis.",
      "Dimensions de baies controlees.",
      "Photos armatures et reservations archivees."
    ]
  },
  {
    id: "charpente",
    group: "Clos couvert",
    name: "Charpente et structure bois",
    summary: "Fermettes ou traditionnelle, ancrages, contreventement et supports couverture.",
    needs: ["Plan charpente", "Note de calcul", "Plan trémies", "Cotes arases"],
    checklist: [
      "Verifier arases, niveaux, dimensions, appuis et ancrages avant livraison charpente.",
      "Controler traitement, sections, entraxes, connecteurs et correspondance avec note de calcul.",
      "Poser charpente selon plan de montage et ordre de contreventement.",
      "Integrer tremies, conduits, chevêtres, debords, supports velux et passages techniques.",
      "Mettre en place contreventements, lisses, anti-flambement et ancrages definitifs.",
      "Verifier aplomb, alignement faitage, debords de toit et points de fixation.",
      "Proteger bois exposes avant couverture."
    ],
    interfaces: [
      "Couvreur intervient apres validation contreventement et support.",
      "Electricien et VMC confirment passages techniques avant fermeture."
    ],
    controls: [
      "Plan de montage respecte.",
      "Ancrages visibles controles.",
      "Tremies conformes."
    ]
  },
  {
    id: "couverture",
    group: "Clos couvert",
    name: "Couverture, zinguerie et etancheite toiture",
    summary: "Ecran sous toiture, tuiles, solins, gouttieres, sorties et points singuliers.",
    needs: ["Plan toiture", "Type couverture", "Details points singuliers", "Sorties techniques"],
    checklist: [
      "Verifier support, pente, ventilation, debords et alignement avant pose.",
      "Poser ecran sous toiture, liteaux, contre-liteaux et fixations selon prescriptions fabricant.",
      "Traiter noues, arêtiers, rives, faitage, solins, abergements et sorties de toit.",
      "Installer gouttieres, descentes EP, naissances et trop-pleins selon plan VRD.",
      "Coordonner sorties VMC, hotte, conduit fumee et panneaux solaires si prevus.",
      "Controler fixation en zones exposees au vent et conformité locale.",
      "Nettoyer toiture, evacuer debris et tester evacuation d'eau."
    ],
    interfaces: [
      "La maison doit etre hors d'eau avant isolation et second oeuvre sensible.",
      "Les sorties techniques sont validees avec CVC, plombier et electricien."
    ],
    controls: [
      "Points singuliers photographies.",
      "Gouttieres raccordees.",
      "Aucune infiltration visible apres pluie."
    ]
  },
  {
    id: "menuiseries-ext",
    group: "Clos couvert",
    name: "Menuiseries exterieures et occultations",
    summary: "Fenêtres, portes, seuils, etancheite a l'air/eau et volets.",
    needs: ["Tableau des menuiseries", "Cotes de baies", "Details seuils", "Coloris valides"],
    checklist: [
      "Verifier cotes tableaux, appuis, seuils, niveaux et sens d'ouverture avant commande definitive.",
      "Controler references, vitrages, performances, coloris, quincailleries et accessoires livres.",
      "Poser menuiseries selon DTU, calage, fixation, compribande et membranes si prevues.",
      "Traiter seuils PMR, rejingots, evacuations d'eau et raccords enduit/bardage.",
      "Installer volets, BSO, coffres, motorisations et attentes electriques.",
      "Regler ouvrants, serrures, butees et verifier absence de frottements.",
      "Proteger vitrages et profils jusqu'aux finitions."
    ],
    interfaces: [
      "Facadier et plaquiste raccordent sur menuiseries posees et protegees.",
      "Electricien raccorde occultations apres essais mecaniques."
    ],
    controls: [
      "Hors d'air obtenu.",
      "Etancheite peripherique verifiee.",
      "PV de reception menuiseries signe."
    ]
  },
  {
    id: "facades",
    group: "Enveloppe",
    name: "Facades, enduits, bardage et ITE",
    summary: "Support, isolant exterieur, enduit, bardage, teintes et details d'etancheite.",
    needs: ["Plan facades", "Teintes validees", "Details soubassement", "Menuiseries posees"],
    checklist: [
      "Verifier support sec, propre, stable, hors gel et compatible avec systeme choisi.",
      "Traiter fissures, points singuliers, angles, tableaux, nez de dalle et soubassements.",
      "Poser isolant exterieur ou ossature bardage selon calepinage et fixations prescrites.",
      "Mettre cornieres, trames, bavettes, appuis, gouttes d'eau et profils de raccord.",
      "Appliquer enduit ou bardage avec conditions meteo compatibles.",
      "Respecter teintes, joints, alignements et transitions avec menuiseries.",
      "Nettoyer protections et controler finitions en lumiere rasante."
    ],
    interfaces: [
      "Les seuils et appuis doivent etre coordonnes avec menuisier et VRD.",
      "Les sorties techniques exterieures sont posees avant finitions definitives."
    ],
    controls: [
      "Teinte validee sur echantillon.",
      "Raccords tableaux propres.",
      "Absence de ponts d'eau visibles."
    ]
  },
  {
    id: "isolation-placo",
    group: "Second oeuvre",
    name: "Isolation interieure, doublages et cloisons",
    summary: "Isolation thermique/acoustique, pare-vapeur, plaques, cloisons et trappes.",
    needs: ["Plans cloisons", "Etude thermique", "Plans reseaux", "Menuiseries posees"],
    checklist: [
      "Verifier maison hors d'eau/hors d'air et supports secs avant isolation.",
      "Controler epaisseurs, resistances thermiques, laine, membranes et traitement acoustique.",
      "Poser ossatures, doublages, cloisons, rails, montants, renforts et trappes selon plans.",
      "Integrer attentes electricite, plomberie, VMC et renforts meubles suspendus avant fermeture.",
      "Traiter continuite pare-vapeur, etancheite a l'air, passages de gaines et raccords menuiseries.",
      "Poser plaques adaptees: hydro en pieces humides, feu/acoustique si requis.",
      "Realiser bandes, poncage, angles et protections avant peinture.",
      "Relever toutes modifications de cloisonnement sur plan."
    ],
    interfaces: [
      "Electricien et plombier doivent avoir passe les reseaux avant fermeture.",
      "Cuisine, sanitaires et rangements necessitent renforts localises."
    ],
    controls: [
      "Test visuel etancheite a l'air.",
      "Renforts photographies.",
      "Cotes pieces finies confirmees."
    ]
  },
  {
    id: "electricite",
    group: "Second oeuvre",
    name: "Electricite CFO/CFA et domotique",
    summary: "Tableau, gaines, prises, eclairage, courants faibles, securite et essais.",
    needs: ["Plan electrique", "Schema tableau", "Choix appareillage", "Plan cuisine"],
    checklist: [
      "Verifier implantation prises, interrupteurs, points lumineux, RJ45, TV, alarme et domotique.",
      "Confirmer hauteurs, zones humides, circuits specialises et besoins cuisine/electromenager.",
      "Passer gaines, boites, pieuvres et attentes avant fermeture cloisons et chapes.",
      "Etiqueter circuits, reperer fourreaux et photographier passages avant rebouchage.",
      "Installer tableau, protections, differentiels, parafoudre si requis et liaison equipotentielle.",
      "Raccorder VMC, PAC, volets, portail, bornes et equipements techniques.",
      "Tester continuite terre, isolement, declenchements, polarite et fonctionnement points.",
      "Fournir schema, consuel si requis et notice utilisateur."
    ],
    interfaces: [
      "Plaquiste ne ferme pas sans validation des gaines et renforts boites.",
      "Cuisiniste, CVC et menuisier occultations confirment puissances et commandes."
    ],
    controls: [
      "Essais electriques traces.",
      "Tableau etiquete.",
      "Dossier consuel pret."
    ]
  },
  {
    id: "plomberie",
    group: "Second oeuvre",
    name: "Plomberie, sanitaires et evacuation",
    summary: "Alimentations, evacuations, nourrices, attentes, essais pression et equipements.",
    needs: ["Plan plomberie", "Plan sanitaires", "Plan cuisine", "Choix appareils"],
    checklist: [
      "Verifier emplacements sanitaires, cuisine, buanderie, ballon, attentes exterieures et adoucisseur.",
      "Passer alimentations, evacuations, nourrices et attentes avant chape et fermeture cloisons.",
      "Respecter diametres, pentes, protections, calorifugeage et traversées coupe-feu si requises.",
      "Installer attentes encastrees avec entraxes, hauteurs et supports adaptes aux appareils.",
      "Realiser essais pression et ecoulement avant rebouchage.",
      "Poser receveurs, bati-supports, baignoire, WC, robinetteries et accessoires selon notices.",
      "Siliconer, regler, tester fuites, siphons, trop-pleins et vidanges.",
      "Fournir plans de reseaux et notices d'entretien."
    ],
    interfaces: [
      "Carreleur valide receveur, etancheite SPEC et niveaux avant faience.",
      "Cuisiniste valide attentes evier, LV, frigo et ilot."
    ],
    controls: [
      "Essai pression archive.",
      "Pentes evacuees testees.",
      "Aucune fuite apres mise en eau."
    ]
  },
  {
    id: "cvc",
    group: "Technique",
    name: "Chauffage, PAC, ECS et plancher chauffant",
    summary: "Production, emission, reseaux, regulation, mise en service et garanties.",
    needs: ["Etude thermique", "Plan chauffage", "Dimensionnement PAC", "Choix regulation"],
    checklist: [
      "Verifier dimensionnement, emplacements unite exterieure, local technique et acoustique.",
      "Positionner nourrices, circulateurs, ballons, evac condensats et alimentations electriques.",
      "Poser plancher chauffant selon calepinage, pas, zones, joints et longueurs de boucles.",
      "Effectuer essai pression du reseau avant coulage chape.",
      "Installer PAC, ballon ECS, radiateurs ou ventilo-convecteurs selon prescriptions.",
      "Parametrer regulation piece par piece, loi d'eau, circulateurs et securites.",
      "Realiser mise en service fabricant et transmettre PV.",
      "Former utilisateur aux modes, entretien et garanties."
    ],
    interfaces: [
      "Chape ne se coule pas sans essai pression plancher chauffant.",
      "Electricien prevoit protections et commandes dediees."
    ],
    controls: [
      "PV essai pression.",
      "PV mise en service.",
      "Regulation testee."
    ]
  },
  {
    id: "vmc",
    group: "Technique",
    name: "Ventilation VMC et qualite d'air",
    summary: "Caisson, bouches, gaines, entrees d'air, detalonnage et mesures.",
    needs: ["Plan VMC", "Etude thermique", "Sorties toiture", "Menuiseries"],
    checklist: [
      "Verifier type VMC, debits, emplacements bouches et cheminements de gaines.",
      "Installer caisson accessible avec alimentation, suspension anti-vibration et evacuation condensats si besoin.",
      "Poser gaines isolees en zones froides, limiter longueurs, coudes et ecrasements.",
      "Coordonner sortie toiture ou facade avec couvreur et facadier.",
      "Prevoir entrees d'air ou transferts selon type de ventilation.",
      "Regler debits cuisine, bains, WC et mesurer si requis.",
      "Verifier detalonnage portes et absence de bruit excessif.",
      "Remettre notice filtres, entretien et schema reseau."
    ],
    interfaces: [
      "Plaquiste garde acces aux trappes et caisson.",
      "Menuisier exterieur confirme entrees d'air compatibles."
    ],
    controls: [
      "Debits verifies.",
      "Caisson accessible.",
      "Condensats traites."
    ]
  },
  {
    id: "chape",
    group: "Finitions techniques",
    name: "Ravoirage, chapes et etancheite sols",
    summary: "Ravoirage, isolants, chape, sechage, niveaux, SPEC et supports revetements.",
    needs: ["Plan niveaux", "Réseaux au sol", "Plancher chauffant teste", "Choix revetements"],
    checklist: [
      "Verifier reseaux au sol poses, photographies et proteges avant ravoirage.",
      "Poser isolants, bandes peripheriques, films, treillis ou fibres selon systeme.",
      "Controler niveaux finis par piece selon epaisseur des futurs revetements.",
      "Couler chape en respectant joints, fractionnements, plancher chauffant sous pression si prevu.",
      "Proteger la chape, gerer sechage, ventilation et delais avant recouvrement.",
      "Mesurer humidite residuelle avant parquet, PVC ou revetement sensible.",
      "Appliquer SPEC/SEL en pieces humides selon plan.",
      "Remettre PV de sechage ou mesure si requis."
    ],
    interfaces: [
      "Carreleur et solier confirment humidite et planéite avant pose.",
      "CVC maintient pression plancher pendant coulage."
    ],
    controls: [
      "Niveaux finis controles.",
      "Humidite mesuree.",
      "Joints respectes."
    ]
  },
  {
    id: "carrelage",
    group: "Finitions",
    name: "Carrelage, faience et etancheite pieces humides",
    summary: "Calepinage, supports, SPEC, receveurs, joints et finitions.",
    needs: ["Choix carrelage", "Plan calepinage", "Supports secs", "Appareils sanitaires"],
    checklist: [
      "Verifier support plan, sec, propre, stable et compatible colle.",
      "Valider calepinage, sens de pose, alignements, coupes visibles et joints.",
      "Controler SPEC/SEL, bandes d'angle et traitement douche avant pose faience.",
      "Poser carrelage avec colle, double encollage si requis, croisillons et respect joints.",
      "Traiter seuils, plinthes, nez de marche, profilés, siphons et pentes douche.",
      "Realiser joints adaptés, silicone sanitaire et nettoyage voile ciment.",
      "Proteger sols jusqu'a reception.",
      "Signaler tout carreau abime ou nuance avant pose massive."
    ],
    interfaces: [
      "Plombier pose equipements definitifs apres carrelage et joints secs.",
      "Peintre intervient apres protection et sechage."
    ],
    controls: [
      "Pentes douche testees.",
      "Alignements verifies.",
      "Joints propres et continus."
    ]
  },
  {
    id: "sols",
    group: "Finitions",
    name: "Parquet, sols souples et revetements",
    summary: "Preparation support, humidite, sous-couche, pose et seuils.",
    needs: ["Choix revetements", "Mesure humidite", "Plan seuils", "Niveaux finis"],
    checklist: [
      "Verifier support plan, sec, depoussiere et compatible avec revetement.",
      "Mesurer humidite avant pose parquet, stratifié, PVC ou moquette.",
      "Valider sens de pose, joints de dilatation, seuils, raccords et plinthes.",
      "Poser sous-couche, colle ou clipsage selon notice fabricant.",
      "Traiter decoupes, huisseries, seuils, nez de marche et joints peripheriques.",
      "Proteger revetements jusqu'a reception et limiter charges lourdes.",
      "Nettoyer et remettre notices d'entretien."
    ],
    interfaces: [
      "Peinture doit etre suffisamment avancee avant pose definitive.",
      "Menuiseries interieures et plinthes se coordonnent sur hauteur finie."
    ],
    controls: [
      "Humidite conforme.",
      "Dilatations respectees.",
      "Aucun defaut visible en lumiere naturelle."
    ]
  },
  {
    id: "menuiseries-int",
    group: "Finitions",
    name: "Menuiseries interieures, escaliers et agencements",
    summary: "Blocs-portes, plinthes, placards, escaliers, trappes et quincailleries.",
    needs: ["Plans interieurs", "Cotes finies", "Choix portes", "Plan agencements"],
    checklist: [
      "Verifier cotes finies, aplombs cloisons, niveaux sols et epaisseurs revetements.",
      "Poser huisseries, blocs-portes, galandages, trappes et quincailleries.",
      "Installer escaliers, garde-corps, mains courantes et protections temporaires.",
      "Poser plinthes, habillages, placards, tablettes et agencements selon plans.",
      "Regler jeux, serrures, butees, alignements et finitions chants.",
      "Coordonner avec electricien pour eclairages integrés ou prises dans meubles.",
      "Proteger ouvrages bois jusqu'a reception."
    ],
    interfaces: [
      "Peintre reprend joints et finitions apres pose si prevu.",
      "Solier confirme niveaux avant plinthes et portes."
    ],
    controls: [
      "Portes reglées.",
      "Garde-corps conformes.",
      "Alignements propres."
    ]
  },
  {
    id: "peinture",
    group: "Finitions",
    name: "Peinture, preparation et finitions murales",
    summary: "Supports, impressions, ratissages, couches finales, retouches et nettoyage.",
    needs: ["Choix teintes", "Supports secs", "Niveau de finition", "Protection sols"],
    checklist: [
      "Verifier supports secs, ponces, depoussiérés et eclairage suffisant.",
      "Proteger sols, menuiseries, appareillages, sanitaires et escaliers.",
      "Appliquer impression adaptee aux plaques, enduits, bois ou supports speciaux.",
      "Realiser reprises, ratissage, poncage et niveau de finition attendu.",
      "Appliquer couches de finition selon teintes, pieces humides et resistance demandee.",
      "Controler reprises en lumiere rasante, angles, plafonds et raccords.",
      "Realiser retouches apres pose appareillages et menuiseries.",
      "Nettoyer protections et evacuer dechets propres."
    ],
    interfaces: [
      "Electricien pose appareillage final entre couches ou apres finition selon choix.",
      "Sols finis doivent etre proteges avant interventions tardives."
    ],
    controls: [
      "Teintes conformes.",
      "Pas de trace majeure en lumiere normale.",
      "Retouches traitees."
    ]
  },
  {
    id: "cuisine-sdb",
    group: "Equipements",
    name: "Cuisine, salle de bains et equipements",
    summary: "Pose meubles, plans de travail, appareils, miroirs, accessoires et essais.",
    needs: ["Plans cuisine/SDB", "Attentes validees", "Choix appareils", "Revetements termines"],
    checklist: [
      "Verifier cotes finies, attentes eau/electricite, evacuations et supports avant pose.",
      "Controler livraison meubles, plans de travail, appareils, sanitaires et accessoires.",
      "Poser meubles, caissons, plans, credences, miroirs, parois et accessoires.",
      "Raccorder appareils, robinetteries, siphons, bondes, prises et eclairages integrés.",
      "Siliconer plans, jonctions humides et points sensibles.",
      "Tester eau chaude/froide, evacuations, appareils, plaques, hotte et eclairages.",
      "Regler portes, tiroirs, charnieres et finitions.",
      "Remettre notices, garanties et etiquettes energie."
    ],
    interfaces: [
      "Plombier et electricien valident raccordements definitifs.",
      "Carreleur ou peintre doit avoir livre les supports finis et secs."
    ],
    controls: [
      "Essais equipements faits.",
      "Aucune fuite.",
      "Notices remises."
    ]
  },
  {
    id: "exterieurs",
    group: "Exterieurs",
    name: "Amenagements exterieurs, clotures et acces",
    summary: "Terrasses, allees, seuils, portail, clotures, plantations et gestion des eaux.",
    needs: ["Plan exterieurs", "Niveaux finis", "Plan VRD", "Choix materiaux"],
    checklist: [
      "Verifier niveaux finis, pentes d'evacuation, seuils et acces avant travaux.",
      "Realiser terrasse, allees, stationnement, bordures et supports selon plan.",
      "Installer clotures, portails, motorisations, interphone et boites aux lettres.",
      "Coordonner arrosage, eclairage exterieur, prises et gaines en attente.",
      "Modeler terres, apporter terre vegetale, planter et pailler selon projet.",
      "Verifier que les eaux de surface s'eloignent de la maison.",
      "Nettoyer voirie, acces et abords avant reception."
    ],
    interfaces: [
      "Facadier et VRD doivent avoir termine les raccords sensibles.",
      "Electricien confirme attentes portail, eclairage et interphone."
    ],
    controls: [
      "Pentes exterieures controlees.",
      "Portail teste.",
      "Abords propres."
    ]
  },
  {
    id: "reception",
    group: "Reception",
    name: "Nettoyage, essais, DOE et reception",
    summary: "Essais finaux, nettoyage, levee des reserves, DOE, garanties et livraison.",
    needs: ["Liste reserves", "DOE artisans", "Notices", "PV essais"],
    checklist: [
      "Organiser pre-reception par corps d'etat avec liste de reserves datee.",
      "Tester electricite, plomberie, chauffage, VMC, occultations, menuiseries et equipements.",
      "Verifier finitions, nettoyages, protections retirees et dechets evacues.",
      "Collecter DOE: plans recollement, notices, garanties, PV, attestations et fiches techniques.",
      "Preparer PV de reception avec reserves, delais et responsables.",
      "Planifier levee des reserves et contre-visite.",
      "Remettre cles, codes, telecommandes, contrats entretien et consignes utilisateur.",
      "Archiver dossier final partage au maitre d'ouvrage."
    ],
    interfaces: [
      "Chaque artisan reste responsable de ses reserves jusqu'a levee signee.",
      "Administratif centralise garanties et documents contractuels."
    ],
    controls: [
      "PV reception signe.",
      "DOE complet.",
      "Reserves suivies."
    ]
  }
];

const defaultProjects = [
  {
    id: makeId("project"),
    name: "Maison individuelle - Saint-Remy",
    address: "12 chemin des Acacias, 13210 Saint-Remy-de-Provence",
    surface: "148 m2",
    phase: "Preparation chantier",
    notes: "Maison R+1 avec garage. Plans architecte et etude de sol a importer avant fondations.",
    createdAt: new Date().toISOString(),
    selectedTrades: tradeCatalog.map((trade) => trade.id),
    activeTradeId: "pilotage",
    docs: [],
    members: [
      { id: makeId("member"), email: "architecte@seven-at-home.fr", role: "Architecte", tradeId: "pilotage" },
      { id: makeId("member"), email: "conducteur@entreprise.fr", role: "Administratif", tradeId: "pilotage" }
    ],
    checklistState: {},
    tradeNotes: {}
  }
];

let appState = loadState();
let activePreviewUrl = null;

const views = {
  dashboard: document.getElementById("dashboardView"),
  plans: document.getElementById("plansView"),
  trades: document.getElementById("tradesView"),
  access: document.getElementById("accessView"),
  print: document.getElementById("printView")
};

const pageTitles = {
  dashboard: "Tableau de bord",
  plans: "Plans PDF",
  trades: "Corps d'etat",
  access: "Acces chantier",
  print: "Dossiers PDF"
};

document.addEventListener("DOMContentLoaded", () => {
  bindChrome();
  render();
});

function bindChrome() {
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.getElementById("menuButton").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
  });

  document.getElementById("newProjectButton").addEventListener("click", () => {
    document.getElementById("projectDialog").showModal();
  });

  document.getElementById("projectSelect").addEventListener("change", (event) => {
    setActiveProject(event.target.value);
  });

  document.getElementById("mobileProjectSelect").addEventListener("change", (event) => {
    setActiveProject(event.target.value);
  });

  document.getElementById("roleSelect").addEventListener("change", (event) => {
    appState.role = event.target.value;
    saveState();
    render();
  });

  document.getElementById("printCurrentButton").addEventListener("click", () => {
    const project = getActiveProject();
    const tradeId = project.activeTradeId || "pilotage";
    printTrades([tradeId]);
  });

  document.getElementById("projectForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const project = {
      id: makeId("project"),
      name: String(form.get("name") || "").trim(),
      address: String(form.get("address") || "").trim(),
      surface: String(form.get("surface") || "").trim(),
      phase: String(form.get("phase") || "Preparation chantier"),
      notes: String(form.get("notes") || "").trim(),
      createdAt: new Date().toISOString(),
      selectedTrades: tradeCatalog.map((trade) => trade.id),
      activeTradeId: "pilotage",
      docs: [],
      members: [],
      checklistState: {},
      tradeNotes: {}
    };
    appState.projects.push(project);
    appState.activeProjectId = project.id;
    document.getElementById("projectDialog").close();
    event.currentTarget.reset();
    saveState();
    render();
  });

  document.getElementById("memberForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const project = getActiveProject();
    const form = new FormData(event.currentTarget);
    project.members.push({
      id: makeId("member"),
      email: String(form.get("email") || "").trim(),
      role: String(form.get("role") || "Artisan"),
      tradeId: String(form.get("trade") || "pilotage")
    });
    document.getElementById("memberDialog").close();
    event.currentTarget.reset();
    saveState();
    render();
  });
}

function render() {
  normalizeState();
  renderProjectSelectors();
  renderMemberTradeSelect();
  renderNavigation();
  renderDashboard();
  renderPlans();
  renderTrades();
  renderAccess();
  renderPrintBuilder();
  document.getElementById("roleSelect").value = appState.role;
  document.getElementById("pageTitle").textContent = pageTitles[appState.activeView] || "Tableau de bord";
}

function renderProjectSelectors() {
  const html = appState.projects
    .map((project) => `<option value="${escapeAttr(project.id)}">${escapeHtml(project.name)}</option>`)
    .join("");
  ["projectSelect", "mobileProjectSelect"].forEach((id) => {
    const select = document.getElementById(id);
    select.innerHTML = html;
    select.value = appState.activeProjectId;
  });
}

function renderMemberTradeSelect() {
  const select = document.getElementById("memberTradeSelect");
  select.innerHTML = tradeCatalog
    .map((trade) => `<option value="${escapeAttr(trade.id)}">${escapeHtml(trade.name)}</option>`)
    .join("");
}

function renderNavigation() {
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === appState.activeView);
  });

  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle("active", name === appState.activeView);
  });
}

function renderDashboard() {
  const project = getActiveProject();
  const metrics = getProjectMetrics(project);
  const risky = getRiskCards(project);
  const topTrades = tradeCatalog.slice(0, 8);

  views.dashboard.innerHTML = `
    <div class="grid-12">
      <section class="panel span-8">
        <div class="section-head">
          <div>
            <span class="eyebrow">Chantier actif</span>
            <h2>${escapeHtml(project.name)}</h2>
            <p>${escapeHtml(project.address)} · ${escapeHtml(project.surface)} · ${escapeHtml(project.phase)}</p>
          </div>
          <button class="ghost-button" data-action="open-print" type="button">Dossiers</button>
        </div>
        <div class="metric-grid">
          <article class="metric-card good">
            <span>Avancement checklists</span>
            <strong>${metrics.progress}%</strong>
          </article>
          <article class="metric-card info">
            <span>Lots actifs</span>
            <strong>${project.selectedTrades.length}</strong>
          </article>
          <article class="metric-card warn">
            <span>Plans importes</span>
            <strong>${project.docs.length}</strong>
          </article>
          <article class="metric-card">
            <span>Acces chantier</span>
            <strong>${project.members.length}</strong>
          </article>
        </div>
      </section>

      <section class="panel span-4">
        <div class="section-head">
          <div>
            <span class="eyebrow">Decision chantier</span>
            <h2>Priorites</h2>
          </div>
        </div>
        <div class="risk-list">
          ${risky.map(renderRiskCard).join("")}
        </div>
      </section>

      <section class="panel span-7">
        <div class="section-head">
          <div>
            <span class="eyebrow">Lots maison individuelle</span>
            <h2>Avancement par corps d'etat</h2>
          </div>
          <button class="ghost-button" data-action="open-trades" type="button">Voir tous</button>
        </div>
        <div class="risk-list">
          ${topTrades.map((trade) => renderTradeProgressRow(project, trade)).join("")}
        </div>
      </section>

      <section class="panel span-5">
        <div class="section-head">
          <div>
            <span class="eyebrow">Synthese execution</span>
            <h2>Points a verrouiller</h2>
          </div>
        </div>
        <ul class="handoff-list">
          <li>Reserver tous les passages reseaux avant coulage fondations, dallage et chapes.</li>
          <li>Faire valider cotes de baies avant commande finale des menuiseries exterieures.</li>
          <li>Photographier armatures, gaines, nourrices et renforts avant fermeture.</li>
          <li>Ne pas lancer finitions tant que hors d'eau, hors d'air et sechage supports ne sont pas controles.</li>
        </ul>
      </section>

      <section class="panel span-12">
        <div class="section-head">
          <div>
            <span class="eyebrow">Portefeuille chantiers</span>
            <h2>Chantiers disponibles</h2>
          </div>
          <button class="primary-button" data-action="new-project" type="button">Nouveau chantier</button>
        </div>
        <div class="grid-12">
          ${appState.projects.map((item) => renderProjectCard(item)).join("")}
        </div>
      </section>
    </div>
  `;

  views.dashboard.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => setActiveProject(button.dataset.projectId));
  });
  bindDashboardActions();
}

function bindDashboardActions() {
  views.dashboard.querySelector('[data-action="open-print"]')?.addEventListener("click", () => setView("print"));
  views.dashboard.querySelector('[data-action="open-trades"]')?.addEventListener("click", () => setView("trades"));
  views.dashboard.querySelector('[data-action="new-project"]')?.addEventListener("click", () => {
    document.getElementById("projectDialog").showModal();
  });
}

function renderPlans() {
  const project = getActiveProject();
  const selectedDoc = project.docs.find((doc) => doc.id === appState.selectedDocId) || project.docs[0];
  const docList = project.docs.length
    ? project.docs.map((doc) => renderDocItem(doc, selectedDoc?.id)).join("")
    : `<div class="empty-state">Aucun plan importe pour ce chantier.</div>`;

  views.plans.innerHTML = `
    <div class="grid-12">
      <section class="upload-zone span-5">
        <div class="section-head">
          <div>
            <span class="eyebrow">Import PDF</span>
            <h2>Plans sources</h2>
            <p>Plans architecte, structure, VRD, etude de sol, CCTP ou details techniques.</p>
          </div>
        </div>
        <div class="form-grid">
          <label>
            <span>Type de document</span>
            <select id="docCategory">
              <option>Plans architecte</option>
              <option>Plan structure</option>
              <option>Etude de sol</option>
              <option>Plan VRD</option>
              <option>Plan electricite</option>
              <option>Plan plomberie/CVC</option>
              <option>CCTP</option>
              <option>Autre document chantier</option>
            </select>
          </label>
          <label>
            <span>Lot associe</span>
            <select id="docTrade">
              <option value="all">Tous les corps d'etat</option>
              ${tradeCatalog.map((trade) => `<option value="${escapeAttr(trade.id)}">${escapeHtml(trade.name)}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="field">
          <span>Note chantier</span>
          <input id="docNote" placeholder="Ex: version DCE recue le 26/05/2026" />
        </label>
        <div class="upload-drop">
          <label>
            <span>Selectionner des fichiers PDF</span>
            <input id="pdfInput" type="file" accept="application/pdf,.pdf" multiple />
          </label>
        </div>
        <p class="fine-print">Les PDF restent dans le navigateur de l'appareil. Pour un acces equipe reel, connecter ensuite un stockage securise.</p>
      </section>

      <section class="panel span-7">
        <div class="section-head">
          <div>
            <span class="eyebrow">Documents du chantier</span>
            <h2>${escapeHtml(project.docs.length)} document${project.docs.length > 1 ? "s" : ""}</h2>
          </div>
        </div>
        <div class="doc-list">${docList}</div>
      </section>

      <section class="panel span-12">
        <div class="section-head">
          <div>
            <span class="eyebrow">Apercu</span>
            <h2>${selectedDoc ? escapeHtml(selectedDoc.name) : "Aucun PDF selectionne"}</h2>
          </div>
          ${selectedDoc ? `<button class="ghost-button" data-action="open-doc" data-doc-id="${escapeAttr(selectedDoc.id)}" type="button">Ouvrir</button>` : ""}
        </div>
        <div class="pdf-preview" id="pdfPreview">
          ${selectedDoc ? `<div class="empty-state">Chargement du PDF...</div>` : `<div class="empty-state">Importe un plan pour l'afficher ici.</div>`}
        </div>
      </section>
    </div>
  `;

  document.getElementById("pdfInput").addEventListener("change", handlePdfUpload);
  views.plans.querySelectorAll("[data-select-doc]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.selectedDocId = button.dataset.selectDoc;
      saveState();
      renderPlans();
    });
  });
  views.plans.querySelectorAll("[data-delete-doc]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deletePdfBlob(button.dataset.deleteDoc);
      project.docs = project.docs.filter((doc) => doc.id !== button.dataset.deleteDoc);
      if (appState.selectedDocId === button.dataset.deleteDoc) appState.selectedDocId = null;
      saveState();
      render();
    });
  });
  views.plans.querySelector('[data-action="open-doc"]')?.addEventListener("click", async (event) => {
    const doc = project.docs.find((item) => item.id === event.currentTarget.dataset.docId);
    if (!doc) return;
    const url = await getPdfUrl(doc.id);
    if (url) window.open(url, "_blank", "noopener");
  });

  if (selectedDoc) renderPdfPreview(selectedDoc.id);
}

function renderTrades() {
  const project = getActiveProject();
  const activeTrade = tradeCatalog.find((trade) => trade.id === project.activeTradeId) || tradeCatalog[0];
  project.activeTradeId = activeTrade.id;

  views.trades.innerHTML = `
    <div class="trade-layout">
      <aside class="trade-list" aria-label="Liste des corps d'etat">
        ${tradeCatalog.map((trade) => renderTradeCard(project, trade, trade.id === activeTrade.id)).join("")}
      </aside>
      <section class="trade-detail">
        ${renderTradeDetail(project, activeTrade)}
      </section>
    </div>
  `;

  views.trades.querySelectorAll("[data-trade-id]").forEach((button) => {
    button.addEventListener("click", () => {
      project.activeTradeId = button.dataset.tradeId;
      saveState();
      render();
    });
  });

  views.trades.querySelectorAll("[data-check]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const [tradeId, index] = checkbox.dataset.check.split(":");
      setChecklistItem(project, tradeId, Number(index), checkbox.checked);
      saveState();
      render();
    });
  });

  views.trades.querySelector("[data-trade-note]")?.addEventListener("input", (event) => {
    project.tradeNotes[activeTrade.id] = event.target.value;
    saveState();
  });

  views.trades.querySelector('[data-action="print-trade"]')?.addEventListener("click", () => {
    printTrades([activeTrade.id]);
  });
}

function renderAccess() {
  const project = getActiveProject();
  const members = project.members.length
    ? project.members.map((member) => renderMemberItem(member)).join("")
    : `<div class="empty-state">Aucun acces ajoute pour ce chantier.</div>`;

  views.access.innerHTML = `
    <div class="grid-12">
      <section class="panel span-7">
        <div class="section-head">
          <div>
            <span class="eyebrow">Equipe chantier</span>
            <h2>Acces par personne</h2>
          </div>
          <button class="primary-button" data-action="add-member" type="button">Inviter</button>
        </div>
        <div class="member-list">${members}</div>
      </section>

      <section class="panel span-5">
        <div class="section-head">
          <div>
            <span class="eyebrow">Permissions</span>
            <h2>Roles disponibles</h2>
          </div>
        </div>
        <div class="risk-list">
          ${renderPermission("Architecte", "Tous les chantiers, plans, checklists, dossiers PDF et acces equipe.", "good")}
          ${renderPermission("Artisan", "Lecture du chantier, plan du lot affecte, checklist du corps d'etat et reserves.", "info")}
          ${renderPermission("Administratif", "Documents, attestations, assurances, comptes rendus, DOE et diffusion.", "warn")}
          ${renderPermission("Maitre d'ouvrage", "Consultation des documents valides, avancement et PV de reception.", "")}
        </div>
      </section>
    </div>
  `;

  views.access.querySelector('[data-action="add-member"]').addEventListener("click", () => {
    document.getElementById("memberDialog").showModal();
  });

  views.access.querySelectorAll("[data-remove-member]").forEach((button) => {
    button.addEventListener("click", () => {
      project.members = project.members.filter((member) => member.id !== button.dataset.removeMember);
      saveState();
      render();
    });
  });
}

function renderPrintBuilder() {
  const project = getActiveProject();
  const selectedTrades = new Set(project.selectedTrades);

  views.print.innerHTML = `
    <section class="panel print-builder">
      <div class="section-head">
        <div>
          <span class="eyebrow">Generation PDF chantier</span>
          <h2>Dossiers d'execution par corps d'etat</h2>
          <p>Chaque dossier contient les pre-requis, interfaces, checklist chantier, controles et documents sources.</p>
        </div>
        <div class="card-actions">
          <button class="ghost-button" data-action="select-all" type="button">Tout cocher</button>
          <button class="primary-button" data-action="print-selected" type="button">Generer les PDF</button>
        </div>
      </div>

      <div class="print-options">
        ${tradeCatalog.map((trade) => `
          <label class="print-option">
            <input type="checkbox" data-print-trade="${escapeAttr(trade.id)}" ${selectedTrades.has(trade.id) ? "checked" : ""} />
            <span>
              <strong>${escapeHtml(trade.name)}</strong><br />
              <small>${escapeHtml(trade.group)} · ${getTradeProgress(project, trade).done}/${trade.checklist.length} actions cochees</small>
            </span>
          </label>
        `).join("")}
      </div>
      <p class="fine-print">Le navigateur ouvre la boite d'impression. Choisir "Enregistrer au format PDF" pour obtenir les plans d'execution par artisan.</p>
    </section>
  `;

  views.print.querySelectorAll("[data-print-trade]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      project.selectedTrades = [...views.print.querySelectorAll("[data-print-trade]:checked")].map((input) => input.dataset.printTrade);
      saveState();
    });
  });

  views.print.querySelector('[data-action="select-all"]').addEventListener("click", () => {
    project.selectedTrades = tradeCatalog.map((trade) => trade.id);
    saveState();
    renderPrintBuilder();
  });

  views.print.querySelector('[data-action="print-selected"]').addEventListener("click", () => {
    const tradeIds = project.selectedTrades.length ? project.selectedTrades : [project.activeTradeId || "pilotage"];
    printTrades(tradeIds, true);
  });
}

async function handlePdfUpload(event) {
  const project = getActiveProject();
  const files = [...event.target.files].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  const category = document.getElementById("docCategory").value;
  const tradeId = document.getElementById("docTrade").value;
  const note = document.getElementById("docNote").value.trim();

  for (const file of files) {
    const id = makeId("doc");
    await putPdfBlob(id, file);
    project.docs.unshift({
      id,
      name: file.name,
      size: file.size,
      category,
      tradeId,
      note,
      uploadedAt: new Date().toISOString()
    });
    appState.selectedDocId = id;
  }

  event.target.value = "";
  saveState();
  render();
}

async function renderPdfPreview(docId) {
  const preview = document.getElementById("pdfPreview");
  if (!preview) return;
  const url = await getPdfUrl(docId);
  if (!url) {
    preview.innerHTML = `<div class="empty-state">PDF indisponible sur cet appareil.</div>`;
    return;
  }
  preview.innerHTML = `<object data="${escapeAttr(url)}" type="application/pdf"><iframe src="${escapeAttr(url)}" title="Apercu PDF"></iframe></object>`;
}

function renderRiskCard(card) {
  return `
    <article class="risk-card">
      <strong>
        <span>${escapeHtml(card.title)}</span>
        <span class="status-pill ${card.tone}">${escapeHtml(card.status)}</span>
      </strong>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `;
}

function renderTradeProgressRow(project, trade) {
  const progress = getTradeProgress(project, trade);
  return `
    <article class="risk-card">
      <strong>
        <span>${escapeHtml(trade.name)}</span>
        <span>${progress.done}/${progress.total}</span>
      </strong>
      <div class="progress-bar" style="--progress: ${progress.percent}%"><span></span></div>
      <p>${escapeHtml(trade.summary)}</p>
    </article>
  `;
}

function renderProjectCard(project) {
  const metrics = getProjectMetrics(project);
  return `
    <article class="project-card span-4">
      <div>
        <span class="eyebrow">${escapeHtml(project.phase)}</span>
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.address)}</p>
      </div>
      <div class="progress-bar" style="--progress: ${metrics.progress}%"><span></span></div>
      <div class="status-line">
        <span class="chip">${metrics.progress}% actions</span>
        <span class="chip">${project.docs.length} PDF</span>
        <span class="chip">${project.members.length} acces</span>
      </div>
      <button class="small-button" data-project-id="${escapeAttr(project.id)}" type="button">Ouvrir</button>
    </article>
  `;
}

function renderDocItem(doc, selectedId) {
  const trade = doc.tradeId === "all" ? "Tous lots" : getTrade(doc.tradeId)?.name || "Lot non defini";
  return `
    <article class="doc-item">
      <div>
        <strong>${escapeHtml(doc.name)}</strong>
        <p>${escapeHtml(doc.category)} · ${escapeHtml(trade)} · ${formatBytes(doc.size)}</p>
        ${doc.note ? `<small>${escapeHtml(doc.note)}</small>` : ""}
      </div>
      <div class="doc-actions">
        <button class="small-button" data-select-doc="${escapeAttr(doc.id)}" type="button">${doc.id === selectedId ? "Affiche" : "Apercu"}</button>
        <button class="danger-button" data-delete-doc="${escapeAttr(doc.id)}" type="button">Retirer</button>
      </div>
    </article>
  `;
}

function renderTradeCard(project, trade, selected) {
  const progress = getTradeProgress(project, trade);
  return `
    <button class="trade-card ${selected ? "selected" : ""}" data-trade-id="${escapeAttr(trade.id)}" type="button">
      <div class="meta">
        <span>${escapeHtml(trade.group)}</span>
        <span>${progress.percent}%</span>
      </div>
      <h3>${escapeHtml(trade.name)}</h3>
      <p>${escapeHtml(trade.summary)}</p>
      <div class="progress-bar" style="--progress: ${progress.percent}%"><span></span></div>
    </button>
  `;
}

function renderTradeDetail(project, trade) {
  const progress = getTradeProgress(project, trade);
  const docs = getDocsForTrade(project, trade.id);
  const note = project.tradeNotes[trade.id] || "";

  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">${escapeHtml(trade.group)}</span>
          <h2>${escapeHtml(trade.name)}</h2>
          <p>${escapeHtml(trade.summary)}</p>
        </div>
        <button class="primary-button" data-action="print-trade" type="button">PDF du lot</button>
      </div>
      <div class="metric-grid">
        <article class="metric-card good">
          <span>Actions cochees</span>
          <strong>${progress.done}/${progress.total}</strong>
        </article>
        <article class="metric-card info">
          <span>Documents lies</span>
          <strong>${docs.length}</strong>
        </article>
        <article class="metric-card warn">
          <span>Pre-requis</span>
          <strong>${trade.needs.length}</strong>
        </article>
        <article class="metric-card">
          <span>Controles</span>
          <strong>${trade.controls.length}</strong>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Liste chantier</span>
          <h2>Actions a mener</h2>
        </div>
      </div>
      <div class="checklist-list">
        ${trade.checklist.map((item, index) => renderChecklistRow(project, trade.id, item, index)).join("")}
      </div>
    </section>

    <div class="grid-12">
      <section class="panel span-6">
        <div class="section-head">
          <div>
            <span class="eyebrow">Avant intervention</span>
            <h2>Pre-requis</h2>
          </div>
        </div>
        <ul class="handoff-list">
          ${trade.needs.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
      <section class="panel span-6">
        <div class="section-head">
          <div>
            <span class="eyebrow">Interfaces</span>
            <h2>Points de coordination</h2>
          </div>
        </div>
        <ul class="handoff-list">
          ${trade.interfaces.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
    </div>

    <section class="panel">
      <div class="section-head">
        <div>
          <span class="eyebrow">Note du lot</span>
          <h2>Consignes specifiques</h2>
        </div>
      </div>
      <textarea data-trade-note="${escapeAttr(trade.id)}" rows="4" placeholder="Ajouter une consigne chantier, une reserve ou une decision validee.">${escapeHtml(note)}</textarea>
    </section>
  `;
}

function renderChecklistRow(project, tradeId, item, index) {
  const done = Boolean(project.checklistState[tradeId]?.[index]);
  return `
    <label class="checklist-row ${done ? "done" : ""}">
      <input type="checkbox" data-check="${escapeAttr(tradeId)}:${index}" ${done ? "checked" : ""} />
      <span>
        <strong>${escapeHtml(item)}</strong>
        <p>Responsable: ${escapeHtml(getTrade(tradeId).name)} · validation chantier attendue.</p>
      </span>
      <span class="status-pill ${done ? "good" : "warn"}">${done ? "Fait" : "A faire"}</span>
    </label>
  `;
}

function renderMemberItem(member) {
  const trade = getTrade(member.tradeId);
  return `
    <article class="member-item">
      <div>
        <strong>${escapeHtml(member.email)}</strong>
        <p>${escapeHtml(member.role)} · ${escapeHtml(trade?.name || "Tous lots")}</p>
      </div>
      <div class="member-actions">
        <span class="status-pill good">Actif</span>
        <button class="danger-button" data-remove-member="${escapeAttr(member.id)}" type="button">Retirer</button>
      </div>
    </article>
  `;
}

function renderPermission(title, body, tone) {
  return `
    <article class="risk-card">
      <strong>
        <span>${escapeHtml(title)}</span>
        <span class="status-pill ${tone}">Role</span>
      </strong>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function setView(view) {
  appState.activeView = view;
  document.querySelector(".sidebar").classList.remove("open");
  saveState();
  render();
}

function setActiveProject(projectId) {
  appState.activeProjectId = projectId;
  appState.selectedDocId = null;
  saveState();
  render();
}

function getActiveProject() {
  return appState.projects.find((project) => project.id === appState.activeProjectId) || appState.projects[0];
}

function getTrade(tradeId) {
  return tradeCatalog.find((trade) => trade.id === tradeId);
}

function getDocsForTrade(project, tradeId) {
  return project.docs.filter((doc) => doc.tradeId === "all" || doc.tradeId === tradeId);
}

function getTradeProgress(project, trade) {
  const checked = project.checklistState[trade.id] || {};
  const done = trade.checklist.reduce((sum, _item, index) => sum + (checked[index] ? 1 : 0), 0);
  const total = trade.checklist.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

function getProjectMetrics(project) {
  const totals = tradeCatalog.reduce(
    (acc, trade) => {
      const progress = getTradeProgress(project, trade);
      acc.done += progress.done;
      acc.total += progress.total;
      return acc;
    },
    { done: 0, total: 0 }
  );
  return {
    progress: totals.total ? Math.round((totals.done / totals.total) * 100) : 0,
    done: totals.done,
    total: totals.total
  };
}

function getRiskCards(project) {
  const hasSoil = project.docs.some((doc) => doc.category === "Etude de sol");
  const hasStructure = project.docs.some((doc) => doc.category === "Plan structure");
  const hasVrd = project.docs.some((doc) => doc.category === "Plan VRD");
  return [
    {
      title: "Etude de sol",
      status: hasSoil ? "OK" : "A obtenir",
      tone: hasSoil ? "good" : "danger",
      body: hasSoil
        ? "Rapport present dans les plans sources du chantier."
        : "Ne pas lancer fondations definitives sans G2 ou avis structure adapte."
    },
    {
      title: "Reservations structure",
      status: hasStructure ? "Suivi" : "A cadrer",
      tone: hasStructure ? "good" : "warn",
      body: "Passages reseaux, tremies et attentes doivent etre valides avant coulage."
    },
    {
      title: "Raccordements VRD",
      status: hasVrd ? "Plan importe" : "A preciser",
      tone: hasVrd ? "good" : "warn",
      body: "Pentes, regards, compteurs et fils d'eau conditionnent seuils et exterieurs."
    }
  ];
}

function setChecklistItem(project, tradeId, index, checked) {
  if (!project.checklistState[tradeId]) project.checklistState[tradeId] = {};
  project.checklistState[tradeId][index] = checked;
}

function printTrades(tradeIds, includeCover = false) {
  const project = getActiveProject();
  const trades = tradeIds.map(getTrade).filter(Boolean);
  const printArea = document.getElementById("printArea");
  const pages = [];

  if (includeCover) pages.push(renderPrintCover(project, trades));
  trades.forEach((trade) => pages.push(renderPrintTrade(project, trade)));

  printArea.innerHTML = pages.join("");
  window.setTimeout(() => window.print(), 80);
}

function renderPrintCover(project, trades) {
  const metrics = getProjectMetrics(project);
  return `
    <article class="print-page">
      <header class="print-header">
        <div>
          <p class="print-meta">SEVEN Chantier · Dossier d'execution</p>
          <h1>${escapeHtml(project.name)}</h1>
          <p>${escapeHtml(project.address)} · ${escapeHtml(project.surface)} · ${escapeHtml(project.phase)}</p>
        </div>
        <div class="print-badge">
          Genere le ${formatDate(new Date().toISOString())}<br />
          ${trades.length} corps d'etat<br />
          ${metrics.done}/${metrics.total} actions suivies
        </div>
      </header>
      <section class="print-section">
        <h2>Note projet</h2>
        <p>${escapeHtml(project.notes || "Aucune note projet renseignee.")}</p>
      </section>
      <section class="print-section">
        <h2>Documents sources importes</h2>
        ${renderPrintDocs(project.docs)}
      </section>
      <section class="print-section">
        <h2>Corps d'etat inclus</h2>
        <ul>
          ${trades.map((trade) => `<li>${escapeHtml(trade.name)}</li>`).join("")}
        </ul>
      </section>
      <footer class="print-footer">
        <span>Maitre d'ouvrage</span>
        <span>Architecte / MOE</span>
        <span>Date et visa</span>
      </footer>
    </article>
  `;
}

function renderPrintTrade(project, trade) {
  const docs = getDocsForTrade(project, trade.id);
  const note = project.tradeNotes[trade.id];
  const progress = getTradeProgress(project, trade);
  return `
    <article class="print-page">
      <header class="print-header">
        <div>
          <p class="print-meta">${escapeHtml(project.name)} · ${escapeHtml(project.address)}</p>
          <h1>${escapeHtml(trade.name)}</h1>
          <p>${escapeHtml(trade.summary)}</p>
        </div>
        <div class="print-badge">
          Lot: ${escapeHtml(trade.group)}<br />
          Actions: ${progress.done}/${progress.total}<br />
          Version: ${formatDate(new Date().toISOString())}
        </div>
      </header>

      <div class="print-grid">
        <section class="print-section">
          <h2>Avant intervention</h2>
          <ul>${trade.needs.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
        <section class="print-section">
          <h2>Documents a consulter</h2>
          ${renderPrintDocs(docs)}
        </section>
      </div>

      <section class="print-section">
        <h2>Liste a cocher chantier</h2>
        <ul class="print-checks">
          ${trade.checklist.map((item, index) => {
            const checked = project.checklistState[trade.id]?.[index];
            return `<li><span class="print-box">${checked ? "✓" : ""}</span><span>${escapeHtml(item)}</span></li>`;
          }).join("")}
        </ul>
      </section>

      <div class="print-grid">
        <section class="print-section">
          <h2>Interfaces avec autres lots</h2>
          <ul>${trade.interfaces.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
        <section class="print-section">
          <h2>Controles avant validation</h2>
          <ul>${trade.controls.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
      </div>

      <section class="print-section">
        <h2>Consignes specifiques</h2>
        <p>${escapeHtml(note || "A completer sur chantier si decision, reserve ou variante validee.")}</p>
      </section>

      <footer class="print-footer">
        <span>Entreprise / Artisan</span>
        <span>Controle MOE</span>
        <span>Date, visa, reserves</span>
      </footer>
    </article>
  `;
}

function renderPrintDocs(docs) {
  if (!docs.length) return "<p>Aucun document source associe a ce lot.</p>";
  return `
    <ul>
      ${docs.map((doc) => `<li>${escapeHtml(doc.category)} · ${escapeHtml(doc.name)} · ${formatBytes(doc.size)}</li>`).join("")}
    </ul>
  `;
}

function normalizeState() {
  if (!appState.projects?.length) {
    appState.projects = structuredClone(defaultProjects);
  }
  if (!appState.projects.some((project) => project.id === appState.activeProjectId)) {
    appState.activeProjectId = appState.projects[0].id;
  }
  appState.activeView ||= "dashboard";
  appState.role ||= "architecte";
  appState.projects.forEach((project) => {
    project.docs ||= [];
    project.members ||= [];
    project.checklistState ||= {};
    project.tradeNotes ||= {};
    project.selectedTrades ||= tradeCatalog.map((trade) => trade.id);
    project.activeTradeId ||= "pilotage";
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        activeView: "dashboard",
        activeProjectId: defaultProjects[0].id,
        selectedDocId: null,
        role: "architecte",
        projects: structuredClone(defaultProjects)
      };
    }
    return JSON.parse(raw);
  } catch (_error) {
    return {
      activeView: "dashboard",
      activeProjectId: defaultProjects[0].id,
      selectedDocId: null,
      role: "architecte",
      projects: structuredClone(defaultProjects)
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putPdfBlob(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getPdfBlob(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deletePdfBlob(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getPdfUrl(id) {
  const blob = await getPdfBlob(id);
  if (!blob) return null;
  if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
  activePreviewUrl = URL.createObjectURL(blob);
  return activePreviewUrl;
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 Ko";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
