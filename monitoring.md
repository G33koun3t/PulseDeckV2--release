# Application Monitoring - Pense-bête

## Configuration matérielle

- **Écran** : Corsair Xeneon Edge (écran tactile)
- **Résolution** : 2560 x 720 (ratio 32:9)
- **Format** : Ultra-wide
- **Disposition** :
  - Zone application : **1650 x 680 px** (partie gauche)
  - Stream Deck virtuel : ~910px (partie droite) - NE PAS UTILISER
  - Position : écran Xeneon détecté automatiquement
- **Domotique** : Home Assistant déjà en place

## Contraintes UI

- Interface optimisée pour écran tactile
- Doit éviter la zone Stream Deck sur la droite
- Design adapté au format ultra-wide

---

## Fonctionnalités

### 1. Monitoring PC ✅
- Courbes temps réel des différents cœurs CPU
- Utilisation de la RAM (graphique + pourcentage)
- Espace libre sur les disques (barres de progression)
- Températures : CPU, GPU, disques, carte mère
- Fréquences CPU/GPU
- Ventilateurs (RPM)

### 2. WhatsApp ✅
- Intégration WhatsApp Web
- Notifications
- Réponse rapide tactile

### 3. Météo ✅
- Météo actuelle (température, conditions)
- Prévisions sur plusieurs jours
- Localisation automatique ou manuelle

### 4. SoundCloud ⏳
- Lecteur intégré
- Contrôles tactiles (play/pause, skip, volume)
- Affichage pochette/titre

### 5. YouTube Music ⏳
- Lecteur intégré
- Contrôles tactiles
- Playlists favorites

### 6. Calendrier ✅
- Événements du jour
- Rappels
- Synchronisation (Google Calendar ?)

### 7. Home Assistant ✅
- Contrôle des lumières
- Prises connectées (switches)
- Volets et stores (avec boutons ouvrir/stop/fermer)
- Capteurs (température, humidité, etc.)
- État des appareils

### 8. Contrôle Volume ✅
- Slider tactile global (via package `loudness`)
- Bouton mute/unmute
- Sélecteur de périphérique audio (COM Interop Windows)
- Contrôles média (prev/play-pause/next via virtual media keys)
- Barres de volume visuelles (20 barres)
- Préréglages volume (0%, 25%, 50%, 75%, 100%)
- Visualiseur audio temps réel (Web Audio API + Canvas)

### 9. Outils (ex-Minuteur) ✅
- **5 onglets** : Pomodoro, Minuteur, Chronomètre, Notes, Captures d'écran
- Icône sidebar : Wrench (clé à molette)
- **Pomodoro** : Travail/Pause courte/Pause longue, cercle SVG, sessions, config (durées, auto-transition), persistance localStorage
- **Minuteur** : presets (1min, 5min, 10min, 15min, 30min, 1h), personnalisé (min+sec), cercle de progression SVG, alarme sonore
- **Chronomètre** : millisecondes, tours (laps) avec intervalles
- **Notes** : multiples notes avec catégories colorées (Personnel, Travail, Idées, Urgent, Autre), recherche, CRUD, localStorage `outils_notes`
- **Captures d'écran** : bouton capture (desktopCapturer), dossier configurable, galerie thumbnails, preview plein écran, suppression
- Architecture : `modules/Outils.jsx` + `modules/outils/` (Pomodoro, Minuteur, Chronometre, Notes, Screenshots, timerUtils)
- Module key reste `timer` dans App.jsx/Sidebar/Settings pour compatibilité localStorage

### 10. Twitch ⏳
- Streams en direct suivis
- Aperçu des viewers
- Lancer un stream dans le navigateur ou embed

### 11. Spotify ✅
- Webview intégrée (persistent, ne coupe pas la musique)
- Session persistante (partition: persist:spotify)

### 12. Actualités (RSS) ✅
- Lecteur RSS multi-flux avec catégories (gaming, tech, deals)
- Images extraites (enclosure, media:content, media:thumbnail)
- Rafraîchissement automatique toutes les 5 min
- Flux configurables dans localStorage

### 13. Presse-papiers ✅
- Historique clipboard (texte + images)
- Polling 1s, max 20 items
- Copie en un clic

### 14. Uptime Kuma ✅
- Webview vers instance Uptime Kuma
- Module persistant

### 15. Paramètres ✅
- Thèmes prédéfinis + couleurs personnalisées
- Disposition sidebar + grille lanceur
- Ordre des modules + visibilité
- Webviews personnalisées (jusqu'à 5)
- Sélecteur de langue (9 langues)
- Démarrage automatique Windows (toggle)
- Licence Gumroad
- Section mises à jour automatiques (electron-updater)

### 16. Lanceur (StreamDeck) ✅
- Grille personnalisable (7x5 par défaut)
- 3 types : Application, Action système, Profil
- Icônes personnalisées (images base64)
- Export/Import config JSON

### 17. Monitoring+ ✅
- Résumé performances (MiniGauge SVG)
- Alertes température (CPU, GPU, RAM)
- Speedtest intégré (speedtest-net)

### 18. Icône application ✅
- Fichier `monitoring.ico` à la racine
- Référencé dans package.json et main.js

### 19. Multi-langue (i18n) ✅
- 9 langues : FR, EN, DE, NL, ES, PT, IT, PL, JA
- Système léger custom (React Context)
- Français par défaut, fallback automatique

### 20. Police globale ✅
- Font-size body: 18px (augmenté de 16px)
- Toutes les tailles explicites augmentées de +2px

### 21. Système de licence (Gumroad) ✅
- Activation/validation via API Gumroad (`POST /v2/licenses/verify`)
- Machine fingerprint via `node-machine-id` + SHA256
- Grace period offline de 7 jours
- Fichier licence : `%APPDATA%/monitoring-dashboard/license.json`
- Version gratuite (modules limités : monitoring, volume, news, settings)
- URL store : `https://4620487871362.gumroad.com/l/PulseDeck`

### 22. Mises à jour automatiques (electron-updater) ✅
- `electron-updater` + GitHub Releases sur repo public `G33koun3t/PulseDeck--release`
- Vérification automatique au démarrage (délai 5s)
- Téléchargement en arrière-plan + barre de progression
- Bouton "Redémarrer et installer" quand la MAJ est prête
- Vérification manuelle depuis Settings
- Module dédié : `src/main/updater.js`
- Publication : `set GH_TOKEN=xxx && npm run dist -- --publish always`

### 23. Site web (GitHub Pages) ✅
- Landing page : `website/index.html` (hébergée sur `g33koun3t.github.io/Monitoring-Dashboard/`)
- Privacy Policy : `website/privacy-policy.html`
- Terms of Use : `website/terms-of-use.html`
- Google site verification intégrée

### 24. Procédure de publication d'une mise à jour
1. Incrémenter la version dans `package.json` (ex: `"version": "1.0.0"` → `"version": "1.1.0"`)
2. Créer un **Personal Access Token GitHub** (une seule fois) :
   - github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Scope : `repo` (accès complet)
   - Copier le token `ghp_...`
3. Build + publish :
   ```bash
   set GH_TOKEN=ghp_ton_token && npm run dist -- --publish always
   ```
4. electron-builder crée automatiquement une GitHub Release sur `G33koun3t/PulseDeck--release` avec :
   - `PulseDeck Setup x.x.x.exe` (installer)
   - `latest.yml` (métadonnées pour electron-updater)
5. Les utilisateurs existants reçoivent la notification au prochain démarrage (Settings → Mises à jour)

---

## Stack technique (VALIDÉE)

### Electron + React
- **Electron** : App desktop cross-platform
- **React** : Interface réactive et composants
- **Recharts/Chart.js** : Graphiques temps réel
- **systeminformation** : Données hardware (CPU, RAM, GPU, disques)
- **Node.js** : Backend pour APIs

### APIs externes
- **OpenWeatherMap** : Météo (gratuit)
- **WhatsApp Web** : Via webview intégré
- **SoundCloud/YouTube** : Embeds ou APIs
- **Home Assistant** : API REST + WebSocket (temps réel)
- **Windows Audio API** : Contrôle volume (node-audio-windows ou similar)

## Architecture UI

**Dimensions finales : 1650 x 680 pixels**
**11 modules au total**

### Menu latéral gauche (VALIDÉ)
- Menu compact avec icônes : **80px de large**
- Zone contenu : **1570 x 680 pixels**
- Icônes tactiles avec feedback visuel

```
┌──────┬─────────────────────────────────────────────────────┬──────────┐
│ MENU │              CONTENU ACTIF (1840px)                 │ STREAM   │
│(80px)│                                                     │ DECK     │
│      │                                                     │ (640px)  │
│ 🖥️  │  ┌─────────────────────────────────────────────────┐ │          │
│ 💬  │  │                                                 │ │          │
│ ☀️  │  │                                                 │ │          │
│ 📅  │  │         Widget / App sélectionné                │ │   NE     │
│ 🏠  │  │              (pleine zone)                      │ │   PAS    │
│ 🔊  │  │                                                 │ │  TOUCH   │
│ ⏱️  │  │                                                 │ │          │
│ 📺  │  └─────────────────────────────────────────────────┘ │          │
│ 🎵  │                                                     │          │
│ 🎧  │                                                     │          │
│ 🎶  │                                                     │          │
└──────┴─────────────────────────────────────────────────────┴──────────┘
```

## Navigation
- **Swipe horizontal** : Changer de module
- **Tabs tactiles** : Navigation rapide en haut
- **Widgets redimensionnables** : Personnalisation de la disposition

---

## Notes

- Fichier créé le 04/02/2026
- Mise à jour le 04/02/2026 : Modules Volume, Home Assistant (volets) et Minuteur complétés
- Mise à jour le 07/02/2026 : Module Outils (Pomodoro, Notes, Screenshots), Visualiseur audio, Icône app, i18n complet, Police +2px
- Mise à jour le 08/02/2026 : Migration licence Gumroad, mises à jour automatiques (electron-updater), site web (GitHub Pages), privacy policy, terms of use

## Légende
- ✅ Complété
- ⏳ À faire
