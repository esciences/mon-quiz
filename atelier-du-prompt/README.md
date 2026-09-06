# L'atelier du prompt

Transformer une demande vague en consigne utile pour une IA — un parcours interactif de 15 à 25 minutes destiné aux enseignants francophones, à utiliser en formation ou en autonomie.

## 1. Ouvrir l'application localement

Aucune installation n'est nécessaire.

1. Téléchargez ou clonez ce dossier (`atelier-du-prompt/`).
2. Double-cliquez sur `index.html`, ou ouvrez-le depuis votre navigateur (Chrome, Firefox, Edge, Safari…) via `Fichier > Ouvrir`.
3. L'atelier fonctionne immédiatement, sans connexion Internet, sans compte et sans clé d'API.

Vous pouvez aussi le déposer sur un espace d'hébergement statique (site d'école, clé USB partagée, intranet) : il n'y a ni serveur ni base de données à configurer.

## 2. Structure des fichiers

```
atelier-du-prompt/
├── index.html      Structure des 5 étapes du parcours
├── styles.css       Palette, mise en page et responsive
├── script.js        Logique : navigation, sauvegarde, analyse locale
└── README.md        Ce document
```

Le parcours comporte 5 étapes définies dans `index.html` (une balise `<section class="step">` par étape) :

1. Accueil et découverte de la méthode O-C-R-C-F.
2. Observation d'une demande vague et de ses limites.
3. Construction guidée d'un prompt (Objectif, Contexte, Rôle, Contraintes, Format).
4. Défi : améliorer un prompt vague, avec analyse locale.
5. Récupération du prompt final et checklist avant utilisation.

## 3. Modifier les exemples de prompts

Tous les textes d'exemple sont centralisés dans `script.js` :

- **Exemple complété (étape 3)** : objet `exampleCompletee`, en haut du fichier. Modifiez les cinq propriétés (`objectif`, `contexte`, `role`, `contraintes`, `format`) pour proposer un autre exemple type.
- **Suggestions rapides (« Besoin d'une idée ? »)** : ce sont des boutons `<button class="chip">` dans `index.html`, à l'intérieur de chaque `<div class="chip-group">`. Ajoutez, modifiez ou supprimez ces boutons librement.
- **Défis de l'étape 4** : objet `challenges` dans `script.js`. Chaque défi a une demande de départ (`original`) et une piste d'amélioration (`piste`). Vous pouvez changer le texte, ou dupliquer un défi (n'oubliez pas d'ajouter la carte correspondante dans `index.html`, section `#challenge-picker`).
- **Demande vague et réponse simulée de l'étape 2** : directement dans `index.html`, sections `.prompt-sample` et `.ai-bubble`.

## 4. Modifier la palette de couleurs

Toutes les couleurs sont définies comme variables CSS au début de `styles.css`, dans le bloc `:root` :

```css
:root {
  --color-bg: #f6f8fa;        /* fond général, clair */
  --color-navy: #16233f;      /* bleu nuit — titres, en-tête */
  --color-turquoise: #0f8f83; /* couleur d'action principale */
  --color-yellow: #f6c453;    /* jaune doux — alertes, accents */
  --color-forest: #1f4e3d;    /* vert foncé — validation, succès */
  ...
}
```

Changez ces valeurs pour adapter l'atelier à votre charte graphique (établissement, réseau, événement de formation). Le reste de la feuille de style utilise ces variables : il n'est pas nécessaire de modifier chaque règle individuellement.

## 5. Confidentialité et fonctionnement hors ligne

- **Aucune donnée n'est envoyée sur Internet.** L'application ne fait aucun appel réseau, ne contacte aucune IA et n'utilise aucune clé d'API.
- Vos réponses (textes saisis, choix effectués, progression) sont enregistrées uniquement dans le `localStorage` de votre navigateur, sur votre propre appareil. Elles ne sont ni transmises, ni partagées, ni consultées par un tiers.
- Le bouton « Recommencer » demande une confirmation avant d'effacer ces données locales.
- Aucune donnée personnelle d'élève n'est demandée ni stockée par l'application ; la checklist finale rappelle d'ailleurs de ne jamais transmettre d'informations identifiantes sur vos élèves à une IA.
- L'atelier fonctionne entièrement hors ligne une fois les fichiers chargés dans le navigateur.

## Limites à connaître

- La méthode O-C-R-C-F est un repère pédagogique, pas une formule universelle : elle est présentée comme telle tout au long du parcours.
- L'« analyse locale » de l'étape 4 repère des mots-clés (niveau, durée, rôle, format, contraintes…) par expressions régulières simples. Elle ne comprend pas le sens du texte et ne remplace pas un jugement professionnel.
- Les réponses d'IA affichées à l'étape 2 sont des exemples rédigés à l'avance, pas de véritables réponses générées : c'est une simulation à but pédagogique, clairement annoncée comme telle dans l'interface.
