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
- Comptes locaux multiples (nom + couleur personnalisables)
- Événements par compte avec sélecteur de couleur unique
- Ajout de calendriers ICS externes (Google Calendar secret URL, iCloud, Outlook, etc.)
- Vue journalière avec légende colorée par compte/calendrier
- Paramètres : gestion des comptes locaux (inline name edit, color picker), ajout ICS

### 7. Home Assistant ✅
- Interface style HA OS avec tuiles par domaine (lumières, switches, capteurs, volets, etc.)
- Icônes colorées par domaine
- Contrôle des lumières : color picker + slider luminosité pour lumières compatibles
- Couleur RGB réelle affichée sur l'icône de la tuile
- Volets et stores : boutons ouvrir/stop/fermer directement sur la tuile
- Prises connectées (switches) avec toggle
- Capteurs (température, humidité, etc.) avec état en temps réel
- Mises à jour via WebSocket Home Assistant

### 8. Contrôle Volume ✅
- Interface DJ deck/mixer avec knob circulaire SVG (strokeDasharray animation)
- VU-mètre LED avec niveaux colorés (vert → orange → rouge)
- Contrôles transport : précédent, play/pause (icône dynamique), suivant
- Sélecteur de périphérique audio de sortie (COM Interop Windows)
- Préréglages de volume rapides (0%, 25%, 50%, 75%, 100%)
- Bouton mute/unmute

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
- Flux par défaut adaptés à la langue de l'application (changement auto)
- Flux configurables dans localStorage
- Ticker crypto en temps réel (Bitcoin, Ethereum, etc. via CoinGecko)

### 13. Presse-papiers ✅
- Historique clipboard (texte + images)
- Polling 1s, max 20 items
- Copie en un clic

### 14. Uptime Kuma ✅
- Webview vers instance Uptime Kuma
- Module persistant

### 15. Paramètres ✅
- Thèmes prédéfinis (Sombre, Bleu Nuit, Forêt, Crépuscule, Clair) + couleurs personnalisées
- Sauvegarde des paramètres en fichier (survit aux mises à jour NSIS)
- Disposition sidebar + grille lanceur
- Ordre des modules + visibilité (inclut Voice Commands et Docker)
- Webviews personnalisées (jusqu'à 5)
- Sélecteur de langue (9 langues)
- Sélecteur d'écran de destination
- Démarrage automatique Windows (toggle)
- Licence Gumroad (activation/validation/désactivation)
- Section mises à jour automatiques (electron-updater)
- Guide utilisateur PDF (généré dynamiquement, 9 langues)
- Footer liens légaux : politique de confidentialité, CGU, contact
- Gestion dynamique des nouveaux modules dans l'ordre sidebar (ajout auto avant Settings)

### 16. Lanceur (StreamDeck) ✅
- Grille personnalisable (7x5 par défaut)
- 4 types : Application, Action système, Profil, Home Assistant
- Type Home Assistant : contrôle d'entités HA (lumières avec couleur + luminosité, switches, etc.)
- Icônes personnalisées (images base64)
- Export/Import config JSON
- Profils : groupes de boutons exécutés séquentiellement
- Persistance fichier (`launcher-buttons.json`) — survit aux mises à jour et limites localStorage

### 17. Monitoring+ ✅
- Affichage en courbes temps réel (CPU par cœur, GPU, réseau, disques)
- Couleurs personnalisables par widget
- Mode Gaming (détection automatique + activation manuelle)
- Barres de progression pour RAM, stockage et débit réseau
- Alertes température personnalisables avec notifications
- Test de débit internet intégré (Speedtest)

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

### 22. Mises à jour automatiques ✅
- GitHub Releases sur repo public `G33koun3t/PulseDeck--release`
- Vérification automatique au démarrage (délai 5s)
- Téléchargement en arrière-plan + barre de progression
- Bouton "Redémarrer et installer" quand la MAJ est prête
- Vérification manuelle depuis Settings
- Publication : `npm run publish` (inclut `--publish always`)

### 23. Site web (GitHub Pages) ✅
- Landing page : `website/index.html` (hébergée sur `g33koun3t.github.io/Monitoring-Dashboard/`)
- Privacy Policy : `website/privacy-policy.html`
- Terms of Use : `website/terms-of-use.html`
- Google site verification intégrée
- Screenshots des modules (13 images PNG déployées)

### 24. OBS Studio ✅
- Contrôle OBS via `obs-websocket-js` (WebSocket, pas webview)
- Changement de scènes, toggle sources (show/hide)
- Démarrage/arrêt stream et enregistrement
- Stats en temps réel : FPS, CPU, RAM, images perdues
- Auto-connexion et auto-reconnexion
- Chronomètre stream/enregistrement

### 25. Commandes Vocales ✅
- Reconnaissance vocale offline via **Vosk** (modèles téléchargés automatiquement par langue)
- Fallback **Web Speech API** si Vosk indisponible
- 9 langues supportées (FR, EN, DE, NL, ES, PT, IT, PL, JA)
- Changement de langue à chaud (redémarrage automatique du recognizer)
- Commandes Home Assistant : allumer/éteindre lumières, switches, scènes via alias configurables
- Configuration : sélection micro, alias d'entités HA (affiché uniquement si HA configuré)
- Historique des commandes avec horodatage
- Module : `src/main/voice.js` (IPC) + `src/renderer/modules/VoiceCommands.jsx`
- Protection crash : vérification `isDestroyed()` sur BrowserWindow avant envoi IPC

### 26. Docker (SSH) ✅
- Surveillance et contrôle de conteneurs Docker sur machines distantes via **SSH** (`ssh2`)
- Multi-hôtes : NAS, serveurs dev, etc. avec configuration individuelle (nom, couleur, auth password/clé)
- Liste conteneurs avec statuts colorés (running, exited, restarting, paused, dead, created)
- Détails conteneur : image, ports, volumes, variables d'environnement, restart policy
- Stats CPU/RAM en temps réel (polling 10s)
- Actions : start, stop, restart + logs (50 dernières lignes)
- Test de connexion SSH intégré
- Config stockée en fichier (`docker-hosts.json` dans userData)
- Module premium, icône sidebar personnalisée (baleine Docker SVG)
- Module : `src/main/docker.js` + `src/renderer/modules/Docker.jsx`

### 27. Cadre Photo ✅
- Diaporama d'images depuis un ou plusieurs dossiers locaux
- Transitions configurables : fondu, glissement, zoom, aucune
- Durée par photo ajustable (3-60 secondes)
- Durée de transition ajustable (0.3-3 secondes)
- Lecture aléatoire (shuffle Fisher-Yates)
- Crossfade à deux couches (swap activeLayer 0/1)
- Contrôles overlay : précédent, play/pause, suivant (auto-hide après 3s)
- État vide avec raccourci vers les paramètres
- Config persistée dans localStorage (`photoframe_config`, `photoframe_folders`)
- Réutilise les IPC existants (`selectScreenshotFolder`, `listScreenshots`)
- Affichage via protocole `local-file:///`
- Module : `src/renderer/modules/PhotoFrame.jsx` + `.css`

### 28. Persistance localStorage générique ✅
- Backup automatique de toutes les clés localStorage modules sur disque (`local-storage-backup.json`)
- Restauration automatique au démarrage si localStorage vide (survit aux mises à jour NSIS)
- 3 niveaux de backup :
  - `app-settings-backup.json` : thème, couleurs, langue, layout, sidebar, gaming mode
  - `launcher-buttons.json` : boutons du lanceur (images base64)
  - `local-storage-backup.json` : HA (url, token, domaines, entités cachées), OBS, News, Météo, Monitoring, Voice, Docker, Outils, Calendrier, Webviews custom
- Sauvegarde périodique (30s) + au blur (perte de focus) + initiale (5s)
- IPC : `save-local-storage-backup` / `load-local-storage-backup`

### 29. Procédure de publication d'une mise à jour
1. Incrémenter la version dans `package.json`
2. Créer un **Personal Access Token GitHub** (une seule fois) :
   - github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Scope : `repo` (accès complet)
   - Copier le token `ghp_...`
3. Build + publish :
   ```bash
   # PowerShell :
   $env:GH_TOKEN = "ghp_ton_token"; npm run publish
   # ou CMD :
   set GH_TOKEN=ghp_ton_token && npm run publish
   ```
4. electron-builder crée automatiquement une GitHub Release sur `G33koun3t/PulseDeck--release` avec :
   - `PulseDeck Setup x.x.x.exe` (installer)
   - `latest.yml` (métadonnées pour electron-updater)
5. Les utilisateurs existants reçoivent la notification au prochain démarrage (Settings → Mises à jour)

---

## Stack technique (VALIDÉE)

### Electron + React (migration Tauri v2 prévue)
- **Electron 31** : App desktop (migration Tauri v2 en cours pour réduire les ressources)
- **React 19** : Interface réactive et composants
- **Vite 7** : Build tool
- **Recharts** : Graphiques temps réel (courbes CPU, réseau)
- **systeminformation** : Données hardware (CPU, RAM, GPU, disques)
- **Node.js** : Backend pour APIs et IPC

### APIs et librairies
- **Open-Meteo** : Météo gratuite (pas de clé API)
- **Home Assistant** : API REST (états, services, lumières, volets)
- **Windows Audio API** : Contrôle volume (loudness + WASAPI COM)
- **Vosk** : Reconnaissance vocale offline (modèles par langue, via koffi FFI)
- **ssh2** : Connexion SSH pour Docker distant
- **obs-websocket-js** : Contrôle OBS Studio via WebSocket
- **rss-parser** : Lecteur RSS multi-flux
- **CoinGecko API** : Prix crypto en temps réel
- **Gumroad API** : Système de licence

## Architecture UI

**Fenêtre : 2560 x 720 pixels** (plein écran Xeneon Edge, taskbar ignorée)

### Layout
```
[Sidebar 80px] [Main Content ~1570px] [Lanceur ~910px]
```

- **Sidebar** : icônes lucide-react, ordre personnalisable, modules masquables
- **Contenu principal** : module actif plein cadre
- **Lanceur** : grille 7 colonnes, boutons personnalisables, centré verticalement

---

## Version actuelle : 1.2.1

## Notes

- Fichier créé le 04/02/2026
- Mise à jour le 04/02/2026 : Modules Volume, Home Assistant (volets) et Minuteur complétés
- Mise à jour le 07/02/2026 : Module Outils (Pomodoro, Notes, Screenshots), Visualiseur audio, Icône app, i18n complet, Police +2px
- Mise à jour le 08/02/2026 : Migration licence Gumroad, mises à jour automatiques (electron-updater), site web (GitHub Pages), privacy policy, terms of use
- Mise à jour le 13/02/2026 : HA redesign (tuiles HA OS, color picker, RGB), Volume DJ deck, Lanceur type HA, News auto-langue, Settings backup fichier, Guide PDF v3 (9 langues), OBS module, Footer légal, Screenshots GitHub Pages, version 1.1.2
- Mise à jour le 13/02/2026 : Module Commandes Vocales (Vosk + Web Speech, 9 langues), Module Docker (SSH multi-hôtes), Persistance localStorage générique (backup fichier toutes configs), Fix crash voice.js (isDestroyed), Fix processus exit (isQuitting + force-kill), Sidebar Docker icon (baleine SVG), Settings ordre modules dynamique, npmRebuild: false (prebuilds natifs), version 1.1.3
- Mise à jour le 14/02/2026 : Fix asar production — vosk-koffi.js (app.asar → app.asar.unpacked pour libvosk.dll), speedtest-net (binary path explicite pour ENOTDIR), suppression cpu-features avant build (script dist), version 1.1.5
- Mise à jour le 25/02/2026 : Calendrier refactorisé (suppression références Google, comptes locaux multiples avec couleurs uniques), Module Cadre Photo (diaporama, transitions, shuffle), Lanceur centré verticalement, Photoframe dans ordre modules Settings, Suppression visualiseur audio Volume, version 1.2.1
- Mise à jour le 25/02/2026 : Plan de migration Electron → Tauri v2 approuvé (réduction ressources ~80% RAM, ~10 Mo vs ~150 Mo)

## Légende
- ✅ Complété
- ⏳ À faire
