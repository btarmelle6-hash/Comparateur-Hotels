# Comparateur-Hotels
# 🌿 EcoStay — Comparateur d'hôtels écologiques

> Projet portfolio — Site de comparaison d'hôtels propulsé par l'IA (Groq)

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Groq](https://img.shields.io/badge/API-Groq-00C4B3?style=flat)

---

## Aperçu

Un site de comparaison d'hôtels simple et moderne qui utilise l'IA Groq pour générer des résultats réalistes à partir d'une ville saisie par l'utilisateur.

**Fonctionnalités :**
- 🔍 Recherche par ville
- 🏨 Affichage de 9 hôtels avec nom, prix, note, étoiles et image
- 🔀 Tri par prix ou par note
- 🔗 Bouton de redirection vers Booking.com
- 📱 Design responsive (mobile-friendly)

---

##  Lancer le projet


```bash
git clone https://github.com/TON_USERNAME/hotel-finder.git
cd hotel-finder
```

###  clé API Groq 

1. Va sur [https://console.groq.com](https://console.groq.com)
2. Crée un compte gratuit
3. Dans **API Keys**, clique sur **Create API Key**
4. Copie ta clé

### Configurer la clé API

Ouvre le fichier `app.js` et remplace la ligne :

```javascript
const GROQ_API_KEY = "VOTRE_CLE_API_GROQ_ICI";
```

par :

```javascript
const GROQ_API_KEY = "gsk_xxxxxxxxxxxxxxxxxxxx"; // Ta vraie clé
```




---

##  Structure du projet

```
hotel-finder/
│
├── index.html    # Structure HTML de la page
├── style.css     # Tous les styles (design sombre & doré)
├── app.js        # Logique JavaScript + appel API Groq
└── README.md     # Ce fichier
```

---

## Technologies utilisées

| Technologie | Usage |
|---|---|
| HTML5 | Structure de la page |
| CSS3 | Design, animations, responsive |
| JavaScript (Vanilla) | Logique, appels API, DOM |
| [API Groq](https://groq.com) | Génération des données hôtelières via IA |
| Google Fonts | Typographies Playfair Display + DM Sans |

---

## Publier sur GitHub Pages

Pour héberger gratuitement ton site :

1. Va dans **Settings** → **Pages** de ton dépôt GitHub
2. Source : **Deploy from a branch**
3. Branch : `main` / `root`
4. Ton site sera disponible à : `https://Armelle.github.io/hotel-finder`

---

## Améliorations possibles

- [ ] Filtrer par nombre d'étoiles
- [ ] Ajouter une carte interactive (Leaflet.js)
- [ ] Vraie API hôtelière (RapidAPI Hotels)
- [ ] Système de favoris (LocalStorage)
- [ ] Mode clair / sombre

---

## Licence

MIT — libre d'utilisation pour ton portfolio.# hotel-comparateur
# hotel-comparateur
# hotel-comparateur
