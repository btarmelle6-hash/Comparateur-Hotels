/* ============================================
   HOTEL FINDER — app.js
   Logique principale : appel API Groq + affichage
   ============================================ */

// ──────────────────────────────────────────
//  CONFIGURATION 

// ──────────────────────────────────────────
const GROQ_API_KEY = "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.1-8b-instant"; // Modèle gratuit et rapide (à jour)

// ──────────────────────────────────────────
// 🌿 ECO HOTEL CRITERIA SYSTEM
// Système d'évaluation écologique pour les hôtels
// ──────────────────────────────────────────
const ecoCriteria = {
  resources: {
    water: {
      lowConsumptionSystems: true,
      towelReuseProgram: true,
      rainwaterCollection: false,
      filtrationSystem: true
    },
    energy: {
      renewableEnergyPercentage: 60, // %
      ledLighting: true,
      thermalInsulation: true,
      motionSensors: false
    }
  },

  wasteManagement: {
    recycling: true,
    composting: false,
    plasticReduction: true,
    refillableProducts: true
  },

  construction: {
    sustainableMaterials: true,
    renovatedBuilding: true,
    bioclimaticDesign: false
  },

  food: {
    localProducts: true,
    vegetarianOptions: true,
    organicProducts: false,
    antiFoodWastePolicy: true
  },

  mobility: {
    publicTransportAccess: true,
    bikeRental: true,
    electricCharging: false,
    ecoShuttle: false
  },

  socialImpact: {
    localEmployment: true,
    fairWorkingConditions: true,
    localPartnerships: true
  },

  products: {
    ecoToiletries: true,
    nonToxicCleaning: true,
    noSingleUsePlastics: true
  }
};

// ──────────────────────────────────────────
// 🧮 Scoring function — Calcule le score écologique
// ──────────────────────────────────────────
function calculateEcoScore(criteria) {
  let score = 0;
  let maxScore = 0;

  function evaluateCategory(category) {
    Object.values(category).forEach(value => {
      if (typeof value === "boolean") {
        maxScore += 1;
        if (value) score += 1;
      } else if (typeof value === "number") {
        maxScore += 1;
        score += value / 100; // normalize percentage
      } else if (typeof value === "object") {
        evaluateCategory(value);
      }
    });
  }

  evaluateCategory(criteria);

  return {
    score: (score / maxScore) * 100,
    maxScore: 100
  };
}

// ──────────────────────────────────────────
// 🌍 Get Eco Badge — Retourne le badge écologique
// ──────────────────────────────────────────
function getEcoBadge(score) {
  if (score >= 90) return "🏆 Excellent";
  if (score >= 75) return "🌱 Très Bon";
  if (score >= 60) return "🌿 Bon";
  if (score >= 45) return "⚡ Acceptable";
  return "⚠️ À Améliorer";
}

// ──────────────────────────────────────────
//  ÉTAT DE L'APPLICATION
// On stocke les hôtels pour pouvoir les retrier sans rappeler l'API
// ──────────────────────────────────────────
let allHotels    = [];    // Tableau des hôtels retournés par l'API
let currentSort  = "price"; // Tri actif par défaut
let mapInstance  = null;   // Instance Leaflet
let markers      = [];     // Marqueurs des hôtels
let currentCity  = "";     // Ville actuelle pour la géolocalisation

// ──────────────────────────────────────────
//  FONCTION PRINCIPALE — Lancer une recherche
// Appelée par le bouton "Rechercher" dans le HTML
// ──────────────────────────────────────────
async function searchHotels() {
  // 1. Récupère le texte entré par l'utilisateur
  const city = document.getElementById("cityInput").value.trim();

  // 2. Vérifie que le champ n'est pas vide
  if (!city) {
    showError("Veuillez entrer le nom d'une ville 🏙️");
    return;
  }

  // 3. Affiche le loader, cache les anciens résultats
  showLoader(true);
  hideResults();
  hideError();

  try {
    // 4. Appelle l'API Groq pour générer les données hôtelières
    const hotels = await fetchHotelsFromGroq(city);

    // 5. Sauvegarde et affiche les résultats
    allHotels = hotels;
    displayHotels(hotels, city);

  } catch (error) {
    // En cas d'erreur (réseau, clé API, etc.)
    console.error("Erreur détaillée :", error);
    console.error("Message :", error.message);
    showError(`❌ Erreur: ${error.message}`);
  } finally {
    // 6. Cache le loader dans tous les cas
    showLoader(false);
  }
}



// ──────────────────────────────────────────
async function fetchHotelsFromGroq(city) {
  try {
    // Prompt très précis : on veut du JSON strict, pas de texte autour
    const prompt = `
Tu es une API d'hôtels. Génère une liste de 9 hôtels fictifs mais réalistes pour la ville de "${city}".
Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, sans balises markdown.
Chaque hôtel doit avoir exactement ces champs :
{
  "name": "Nom de l'hôtel",
  "location": "Quartier ou adresse courte",
  "price": 120,
  "rating": 4.3,
  "stars": 4,
  "style": "moderne luxe",
  "highlights": "piscine spa jardin vue panoramique",
  "bookingUrl": "https://www.booking.com/searchresults.html?ss=Nom+Hotel+${encodeURIComponent(city)}",
  "imageSearchTerms": "luxury hotel modern facade"
}
Règles :
- price : entier entre 60 et 600 (euros par nuit)
- rating : décimal entre 6.0 et 9.9
- stars : entier entre 2 et 5
- style : décrire le style architectural (moderne, classique, boutique, luxe, colonial, contemporain, etc.)
- highlights : 2-3 caractéristiques principales (piscine, spa, vue, jardin, restaurant, etc.)
- imageSearchTerms : termes de recherche pour trouver une image pertinente (ex: "luxury pool resort", "boutique hotel corridor", "modern business hotel"), doit correspondre au style et aux caractéristiques
- bookingUrl : URL Booking vers la recherche de cet hôtel spécifique. Format : https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${city}. Remplace NOM_HOTEL par le nom de l'hôtel sans espaces, utilise des + pour les espaces
- Les noms doivent sembler authentiques et locaux
Retourne uniquement le tableau JSON.
`;

    // Appel fetch vers l'API Groq 
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.8,    // Un peu de créativité
        max_tokens: 2500     // Augmenté pour inclure imageSearchTerms
      })
    });

    // Vérification du statut HTTP
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
      console.error("Réponse API Groq :", { status: response.status, errorData });
      throw new Error(`Groq API Error (${response.status}): ${errorMsg}`);
    }

    // Extraction du texte de la réponse
    const data = await response.json();
    const rawText = data.choices[0].message.content;

    // Nettoyage : supprime les éventuelles balises ```json ... ```
    const cleanText = rawText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Parse le JSON
    const hotels = JSON.parse(cleanText);

    // Validation basique : s'assure que c'est bien un tableau
    if (!Array.isArray(hotels)) {
      throw new Error("La réponse de l'API n'est pas un tableau valide.");
    }

    return hotels;
  } catch (error) {
    console.warn("API Groq indisponible, utilisation de données fictives", error);
    // Fallback : retourne des hôtels fictifs locaux
    return generateFakeHotels(city);
  }
}

// ──────────────────────────────────────────
// Génère des hôtels fictifs en cas d'indisponibilité de l'API
// ──────────────────────────────────────────
function generateFakeHotels(city) {
  const fakeHotels = [
    {
      name: "Grand Hôtel Prestige",
      location: "Centre-ville",
      price: 285,
      rating: 9.2,
      stars: 5,
      style: "moderne luxe",
      highlights: "piscine spa vue panoramique",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Grand+Hotel+Prestige+${encodeURIComponent(city)}`,
      imageSearchTerms: "luxury 5 star hotel facade",
      ecoScore: 78,
      ecoBadge: "🌱 Très Bon",
      ecoFeatures: ["🌿 Énergie 60% renouvelable", "♻️ Recyclage complet", "🚴 Accès transport en commun"]
    },
    {
      name: "Boutique Elegance",
      location: "Quartier historique",
      price: 165,
      rating: 8.7,
      stars: 4,
      style: "classique elegant",
      highlights: "restaurant gourmet jardin privé",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Boutique+Elegance+${encodeURIComponent(city)}`,
      imageSearchTerms: "boutique hotel elegant entrance",
      ecoScore: 85,
      ecoBadge: "🌱 Très Bon",
      ecoFeatures: ["💧 Systèmes eau basse consommation", "🌾 Produits locaux & biologiques", "📦 Zéro plastique unique"]
    },
    {
      name: "Moderne View Plaza",
      location: "Bord de lac",
      price: 220,
      rating: 8.9,
      stars: 4,
      style: "contemporain design",
      highlights: "piscine infinie vue panoramique",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Moderne+View+Plaza+${encodeURIComponent(city)}`,
      imageSearchTerms: "modern hotel with pool and view",
      ecoScore: 72,
      ecoBadge: "🌿 Bon",
      ecoFeatures: ["💡 Éclairage LED 100%", "♻️ Programme réutilisation serviettes", "🔌 Bornes recharge électrique"]
    },
    {
      name: "Écrin de Luxe",
      location: "Près du centre commercial",
      price: 195,
      rating: 8.5,
      stars: 4,
      style: "luxe minimaliste",
      highlights: "spa wellness centre vue",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Ecrin+de+Luxe+${encodeURIComponent(city)}`,
      imageSearchTerms: "luxury minimalist hotel spa",
      ecoScore: 91,
      ecoBadge: "🏆 Excellent",
      ecoFeatures: ["🌍 Emploi local prioritaire", "🌱 Isolation thermique optimale", "🚴 Vélos gratuits"]
    },
    {
      name: "Palais Montagne",
      location: "En montagne",
      price: 310,
      rating: 9.0,
      stars: 5,
      style: "alpin chic",
      highlights: "panorama montagneux restaurant",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Palais+Montagne+${encodeURIComponent(city)}`,
      imageSearchTerms: "mountain resort luxury hotel",
      ecoScore: 68,
      ecoBadge: "🌿 Bon",
      ecoFeatures: ["🏗️ Matériaux durables", "🚐 Navette écologique gratuite", "🌾 Menu végétarien"]
    },
    {
      name: "Casa Colonial",
      location: "Vieux quartier",
      price: 145,
      rating: 8.3,
      stars: 3,
      style: "colonial charme",
      highlights: "cour intérieure restaurant",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Casa+Colonial+${encodeURIComponent(city)}`,
      imageSearchTerms: "colonial style hotel courtyard",
      ecoScore: 55,
      ecoBadge: "⚡ Acceptable",
      ecoFeatures: ["🔄 Bâtiment rénové", "🌍 Partenariats locaux", "💧 Collecte eau pluie"]
    },
    {
      name: "Oasis Resort",
      location: "Zone touristique",
      price: 175,
      rating: 8.4,
      stars: 4,
      style: "tropical resort",
      highlights: "piscine bar plage animée",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Oasis+Resort+${encodeURIComponent(city)}`,
      imageSearchTerms: "tropical resort hotel with pool",
      ecoScore: 62,
      ecoBadge: "🌿 Bon",
      ecoFeatures: ["♻️ Nettoyage non-toxique", "🌾 Option repas durables", "📦 Réduction plastique"]
    },
    {
      name: "Horizon Business",
      location: "District affaires",
      price: 125,
      rating: 8.1,
      stars: 3,
      style: "business moderne",
      highlights: "centre affaires wifi rapide",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Horizon+Business+${encodeURIComponent(city)}`,
      imageSearchTerms: "business hotel modern conference",
      ecoScore: 74,
      ecoBadge: "🌿 Bon",
      ecoFeatures: ["💡 Détecteurs de mouvement", "🚴 Parking vélos", "🌍 Empreinte carbone suivie"]
    },
    {
      name: "Villa Côté Mer",
      location: "Bord de mer",
      price: 265,
      rating: 9.1,
      stars: 5,
      style: "côtier luxe",
      highlights: "plage privée coucher soleil",
      bookingUrl: `https://www.booking.com/searchresults.html?ss=Villa+Cote+Mer+${encodeURIComponent(city)}`,
      imageSearchTerms: "beachfront luxury villa hotel",
      ecoScore: 88,
      ecoBadge: "🌱 Très Bon",
      ecoFeatures: ["🌿 Design bioclimatique", "📦 Toiletteries écologiques", "🌾 Produits biologiques"]
    }
  ];

  return fakeHotels;
}

// ──────────────────────────────────────────
// �️ RECHERCHE D'IMAGES DEPUIS INTERNET
// Récupère des images depuis plusieurs sources gratuites
// ──────────────────────────────────────────
async function fetchHotelImage(hotelName, imageSearchTerms) {
  // 1. Essayer Pixabay (gratuit, pas de clé requise pour les URLs directes)
  try {
    const pixabayUrl = `https://pixabay.com/api/?key=48146863&q=${encodeURIComponent(imageSearchTerms || hotelName)}&image_type=photo&min_width=400&min_height=250&order=popular&safesearch=true&per_page=1`;
    const response = await fetch(pixabayUrl);
    
    if (response.ok) {
      const data = await response.json();
      if (data.hits && data.hits.length > 0) {
        return data.hits[0].largeImageURL || data.hits[0].webformatURL;
      }
    }
  } catch (error) {
    console.warn("Pixabay API indisponible, essai source suivante...", error);
  }

  // 2. Fallback sur Unsplash
  try {
    const unsplashTerms = imageSearchTerms || `${hotelName} luxury hotel`;
    return `https://source.unsplash.com/400x250/?${encodeURIComponent(unsplashTerms)},hotel&auto=format&fit=crop&q=85&w=400&h=250`;
  } catch (error) {
    console.warn("Unsplash fallback échoué", error);
  }

  // 3. Derniers fallbacks aléatoires
  const fallbackSources = [
    `https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=250&fit=crop`, // Hotel générique Unsplash
    `https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=250&fit=crop`, // Hotel room
    `https://images.unsplash.com/photo-1455849318169-8d6cb6b76719?w=400&h=250&fit=crop`, // Booking
  ];
  
  return fallbackSources[Math.floor(Math.random() * fallbackSources.length)];
}

// ──────────────────────────────────────────
// 🎨 CACHE D'IMAGES
// Stocke les URLs d'images pour éviter les requêtes répétées
// ──────────────────────────────────────────
const imageCache = {};

// ──────────────────────────────────────────
// 🔗 GÉNÉRATION URL BOOKING
// Crée une URL de réservation Booking directe pour l'hôtel
// ──────────────────────────────────────────
function generateBookingUrl(hotelName, city) {
  // Formate le nom de l'hôtel pour l'URL (remplace les espaces par +)
  const formattedHotelName = hotelName.trim().replace(/\s+/g, '+');
  const formattedCity = city.trim().replace(/\s+/g, '+');
  
  // URL de recherche Booking qui recherche l'hôtel spécifique dans la ville
  // Paramètres : ss = search string, orderby = tri par avis
  return `https://www.booking.com/searchresults.html?ss=${formattedHotelName}+${formattedCity}&orderby=review`;
}

// ──────────────────────────────────────────
function sortHotels(sortType) {
  // Met à jour le tri actif
  currentSort = sortType;

  // Met à jour l'apparence des boutons (active/inactive)
  document.getElementById("sortPrice").classList.toggle("active", sortType === "price");
  document.getElementById("sortRating").classList.toggle("active", sortType === "rating");

  // Crée une copie du tableau pour ne pas modifier l'original
  const sorted = [...allHotels];

  if (sortType === "price") {
    // Tri par prix croissant
    sorted.sort((a, b) => a.price - b.price);
  } else if (sortType === "rating") {
    // Tri par note décroissante (meilleure note en premier)
    sorted.sort((a, b) => b.rating - a.rating);
  }

  // Réaffiche les hôtels triés
  renderHotelCards(sorted);
}

// ──────────────────────────────────────────
// 🏨 AFFICHAGE DES HÔTELS
// Gère l'affichage du compteur et lance le rendu des cartes
// ──────────────────────────────────────────
async function displayHotels(hotels, city) {
  if (!hotels || hotels.length === 0) {
    showError(`Aucun hôtel trouvé pour "${city}".`);
    return;
  }

  // Sauvegarde les hôtels pour le tri
  allHotels = hotels;

  // Sauvegarde la ville pour la carte
  currentCity = city;

  // Affiche la section résultats
  document.getElementById("resultsSection").style.display = "block";

  // Masque la bannière des critères écologiques
  const ecoBanner = document.getElementById("ecoCriteriaBanner");
  if (ecoBanner) {
    ecoBanner.style.display = "none";
  }

  // Met à jour le compteur
  document.getElementById("resultsCount").textContent =
    `${hotels.length} hôtel${hotels.length > 1 ? "s" : ""} trouvé${hotels.length > 1 ? "s" : ""} à ${city}`;

  // Pré-charge les images pour tous les hôtels
  for (let hotel of hotels) {
    if (!hotel.imageUrl) {
      const searchTerms = hotel.imageSearchTerms || hotel.highlights;
      hotel.imageUrl = await fetchHotelImage(hotel.name, searchTerms);
    }
  }

  // Initialise la carte
  initializeMap(hotels, city);

  // Applique le tri actuel et affiche les cartes
  sortHotels(currentSort);
}

// ──────────────────────────────────────────
// 🗓️ RENDU DES CARTES HTML
// Génère le HTML de chaque carte et l'injecte dans la grille
// ──────────────────────────────────────────
function renderHotelCards(hotels) {
  const grid = document.getElementById("hotelsGrid");

  // Génère le HTML de toutes les cartes
  grid.innerHTML = hotels.map((hotel, index) => {
    // Génère les étoiles (ex: 4 étoiles → "★★★★☆")
    const starsHTML = generateStars(hotel.stars || 3);

    // Délai d'animation progressif pour chaque carte
    const delay = index * 0.06;
    
    // Génère l'URL de réservation Booking directe pour cet hôtel
    const bookingUrl = generateBookingUrl(hotel.name, currentCity);
    
    // Utilise l'URL d'image pré-chargée
    const hotelImageUrl = hotel.imageUrl || `https://source.unsplash.com/400x250/?luxury,hotel,building&auto=format&fit=crop&q=85`;
    const fallbackImageUrl = `https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=250&fit=crop`;

    return `
      <div class="hotel-card" style="animation-delay: ${delay}s;">

        <!-- Image avec badge de note -->
        <div class="hotel-card__image-wrapper">
          <img
            class="hotel-card__image"
            src="${hotelImageUrl}"
            alt="Façade de ${hotel.name}"
            loading="lazy"
            onerror="this.src='${fallbackImageUrl}'"
            style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);"
          />
          <span class="hotel-card__badge">⭐ ${hotel.rating}</span>
        </div>

        <!-- Contenu texte -->
        <div class="hotel-card__body">
          <h3 class="hotel-card__name">${hotel.name}</h3>
          <p class="hotel-card__location">📍 ${hotel.location}</p>
          <p class="hotel-card__highlights" style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">✨ ${hotel.highlights || 'Hôtel de charme'}</p>
          <div class="hotel-card__stars" style="font-size: 14px; margin-bottom: 8px;"><strong>La note EcoStay</strong><br/>${starsHTML}</div>

          <!-- Critères Écologiques -->
          ${hotel.ecoScore ? `
          <div class="hotel-card__eco-section" style="margin: 12px 0; padding: 12px; background: #f0f9f0; border-left: 3px solid #4caf50; border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: #2d6a3e;">Engagement Écologique</span>
              <span style="font-size: 16px; font-weight: 700; color: #4caf50;">${hotel.ecoScore}%</span>
            </div>
            <p style="font-size: 11px; color: #4caf50; margin-bottom: 8px; font-weight: 600;">${hotel.ecoBadge}</p>
            <ul style="list-style: none; margin: 0; padding: 0; font-size: 11px;">
              ${hotel.ecoFeatures.map(feature => `<li style="margin-bottom: 4px; color: #2d6a3e;">• ${feature}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          <!-- Prix + Bouton -->
          <div class="hotel-card__footer">
            <div class="hotel-card__price">
              <span class="hotel-card__price-amount">${hotel.price}€</span>
              <span class="hotel-card__price-label">par nuit</span>
            </div>
            <a
              class="hotel-card__btn"
              href="${bookingUrl}"
              target="_blank"
              rel="noopener noreferrer"
              title="Réserver ${hotel.name} sur Booking.com"
            >
              Réserver →
            </a>
          </div>
        </div>

      </div>
    `;
  }).join("");
}

// ──────────────────────────────────────────
// ⭐ GÉNÉRATION DES ÉTOILES
// Retourne une chaîne de feuilles pleines et vides
// Exemple : generateStars(4) → "🌿🌿🌿🌿○"
// ──────────────────────────────────────────
function generateStars(count) {
  const max = 5;
  const full  = "🌿".repeat(Math.min(count, max));
  const empty = "○".repeat(Math.max(max - count, 0));
  return full + empty;
}

// ──────────────────────────────────────────
// 🔧 FONCTIONS UTILITAIRES — Affichage / Masquage
// ──────────────────────────────────────────

// Affiche ou cache le loader
function showLoader(visible) {
  document.getElementById("loader").style.display = visible ? "block" : "none";
}

// Cache la section des résultats
function hideResults() {
  document.getElementById("resultsSection").style.display = "none";
  // Réaffiche la bannière des critères écologiques
  const ecoBanner = document.getElementById("ecoCriteriaBanner");
  if (ecoBanner) {
    ecoBanner.style.display = "block";
  }
}

// Affiche un message d'erreur
function showError(message) {
  const errorMsg = document.getElementById("errorMsg");
  document.getElementById("errorText").textContent = message;
  errorMsg.style.display = "block";
}

// Cache le message d'erreur
function hideError() {
  document.getElementById("errorMsg").style.display = "none";
}

// ──────────────────────────────────────────
// 🏠 Retour à la page d'accueil
// Remet l'interface à zéro quand on clique sur le logo
// ──────────────────────────────────────────
function goHome() {
  // Vide le champ de recherche
  document.getElementById("cityInput").value = "";
  
  // Masque les résultats
  hideResults();
  
  // Masque les messages d'erreur
  hideError();
  
  // Réinitialise l'état global
  allHotels = [];
  currentCity = "";
  
  // Supprime la carte si elle existe
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  
  // Réaffiche la bannière des critères
  const ecoBanner = document.getElementById("ecoCriteriaBanner");
  if (ecoBanner) {
    ecoBanner.style.display = "block";
  }
  
  // Scroll en haut de la page
  window.scrollTo(0, 0);
}

// ──────────────────────────────────────────
async function initializeMap(hotels, city) {
  const mapElement = document.getElementById("map");

  // Géolocalisation de la ville avec Nominatim (gratuit)
  const geoLocation = await geocodeCity(city);

  if (!geoLocation) {
    console.warn("Impossible de géolocaliser la ville:", city);
    return;
  }

  // Crée la carte ou la réinitialise
  if (mapInstance) {
    mapInstance.remove();
  }

  const { lat, lon } = geoLocation;

  // Initialise Leaflet
  mapInstance = L.map("map").setView([lat, lon], 12);

  // Ajoute le tileset CartoDB Positron (moderne et épuré)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
    minZoom: 1,
    crossOrigin: true
  }).addTo(mapInstance);

  // Désactive le zoom au scroll par défaut
  mapInstance.scrollWheelZoom.disable();
  
  // Ajoute de meilleurs contrôles de zoom et attribution
  mapInstance.zoomControl.setPosition('bottomright');

  // Ajoute les marqueurs pour les hôtels
  addHotelMarkers(hotels, { lat, lon });
}

async function geocodeCity(city) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`
    );
    const data = await response.json();

    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error("Erreur de géolocalisation:", error);
  }

  return null;
}

function addHotelMarkers(hotels, cityCenter) {
  // Nettoie les anciens marqueurs
  markers.forEach((m) => m.remove());
  markers = [];

  // Crée une icône personnalisée SVG élégante pour les hôtels
  const createHotelIcon = () => {
    return L.divIcon({
      html: `
        <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
          <path d="M16 2C9.37 2 4 7.37 4 14c0 11 12 24 12 24s12-13 12-24c0-6.63-5.37-12-12-12z" fill="#0066cc"/>
          <circle cx="16" cy="14" r="3" fill="white"/>
        </svg>
      `,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -40],
      className: "hotel-map-icon"
    });
  };

  // Ajoute les marqueurs pour chaque hôtel avec une position légèrement aléatoire
  hotels.forEach((hotel, index) => {
    // Génère une position aléatoire autour du centre-ville
    const offsetLat = (Math.random() - 0.5) * 0.05; // ~5 km
    const offsetLon = (Math.random() - 0.5) * 0.05;
    const lat = cityCenter.lat + offsetLat;
    const lon = cityCenter.lon + offsetLon;

    // Crée un popup HTML stylisé
    const popupContent = `
      <div class="map-popup-hotel">
        <h4>${hotel.name}</h4>
        <p>📍 ${hotel.location}</p>
        <p class="hotel-price">${hotel.price}€<span style="font-size: 12px; color: var(--text-muted); font-weight: 400;"> / nuit</span></p>
        <p class="hotel-rating">⭐ ${hotel.rating.toFixed(1)} | ${hotel.stars}⭐</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">✨ ${hotel.highlights}</p>
      </div>
    `;

    const marker = L.marker([lat, lon], { icon: createHotelIcon() })
      .bindPopup(popupContent, {
        maxWidth: 280,
        className: "hotel-map-popup",
        closeButton: true
      })
      .addTo(mapInstance);

    // Ajoute des événements pour améliorer l'UX
    marker.on("mouseover", function() {
      this.setIcon(L.divIcon({
        html: `
          <svg width="38" height="48" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 12px rgba(0,102,204,0.4));">
            <path d="M16 2C9.37 2 4 7.37 4 14c0 11 12 24 12 24s12-13 12-24c0-6.63-5.37-12-12-12z" fill="#0052a3"/>
            <circle cx="16" cy="14" r="3" fill="white"/>
          </svg>
        `,
        iconSize: [38, 48],
        iconAnchor: [19, 48],
        popupAnchor: [0, -48],
        className: "hotel-map-icon"
      }));
      this.openPopup();
    });

    marker.on("mouseout", function() {
      this.setIcon(createHotelIcon());
    });

    markers.push(marker);
  });

  // Centre la carte sur tous les marqueurs
  if (markers.length > 0) {
    const group = new L.featureGroup(markers);
    const bounds = group.getBounds();
    mapInstance.fitBounds(bounds.pad(0.15), { animate: true, duration: 0.8 });
  }
}

// ──────────────────────────────────────────
// ⌨️ RACCOURCI CLAVIER — Touche "Entrée"
// Permet de lancer la recherche en appuyant sur Entrée
// ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("cityInput");
  const ecoBanner = document.getElementById("ecoCriteriaBanner");
  const resultsSection = document.getElementById("resultsSection");

  if (ecoBanner && resultsSection && resultsSection.style.display === "none") {
    ecoBanner.style.display = "block";
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchHotels();
    }
  });
});