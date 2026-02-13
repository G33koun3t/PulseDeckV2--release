const { BrowserWindow, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');

const GUIDE_VERSION = '3';

const MODULE_KEYS = [
  'monitoring', 'weather', 'calendar', 'homeassistant',
  'volume', 'tools', 'news', 'clipboard', 'obs',
  'streaming', 'uptimekuma',
  'customWebviews', 'launcher', 'settingsModule'
];

const C = {
  fr: {
    guideTitle: 'Guide Utilisateur',
    forDevice: 'pour Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Table des mati\u00e8res',
    overviewTitle: 'Pr\u00e9sentation',
    overviewDesc: 'PulseDeck est un tableau de bord tout-en-un con\u00e7u pour l\u2019\u00e9cran tactile Corsair Xeneon Edge. Il permet de surveiller votre syst\u00e8me, contr\u00f4ler vos m\u00e9dias, g\u00e9rer vos applications et bien plus encore, le tout depuis une interface unique optimis\u00e9e pour l\u2019affichage ultra-large.',
    layoutTitle: 'Disposition de l\u2019\u00e9cran',
    layoutSidebar: 'Barre lat\u00e9rale (gauche) \u2014 Navigation entre les modules',
    layoutMain: 'Zone principale (centre) \u2014 Affichage du module actif',
    layoutLauncher: 'Lanceur (droite) \u2014 Grille de raccourcis personnalisables',
    modulesTitle: 'Modules',
    setupLabel: 'Configuration',
    monitoring: { name: 'Monitoring', desc: 'Surveillance de votre syst\u00e8me en temps r\u00e9el avec graphiques en courbes.', features: ['Courbes temps r\u00e9el par c\u0153ur CPU, GPU, r\u00e9seau et disques', 'Barres de progression pour RAM, stockage et d\u00e9bit r\u00e9seau', 'Couleurs personnalisables par widget', 'Alertes de temp\u00e9rature personnalisables avec notifications', 'Test de d\u00e9bit internet int\u00e9gr\u00e9 (Speedtest)', 'Mode Gaming \u2014 d\u00e9tection automatique ou activation manuelle'] },
    weather: { name: 'M\u00e9t\u00e9o', desc: 'Pr\u00e9visions m\u00e9t\u00e9orologiques pour votre ville.', features: ['Conditions actuelles et pr\u00e9visions multi-jours', 'Recherche de ville avec autocompl\u00e9tion', 'Donn\u00e9es fournies par Open-Meteo'] },
    calendar: { name: 'Calendrier', desc: 'Gestion d\u2019agenda avec support multi-calendriers.', features: ['Connexion Google Calendar via OAuth2', 'Support de calendriers ICS externes', 'Affichage des \u00e9v\u00e9nements \u00e0 venir', 'Cr\u00e9ation rapide d\u2019\u00e9v\u00e9nements Google'], setup: 'Connectez votre compte Google ou ajoutez des URLs de calendriers ICS.' },
    homeassistant: { name: 'Home Assistant', desc: 'Contr\u00f4le de votre maison connect\u00e9e avec une interface style HA OS.', features: ['Interface en tuiles par domaine (lumi\u00e8res, interrupteurs, capteurs, volets, etc.)', 'Ic\u00f4nes color\u00e9es selon le domaine de l\u2019entit\u00e9', 'Volets : boutons ouvrir / stop / fermer directement sur la tuile', 'Lumi\u00e8res : color picker et slider de luminosit\u00e9 pour les lampes compatibles', 'Couleur RGB r\u00e9elle affich\u00e9e sur l\u2019ic\u00f4ne de la lumi\u00e8re', 'Mises \u00e0 jour en temps r\u00e9el via WebSocket'], setup: 'Entrez l\u2019URL de votre instance Home Assistant et un token d\u2019acc\u00e8s longue dur\u00e9e (Profil \u2192 Tokens).' },
    volume: { name: 'Volume & M\u00e9dias', desc: 'Interface DJ deck/mixer avec contr\u00f4le audio avanc\u00e9 et visualiseur.', features: ['Knob circulaire SVG pour le volume syst\u00e8me', 'VU-m\u00e8tre LED avec niveaux color\u00e9s', 'Contr\u00f4les transport : pr\u00e9c\u00e9dent, lecture/pause (ic\u00f4ne dynamique), suivant', 'Visualiseur audio en temps r\u00e9el (64 barres)', 'S\u00e9lection du p\u00e9riph\u00e9rique audio de sortie', 'Pr\u00e9r\u00e9glages de volume rapides'] },
    tools: { name: 'Outils', desc: 'Suite de 5 outils de productivit\u00e9.', features: ['Pomodoro \u2014 Minuteur de productivit\u00e9 configurable', 'Minuteur \u2014 Compte \u00e0 rebours personnalisable', 'Chronom\u00e8tre \u2014 Chronom\u00e9trage avec tours', 'Notes \u2014 Prise de notes avec cat\u00e9gories color\u00e9es', 'Captures d\u2019\u00e9cran \u2014 Capture et galerie d\u2019images'] },
    news: { name: 'Actualit\u00e9s & Crypto', desc: 'Lecteur de flux RSS avec ticker de cryptomonnaies.', features: ['Flux RSS personnalisables par cat\u00e9gorie (jeux, tech, bons plans)', 'Flux par d\u00e9faut adapt\u00e9s \u00e0 votre langue', 'Changement automatique des flux lors du changement de langue', 'Rafra\u00eechissement automatique toutes les 5 minutes', 'Ticker crypto en temps r\u00e9el (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Presse-papiers', desc: 'Historique automatique du presse-papiers.', features: ['Historique automatique (20 \u00e9l\u00e9ments maximum)', 'Support texte et images', 'Copie rapide en un clic'] },
    obs: { name: 'OBS Studio', desc: 'Contr\u00f4le natif d\u2019OBS Studio via WebSocket.', features: ['Changement de sc\u00e8nes en un clic', 'Activation/d\u00e9sactivation des sources', 'Contr\u00f4le du stream et de l\u2019enregistrement', 'Statistiques en direct (FPS, CPU, images perdues, RAM)'], setup: 'Activez le serveur WebSocket dans OBS (Param\u00e8tres \u2192 Serveur WebSocket), puis connectez-vous avec ws://localhost:4455.' },
    streaming: { name: 'Services de streaming', desc: 'Spotify, SoundCloud, YouTube Music et Twitch int\u00e9gr\u00e9s au tableau de bord.', features: ['Interface web int\u00e9gr\u00e9e pour chaque service', 'Sessions persistantes \u2014 la lecture continue en arri\u00e8re-plan', 'Chaque service conserve sa connexion entre les sessions'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Surveillance de serveurs via votre instance Uptime Kuma.', features: ['Interface web int\u00e9gr\u00e9e', 'Session persistante'], setup: 'Entrez l\u2019URL de votre instance Uptime Kuma.' },
    customWebviews: { name: 'Webviews personnalis\u00e9es', desc: 'Ajoutez n\u2019importe quel site web comme module.', features: ['Jusqu\u2019\u00e0 5 webviews personnalis\u00e9es', 'Sessions persistantes', 'Ic\u00f4ne et nom personnalisables', 'Configurable dans les Param\u00e8tres'] },
    launcher: { name: 'Lanceur', desc: 'Panneau de raccourcis sur le c\u00f4t\u00e9 droit de l\u2019\u00e9cran.', features: ['Grille de boutons personnalisables', 'Quatre types : Application, Syst\u00e8me (arr\u00eat, red\u00e9marrage, veille\u2026), Profil, Home Assistant', 'Contr\u00f4le de lumi\u00e8res HA avec choix de couleur et luminosit\u00e9', 'Ic\u00f4nes personnalisables (PNG, JPG, ICO, WebP)', 'Export/import de la configuration en JSON'] },
    settingsModule: { name: 'Param\u00e8tres', desc: 'Configuration compl\u00e8te de l\u2019application.', features: ['Choix de la langue (9 langues)', 'Th\u00e8mes de couleurs pr\u00e9d\u00e9finis et personnalis\u00e9s', 'Ordre et visibilit\u00e9 des modules', 'Dimensions de la barre lat\u00e9rale et du lanceur', 'S\u00e9lecteur d\u2019\u00e9cran de destination', 'D\u00e9marrage automatique avec Windows', 'Mises \u00e0 jour automatiques (v\u00e9rification, t\u00e9l\u00e9chargement, installation)', 'Gestion de la licence', 'Webviews personnalis\u00e9es', 'Liens : politique de confidentialit\u00e9, conditions d\u2019utilisation, contact'] },
    footerText: 'PulseDeck \u2014 Guide g\u00e9n\u00e9r\u00e9 automatiquement',
  },
  en: {
    guideTitle: 'User Guide',
    forDevice: 'for Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Table of Contents',
    overviewTitle: 'Overview',
    overviewDesc: 'PulseDeck is an all-in-one dashboard designed for the Corsair Xeneon Edge touchscreen. It lets you monitor your system, control your media, manage your applications and more, all from a single interface optimized for ultra-wide display.',
    layoutTitle: 'Screen Layout',
    layoutSidebar: 'Sidebar (left) \u2014 Navigate between modules',
    layoutMain: 'Main area (center) \u2014 Active module display',
    layoutLauncher: 'Launcher (right) \u2014 Customizable shortcut grid',
    modulesTitle: 'Modules',
    setupLabel: 'Setup',
    monitoring: { name: 'Monitoring', desc: 'Real-time system monitoring with curve charts.', features: ['Real-time curves per CPU core, GPU, network and disks', 'Progress bars for RAM, storage and network throughput', 'Customizable colors per widget', 'Customizable temperature alerts with notifications', 'Built-in internet speed test (Speedtest)', 'Gaming Mode \u2014 automatic detection or manual activation'] },
    weather: { name: 'Weather', desc: 'Weather forecast for your city.', features: ['Current conditions and multi-day forecast', 'City search with autocomplete', 'Data provided by Open-Meteo'] },
    calendar: { name: 'Calendar', desc: 'Calendar management with multi-calendar support.', features: ['Google Calendar connection via OAuth2', 'External ICS calendar support', 'Upcoming events display', 'Quick Google event creation'], setup: 'Connect your Google account or add ICS calendar URLs in the module settings.' },
    homeassistant: { name: 'Home Assistant', desc: 'Smart home control with HA OS-style interface.', features: ['Tile interface organized by domain (lights, switches, sensors, covers, etc.)', 'Color-coded icons by entity domain', 'Covers: open / stop / close buttons directly on tile', 'Lights: color picker and brightness slider for compatible bulbs', 'Real RGB color displayed on the light icon', 'Real-time updates via WebSocket'], setup: 'Enter your Home Assistant instance URL and a long-lived access token (Profile \u2192 Tokens).' },
    volume: { name: 'Volume & Media', desc: 'DJ deck/mixer interface with advanced audio control and visualizer.', features: ['SVG circular knob for system volume', 'LED VU-meter with color-coded levels', 'Transport controls: previous, play/pause (dynamic icon), next', 'Real-time audio visualizer (64 bars)', 'Audio output device selection', 'Quick volume presets'] },
    tools: { name: 'Tools', desc: 'Suite of 5 productivity tools.', features: ['Pomodoro \u2014 Configurable productivity timer', 'Timer \u2014 Customizable countdown', 'Stopwatch \u2014 Timing with lap recording', 'Notes \u2014 Note-taking with colored categories', 'Screenshots \u2014 Screen capture and image gallery'] },
    news: { name: 'News & Crypto', desc: 'RSS feed reader with cryptocurrency ticker.', features: ['Customizable RSS feeds by category (gaming, tech, deals)', 'Default feeds adapted to your language', 'Automatic feed switch when changing language', 'Automatic refresh every 5 minutes', 'Real-time crypto ticker (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Clipboard', desc: 'Automatic clipboard history.', features: ['Automatic history (up to 20 items)', 'Text and image support', 'One-click copy'] },
    obs: { name: 'OBS Studio', desc: 'Native OBS Studio control via WebSocket.', features: ['One-click scene switching', 'Source visibility toggle', 'Stream and recording control', 'Live statistics (FPS, CPU, dropped frames, RAM)'], setup: 'Enable the WebSocket server in OBS (Settings \u2192 WebSocket Server), then connect with ws://localhost:4455.' },
    streaming: { name: 'Streaming Services', desc: 'Access Spotify, SoundCloud, YouTube Music and Twitch from the dashboard.', features: ['Built-in web interface for each service', 'Persistent sessions \u2014 playback continues in background', 'Each service keeps its connection between sessions'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Server monitoring via your Uptime Kuma instance.', features: ['Built-in web interface', 'Persistent session'], setup: 'Enter the URL of your Uptime Kuma instance.' },
    customWebviews: { name: 'Custom Webviews', desc: 'Add any website as a module.', features: ['Up to 5 custom webviews', 'Persistent sessions', 'Customizable icon and name', 'Configurable in Settings'] },
    launcher: { name: 'Launcher', desc: 'Shortcut panel on the right side of the screen.', features: ['Customizable button grid', 'Four types: Application, System (shutdown, restart, sleep\u2026), Profile, Home Assistant', 'HA light control with color and brightness selection', 'Custom icons (PNG, JPG, ICO, WebP)', 'JSON configuration export/import'] },
    settingsModule: { name: 'Settings', desc: 'Full application configuration.', features: ['Language selection (9 languages)', 'Preset and custom color themes', 'Module order and visibility', 'Sidebar and launcher dimensions', 'Target display selector', 'Auto-start with Windows', 'Automatic updates (check, download, install)', 'License management', 'Custom webviews', 'Links: privacy policy, terms of use, contact'] },
    footerText: 'PulseDeck \u2014 Automatically generated guide',
  },
  de: {
    guideTitle: 'Benutzerhandbuch',
    forDevice: 'f\u00fcr Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Inhaltsverzeichnis',
    overviewTitle: '\u00dcberblick',
    overviewDesc: 'PulseDeck ist ein All-in-One-Dashboard f\u00fcr den Corsair Xeneon Edge Touchscreen. Es erm\u00f6glicht die \u00dcberwachung Ihres Systems, die Steuerung Ihrer Medien und die Verwaltung Ihrer Anwendungen \u2013 alles in einer f\u00fcr Ultra-Wide-Displays optimierten Oberfl\u00e4che.',
    layoutTitle: 'Bildschirmaufteilung',
    layoutSidebar: 'Seitenleiste (links) \u2014 Navigation zwischen Modulen',
    layoutMain: 'Hauptbereich (Mitte) \u2014 Anzeige des aktiven Moduls',
    layoutLauncher: 'Launcher (rechts) \u2014 Anpassbares Verkn\u00fcpfungsraster',
    modulesTitle: 'Module',
    setupLabel: 'Einrichtung',
    monitoring: { name: 'Monitoring', desc: 'Echtzeit-System\u00fcberwachung mit Kurvendiagrammen.', features: ['Echtzeitkurven pro CPU-Kern, GPU, Netzwerk und Festplatten', 'Fortschrittsbalken f\u00fcr RAM, Speicher und Netzwerkdurchsatz', 'Anpassbare Farben pro Widget', 'Anpassbare Temperaturwarnungen mit Benachrichtigungen', 'Integrierter Internet-Speedtest', 'Gaming-Modus \u2014 automatische Erkennung oder manuelle Aktivierung'] },
    weather: { name: 'Wetter', desc: 'Wettervorhersage f\u00fcr Ihre Stadt.', features: ['Aktuelle Bedingungen und mehrt\u00e4gige Vorhersage', 'Stadtsuche mit Autovervollst\u00e4ndigung', 'Daten von Open-Meteo'] },
    calendar: { name: 'Kalender', desc: 'Kalenderverwaltung mit Multi-Kalender-Unterst\u00fctzung.', features: ['Google Calendar-Verbindung \u00fcber OAuth2', 'Externe ICS-Kalender-Unterst\u00fctzung', 'Anzeige bevorstehender Termine', 'Schnelle Google-Terminerstellung'], setup: 'Verbinden Sie Ihr Google-Konto oder f\u00fcgen Sie ICS-Kalender-URLs in den Moduleinstellungen hinzu.' },
    homeassistant: { name: 'Home Assistant', desc: 'Smart-Home-Steuerung mit HA OS-Oberfl\u00e4che.', features: ['Kacheloberfl\u00e4che nach Dom\u00e4ne (Lichter, Schalter, Sensoren, Rolladen usw.)', 'Farbcodierte Symbole nach Entit\u00e4tsdom\u00e4ne', 'Rolladen: \u00d6ffnen / Stop / Schlie\u00dfen direkt auf der Kachel', 'Lichter: Farbauswahl und Helligkeitsregler f\u00fcr kompatible Lampen', 'Echte RGB-Farbe auf dem Lichtsymbol angezeigt', 'Echtzeit-Updates \u00fcber WebSocket'], setup: 'Geben Sie die URL Ihrer Home Assistant-Instanz und ein langlebiges Zugriffstoken ein (Profil \u2192 Tokens).' },
    volume: { name: 'Lautst\u00e4rke & Medien', desc: 'DJ-Deck/Mixer-Oberfl\u00e4che mit erweiterter Audiosteuerung und Visualizer.', features: ['SVG-Drehknopf f\u00fcr Systemlautst\u00e4rke', 'LED-VU-Meter mit farbcodierten Pegeln', 'Transportsteuerung: Zur\u00fcck, Play/Pause (dynamisches Symbol), Weiter', 'Echtzeit-Audio-Visualizer (64 Balken)', 'Auswahl des Audio-Ausgabeger\u00e4ts', 'Schnelle Lautst\u00e4rke-Voreinstellungen'] },
    tools: { name: 'Werkzeuge', desc: 'Suite mit 5 Produktivit\u00e4tswerkzeugen.', features: ['Pomodoro \u2014 Konfigurierbarer Produktivit\u00e4tstimer', 'Timer \u2014 Anpassbarer Countdown', 'Stoppuhr \u2014 Zeitmessung mit Rundenaufzeichnung', 'Notizen \u2014 Notizen mit farbigen Kategorien', 'Screenshots \u2014 Bildschirmaufnahme und Bildergalerie'] },
    news: { name: 'Nachrichten & Crypto', desc: 'RSS-Feed-Reader mit Kryptow\u00e4hrungs-Ticker.', features: ['Anpassbare RSS-Feeds nach Kategorie (Gaming, Tech, Angebote)', 'Standard-Feeds angepasst an Ihre Sprache', 'Automatischer Feed-Wechsel bei Sprach\u00e4nderung', 'Automatische Aktualisierung alle 5 Minuten', 'Echtzeit-Crypto-Ticker (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Zwischenablage', desc: 'Automatischer Zwischenablage-Verlauf.', features: ['Automatischer Verlauf (bis zu 20 Eintr\u00e4ge)', 'Text- und Bildunterst\u00fctzung', 'Kopieren mit einem Klick'] },
    obs: { name: 'OBS Studio', desc: 'Native OBS Studio-Steuerung \u00fcber WebSocket.', features: ['Szenenwechsel mit einem Klick', 'Quellensichtbarkeit umschalten', 'Stream- und Aufnahmesteuerung', 'Live-Statistiken (FPS, CPU, verlorene Frames, RAM)'], setup: 'Aktivieren Sie den WebSocket-Server in OBS (Einstellungen \u2192 WebSocket-Server) und verbinden Sie sich mit ws://localhost:4455.' },
    streaming: { name: 'Streaming-Dienste', desc: 'Zugriff auf Spotify, SoundCloud, YouTube Music und Twitch aus dem Dashboard.', features: ['Integrierte Weboberfl\u00e4che f\u00fcr jeden Dienst', 'Persistente Sitzungen \u2014 Wiedergabe l\u00e4uft im Hintergrund weiter', 'Jeder Dienst beh\u00e4lt seine Verbindung zwischen Sitzungen'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Server\u00fcberwachung \u00fcber Ihre Uptime Kuma-Instanz.', features: ['Integrierte Weboberfl\u00e4che', 'Persistente Sitzung'], setup: 'Geben Sie die URL Ihrer Uptime Kuma-Instanz ein.' },
    customWebviews: { name: 'Benutzerdefinierte Webviews', desc: 'F\u00fcgen Sie beliebige Websites als Modul hinzu.', features: ['Bis zu 5 benutzerdefinierte Webviews', 'Persistente Sitzungen', 'Anpassbares Symbol und Name', 'Konfigurierbar in den Einstellungen'] },
    launcher: { name: 'Launcher', desc: 'Verkn\u00fcpfungspanel auf der rechten Seite des Bildschirms.', features: ['Anpassbares Schaltfl\u00e4chenraster', 'Vier Typen: Anwendung, System (Herunterfahren, Neustart, Ruhezustand\u2026), Profil, Home Assistant', 'HA-Lichtsteuerung mit Farb- und Helligkeitsauswahl', 'Benutzerdefinierte Symbole (PNG, JPG, ICO, WebP)', 'JSON-Konfigurationsexport/-import'] },
    settingsModule: { name: 'Einstellungen', desc: 'Vollst\u00e4ndige Anwendungskonfiguration.', features: ['Sprachauswahl (9 Sprachen)', 'Voreingestellte und benutzerdefinierte Farbthemen', 'Modulreihenfolge und Sichtbarkeit', 'Seitenleisten- und Launcher-Abmessungen', 'Zielbildschirm-Auswahl', 'Autostart mit Windows', 'Automatische Updates (Pr\u00fcfung, Download, Installation)', 'Lizenzverwaltung', 'Benutzerdefinierte Webviews', 'Links: Datenschutzrichtlinie, Nutzungsbedingungen, Kontakt'] },
    docker: { name: 'Docker', desc: '\u00dcberwachung und Steuerung von Docker-Containern auf entfernten Maschinen \u00fcber SSH.', features: ['SSH-Verbindung per Passwort oder privatem Schl\u00fcssel', 'Container-Liste mit Echtzeit-Status (running, stopped, paused)', 'CPU- und RAM-Statistiken pro Container (10s Aktualisierung)', 'Vollst\u00e4ndige Details: Image, Ports, Volumes, Umgebungsvariablen, Restart-Policy', 'Aktionen: Container starten, stoppen, neustarten', 'Log-Ansicht (letzte 50 Zeilen)', 'Multi-Host-Unterst\u00fctzung mit benutzerdefinierten Farben', 'Integrierter Verbindungstest'], setup: 'Voraussetzungen auf dem Remote-Server:\n1. SSH aktiviert (sudo apt install openssh-server && sudo systemctl enable --now ssh)\n2. Docker installiert (curl -fsSL https://get.docker.com | sudo sh)\n3. Benutzer in der Docker-Gruppe (sudo usermod -aG docker BENUTZER)\n\nIn PulseDeck: Klicken Sie auf \"+ Host hinzuf\u00fcgen\", geben Sie IP-Adresse, SSH-Port (22), Benutzername und Passwort ein oder w\u00e4hlen Sie einen SSH-Schl\u00fcssel. Testen Sie die Verbindung vor dem Speichern.' },
    voicecommands: { name: 'Sprachbefehle', desc: 'Offline-Sprachsteuerung von PulseDeck \u00fcber Vosk-Erkennung.', features: ['Offline-Spracherkennung (keine Daten werden ins Internet gesendet)', 'Automatischer Download des Sprachmodells (~40 MB)', '9 Sprachen unterst\u00fctzt (FR, EN, DE, NL, ES, PT, IT, PL, JA)', 'Systembefehle: Herunterfahren, Neustart, Ruhezustand, Sperren', 'Medienbefehle: Abspielen, Pause, N\u00e4chster, Vorheriger', 'Lautst\u00e4rkeregelung: Einstellen, Lauter, Leiser, Stumm', 'Home Assistant: Lichter ein-/ausschalten, Rolladen \u00f6ffnen/schlie\u00dfen (nach Name)', 'OBS: Stream und Aufnahme starten/stoppen', 'Befehlsverlauf mit Status'], setup: 'W\u00e4hlen Sie Ihr Mikrofon im Modul aus und klicken Sie auf die Mikrofon-Taste zum Starten. Das Sprachmodell der in den Einstellungen gew\u00e4hlten Sprache wird beim ersten Start automatisch heruntergeladen.' },
    footerText: 'PulseDeck \u2014 Automatisch generiertes Handbuch',
  },
  nl: {
    guideTitle: 'Gebruikershandleiding',
    forDevice: 'voor Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Inhoudsopgave',
    overviewTitle: 'Overzicht',
    overviewDesc: 'PulseDeck is een alles-in-\u00e9\u00e9n dashboard ontworpen voor het Corsair Xeneon Edge touchscreen. Het stelt u in staat uw systeem te monitoren, media te bedienen en applicaties te beheren, allemaal vanuit \u00e9\u00e9n interface geoptimaliseerd voor ultra-breed scherm.',
    layoutTitle: 'Schermindeling',
    layoutSidebar: 'Zijbalk (links) \u2014 Navigatie tussen modules',
    layoutMain: 'Hoofdgebied (midden) \u2014 Weergave van actieve module',
    layoutLauncher: 'Launcher (rechts) \u2014 Aanpasbaar snelkoppelingsraster',
    modulesTitle: 'Modules',
    setupLabel: 'Configuratie',
    monitoring: { name: 'Monitoring', desc: 'Real-time systeemmonitoring met curvediagrammen.', features: ['Real-time curves per CPU-kern, GPU, netwerk en schijven', 'Voortgangsbalken voor RAM, opslag en netwerkdoorvoer', 'Aanpasbare kleuren per widget', 'Aanpasbare temperatuurwaarschuwingen met meldingen', 'Ingebouwde internet-speedtest', 'Gamingmodus \u2014 automatische detectie of handmatige activering'] },
    weather: { name: 'Weer', desc: 'Weersvoorspelling voor uw stad.', features: ['Huidige omstandigheden en meerdaagse voorspelling', 'Stad zoeken met autocomplete', 'Gegevens van Open-Meteo'] },
    calendar: { name: 'Kalender', desc: 'Agendabeheer met multi-kalender ondersteuning.', features: ['Google Calendar-verbinding via OAuth2', 'Externe ICS-kalender ondersteuning', 'Weergave van komende afspraken', 'Snel Google-afspraken aanmaken'], setup: 'Verbind uw Google-account of voeg ICS-kalender-URLs toe in de moduleinstellingen.' },
    homeassistant: { name: 'Home Assistant', desc: 'Slimme huisbesturing met HA OS-interface.', features: ['Tegelinterface per domein (lampen, schakelaars, sensoren, rolluiken, enz.)', 'Kleurgecodeerde pictogrammen per entiteitsdomein', 'Rolluiken: openen / stop / sluiten direct op de tegel', 'Lampen: kleurkiezer en helderheidsschuifregelaar voor compatibele lampen', 'Echte RGB-kleur weergegeven op het lamppictogram', 'Real-time updates via WebSocket'], setup: 'Voer de URL van uw Home Assistant-instantie en een langlevend toegangstoken in (Profiel \u2192 Tokens).' },
    volume: { name: 'Volume & Media', desc: 'DJ-deck/mixer-interface met geavanceerde audiobediening en visualizer.', features: ['SVG-draaiknop voor systeemvolume', 'LED VU-meter met kleurgecodeerde niveaus', 'Transportbediening: vorige, afspelen/pauzeren (dynamisch pictogram), volgende', 'Real-time audiovisualizer (64 balken)', 'Selectie van audio-uitvoerapparaat', 'Snelle volumepresets'] },
    tools: { name: 'Hulpmiddelen', desc: 'Suite van 5 productiviteitstools.', features: ['Pomodoro \u2014 Instelbare productiviteitstimer', 'Timer \u2014 Aanpasbare afteltimer', 'Stopwatch \u2014 Tijdmeting met ronderegistratie', 'Notities \u2014 Notities met gekleurde categorie\u00ebn', 'Screenshots \u2014 Schermopname en galerij'] },
    news: { name: 'Nieuws & Crypto', desc: 'RSS-feedlezer met crypto-ticker.', features: ['Aanpasbare RSS-feeds per categorie (gaming, tech, aanbiedingen)', 'Standaardfeeds aangepast aan uw taal', 'Automatische feedwissel bij taalwijziging', 'Automatische vernieuwing elke 5 minuten', 'Real-time crypto-ticker (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Klembord', desc: 'Automatische klembordgeschiedenis.', features: ['Automatische geschiedenis (max. 20 items)', 'Tekst- en afbeeldingsondersteuning', 'Kopi\u00ebren met \u00e9\u00e9n klik'] },
    obs: { name: 'OBS Studio', desc: 'Native OBS Studio-bediening via WebSocket.', features: ['Sc\u00e8newisseling met \u00e9\u00e9n klik', 'Bronzichtbaarheid schakelen', 'Stream- en opnamebediening', 'Live statistieken (FPS, CPU, verloren frames, RAM)'], setup: 'Schakel de WebSocket-server in OBS in (Instellingen \u2192 WebSocket-server) en maak verbinding met ws://localhost:4455.' },
    streaming: { name: 'Streamingdiensten', desc: 'Toegang tot Spotify, SoundCloud, YouTube Music en Twitch vanuit het dashboard.', features: ['Ingebouwde webinterface voor elke dienst', 'Persistente sessies \u2014 afspelen gaat door op de achtergrond', 'Elke dienst behoudt zijn verbinding tussen sessies'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Servermonitoring via uw Uptime Kuma-instantie.', features: ['Ingebouwde webinterface', 'Persistente sessie'], setup: 'Voer de URL van uw Uptime Kuma-instantie in.' },
    customWebviews: { name: 'Aangepaste Webviews', desc: 'Voeg elke website toe als module.', features: ['Tot 5 aangepaste webviews', 'Persistente sessies', 'Aanpasbaar pictogram en naam', 'Configureerbaar in Instellingen'] },
    launcher: { name: 'Launcher', desc: 'Snelkoppelingenpaneel aan de rechterkant van het scherm.', features: ['Aanpasbaar knoppenraster', 'Vier typen: Applicatie, Systeem (afsluiten, herstarten, slaapstand\u2026), Profiel, Home Assistant', 'HA-lampbediening met kleur- en helderheidsselectie', 'Aangepaste pictogrammen (PNG, JPG, ICO, WebP)', 'JSON-configuratie export/import'] },
    settingsModule: { name: 'Instellingen', desc: 'Volledige applicatieconfiguratie.', features: ['Taalselectie (9 talen)', 'Vooraf ingestelde en aangepaste kleurthema\'s', 'Modulevolgorde en zichtbaarheid', 'Zijbalk- en launcher-afmetingen', 'Doelschermselectie', 'Automatisch starten met Windows', 'Automatische updates (controle, download, installatie)', 'Licentiebeheer', 'Aangepaste webviews', 'Links: privacybeleid, gebruiksvoorwaarden, contact'] },
    docker: { name: 'Docker', desc: 'Monitoring en beheer van Docker-containers op externe machines via SSH.', features: ['SSH-verbinding via wachtwoord of priv\u00e9sleutel', 'Containerlijst met realtime status (running, stopped, paused)', 'CPU- en RAM-statistieken per container (10s vernieuwing)', 'Volledige details: image, poorten, volumes, omgevingsvariabelen, restart policy', 'Acties: container starten, stoppen, herstarten', 'Logweergave (laatste 50 regels)', 'Multi-host ondersteuning met aangepaste kleuren', 'Ingebouwde verbindingstest'], setup: 'Vereisten op de externe server:\n1. SSH ingeschakeld (sudo apt install openssh-server && sudo systemctl enable --now ssh)\n2. Docker ge\u00efnstalleerd (curl -fsSL https://get.docker.com | sudo sh)\n3. Gebruiker in docker-groep (sudo usermod -aG docker GEBRUIKER)\n\nIn PulseDeck: klik op \"+ Host toevoegen\", voer het IP-adres, SSH-poort (22), gebruikersnaam en wachtwoord in of selecteer een SSH-sleutel. Test de verbinding voor het opslaan.' },
    voicecommands: { name: 'Spraakcommando\'s', desc: 'Offline spraakbesturing van PulseDeck via Vosk-herkenning.', features: ['Offline spraakherkenning (geen gegevens naar internet verzonden)', 'Automatische download van taalmodel (~40 MB)', '9 talen ondersteund (FR, EN, DE, NL, ES, PT, IT, PL, JA)', 'Systeemcommando\'s: afsluiten, herstarten, slaapstand, vergrendelen', 'Mediacommando\'s: afspelen, pauzeren, volgende, vorige', 'Volumeregeling: instellen, harder, zachter, dempen', 'Home Assistant: lampen aan/uit, rolluiken openen/sluiten (op naam)', 'OBS: stream en opname starten/stoppen', 'Commandogeschiedenis met status'], setup: 'Selecteer uw microfoon in de module en klik op de microfoonknop om te starten. Het taalmodel van de in de instellingen geselecteerde taal wordt automatisch gedownload bij de eerste keer.' },
    footerText: 'PulseDeck \u2014 Automatisch gegenereerde handleiding',
  },
  es: {
    guideTitle: 'Gu\u00eda del Usuario',
    forDevice: 'para Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Tabla de Contenidos',
    overviewTitle: 'Descripci\u00f3n General',
    overviewDesc: 'PulseDeck es un panel de control todo en uno dise\u00f1ado para la pantalla t\u00e1ctil Corsair Xeneon Edge. Permite monitorizar su sistema, controlar sus medios y gestionar sus aplicaciones, todo desde una interfaz \u00fanica optimizada para pantallas ultra anchas.',
    layoutTitle: 'Disposici\u00f3n de la Pantalla',
    layoutSidebar: 'Barra lateral (izquierda) \u2014 Navegaci\u00f3n entre m\u00f3dulos',
    layoutMain: '\u00c1rea principal (centro) \u2014 Visualizaci\u00f3n del m\u00f3dulo activo',
    layoutLauncher: 'Lanzador (derecha) \u2014 Cuadr\u00edcula de accesos directos',
    modulesTitle: 'M\u00f3dulos',
    setupLabel: 'Configuraci\u00f3n',
    monitoring: { name: 'Monitoring', desc: 'Monitorizaci\u00f3n del sistema en tiempo real con gr\u00e1ficos de curvas.', features: ['Curvas en tiempo real por n\u00facleo de CPU, GPU, red y discos', 'Barras de progreso para RAM, almacenamiento y rendimiento de red', 'Colores personalizables por widget', 'Alertas de temperatura personalizables con notificaciones', 'Test de velocidad de internet integrado', 'Modo Gaming \u2014 detecci\u00f3n autom\u00e1tica o activaci\u00f3n manual'] },
    weather: { name: 'Clima', desc: 'Pron\u00f3stico del tiempo para su ciudad.', features: ['Condiciones actuales y pron\u00f3stico de varios d\u00edas', 'B\u00fasqueda de ciudad con autocompletado', 'Datos proporcionados por Open-Meteo'] },
    calendar: { name: 'Calendario', desc: 'Gesti\u00f3n de agenda con soporte multi-calendario.', features: ['Conexi\u00f3n a Google Calendar v\u00eda OAuth2', 'Soporte de calendarios ICS externos', 'Visualizaci\u00f3n de pr\u00f3ximos eventos', 'Creaci\u00f3n r\u00e1pida de eventos Google'], setup: 'Conecte su cuenta de Google o a\u00f1ada URLs de calendarios ICS en la configuraci\u00f3n del m\u00f3dulo.' },
    homeassistant: { name: 'Home Assistant', desc: 'Control del hogar inteligente con interfaz estilo HA OS.', features: ['Interfaz de mosaicos por dominio (luces, interruptores, sensores, persianas, etc.)', 'Iconos con c\u00f3digo de color por dominio de entidad', 'Persianas: botones abrir / stop / cerrar directamente en el mosaico', 'Luces: selector de color y control de brillo para bombillas compatibles', 'Color RGB real mostrado en el icono de la luz', 'Actualizaciones en tiempo real v\u00eda WebSocket'], setup: 'Introduzca la URL de su instancia de Home Assistant y un token de acceso de larga duraci\u00f3n (Perfil \u2192 Tokens).' },
    volume: { name: 'Volumen y Medios', desc: 'Interfaz DJ deck/mixer con control de audio avanzado y visualizador.', features: ['Perilla circular SVG para volumen del sistema', 'VU-metro LED con niveles codificados por color', 'Controles de transporte: anterior, reproducir/pausar (icono din\u00e1mico), siguiente', 'Visualizador de audio en tiempo real (64 barras)', 'Selecci\u00f3n de dispositivo de salida de audio', 'Preajustes de volumen r\u00e1pidos'] },
    tools: { name: 'Herramientas', desc: 'Suite de 5 herramientas de productividad.', features: ['Pomodoro \u2014 Temporizador de productividad configurable', 'Temporizador \u2014 Cuenta regresiva personalizable', 'Cron\u00f3metro \u2014 Medici\u00f3n con registro de vueltas', 'Notas \u2014 Notas con categor\u00edas de colores', 'Capturas de pantalla \u2014 Captura y galer\u00eda'] },
    news: { name: 'Noticias y Crypto', desc: 'Lector de feeds RSS con ticker de criptomonedas.', features: ['Feeds RSS personalizables por categor\u00eda (juegos, tech, ofertas)', 'Feeds por defecto adaptados a su idioma', 'Cambio autom\u00e1tico de feeds al cambiar de idioma', 'Actualizaci\u00f3n autom\u00e1tica cada 5 minutos', 'Ticker crypto en tiempo real (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Portapapeles', desc: 'Historial autom\u00e1tico del portapapeles.', features: ['Historial autom\u00e1tico (hasta 20 elementos)', 'Soporte de texto e im\u00e1genes', 'Copia con un clic'] },
    obs: { name: 'OBS Studio', desc: 'Control nativo de OBS Studio v\u00eda WebSocket.', features: ['Cambio de escenas con un clic', 'Alternar visibilidad de fuentes', 'Control de stream y grabaci\u00f3n', 'Estad\u00edsticas en vivo (FPS, CPU, fotogramas perdidos, RAM)'], setup: 'Active el servidor WebSocket en OBS (Ajustes \u2192 Servidor WebSocket) y con\u00e9ctese con ws://localhost:4455.' },
    streaming: { name: 'Servicios de streaming', desc: 'Acceda a Spotify, SoundCloud, YouTube Music y Twitch desde el panel.', features: ['Interfaz web integrada para cada servicio', 'Sesiones persistentes \u2014 la reproducci\u00f3n contin\u00faa en segundo plano', 'Cada servicio mantiene su conexi\u00f3n entre sesiones'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitorizaci\u00f3n de servidores v\u00eda su instancia de Uptime Kuma.', features: ['Interfaz web integrada', 'Sesi\u00f3n persistente'], setup: 'Introduzca la URL de su instancia de Uptime Kuma.' },
    customWebviews: { name: 'Webviews personalizadas', desc: 'A\u00f1ada cualquier sitio web como m\u00f3dulo.', features: ['Hasta 5 webviews personalizadas', 'Sesiones persistentes', 'Icono y nombre personalizables', 'Configurable en Ajustes'] },
    launcher: { name: 'Lanzador', desc: 'Panel de accesos directos en el lado derecho de la pantalla.', features: ['Cuadr\u00edcula de botones personalizables', 'Cuatro tipos: Aplicaci\u00f3n, Sistema (apagar, reiniciar, suspender\u2026), Perfil, Home Assistant', 'Control de luces HA con selecci\u00f3n de color y brillo', 'Iconos personalizables (PNG, JPG, ICO, WebP)', 'Exportaci\u00f3n/importaci\u00f3n de configuraci\u00f3n JSON'] },
    settingsModule: { name: 'Ajustes', desc: 'Configuraci\u00f3n completa de la aplicaci\u00f3n.', features: ['Selecci\u00f3n de idioma (9 idiomas)', 'Temas de colores predefinidos y personalizados', 'Orden y visibilidad de m\u00f3dulos', 'Dimensiones de barra lateral y lanzador', 'Selector de pantalla de destino', 'Inicio autom\u00e1tico con Windows', 'Actualizaciones autom\u00e1ticas (verificaci\u00f3n, descarga, instalaci\u00f3n)', 'Gesti\u00f3n de licencia', 'Webviews personalizadas', 'Enlaces: pol\u00edtica de privacidad, condiciones de uso, contacto'] },
    docker: { name: 'Docker', desc: 'Monitorizaci\u00f3n y control de contenedores Docker en m\u00e1quinas remotas v\u00eda SSH.', features: ['Conexi\u00f3n SSH por contrase\u00f1a o clave privada', 'Lista de contenedores con estado en tiempo real (running, stopped, paused)', 'Estad\u00edsticas de CPU y RAM por contenedor (actualizaci\u00f3n cada 10s)', 'Detalles completos: imagen, puertos, vol\u00famenes, variables de entorno, pol\u00edtica de reinicio', 'Acciones: iniciar, detener, reiniciar un contenedor', 'Visualizaci\u00f3n de logs (\u00faltimas 50 l\u00edneas)', 'Soporte multi-host con colores personalizados', 'Prueba de conexi\u00f3n integrada'], setup: 'Requisitos en el servidor remoto:\n1. SSH habilitado (sudo apt install openssh-server && sudo systemctl enable --now ssh)\n2. Docker instalado (curl -fsSL https://get.docker.com | sudo sh)\n3. Usuario en el grupo docker (sudo usermod -aG docker USUARIO)\n\nEn PulseDeck: haga clic en \"+ A\u00f1adir host\", introduzca la direcci\u00f3n IP, puerto SSH (22), usuario y contrase\u00f1a o seleccione una clave SSH. Pruebe la conexi\u00f3n antes de guardar.' },
    voicecommands: { name: 'Comandos de voz', desc: 'Control por voz offline de PulseDeck mediante reconocimiento Vosk.', features: ['Reconocimiento de voz offline (sin env\u00edo de datos a internet)', 'Descarga autom\u00e1tica del modelo de idioma (~40 MB)', '9 idiomas soportados (FR, EN, DE, NL, ES, PT, IT, PL, JA)', 'Comandos del sistema: apagar, reiniciar, suspender, bloquear', 'Comandos multimedia: reproducir, pausar, siguiente, anterior', 'Control de volumen: ajustar, subir, bajar, silenciar', 'Home Assistant: encender/apagar luces, abrir/cerrar persianas (por nombre)', 'OBS: iniciar/detener stream y grabaci\u00f3n', 'Historial de comandos con estado'], setup: 'Seleccione su micr\u00f3fono en el m\u00f3dulo y haga clic en el bot\u00f3n de micr\u00f3fono para iniciar. El modelo del idioma seleccionado en los ajustes se descargar\u00e1 autom\u00e1ticamente en el primer inicio.' },
    footerText: 'PulseDeck \u2014 Gu\u00eda generada autom\u00e1ticamente',
  },
  pt: {
    guideTitle: 'Guia do Utilizador',
    forDevice: 'para Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: '\u00cdndice',
    overviewTitle: 'Vis\u00e3o Geral',
    overviewDesc: 'PulseDeck \u00e9 um painel de controlo tudo-em-um concebido para o ecr\u00e3 t\u00e1til Corsair Xeneon Edge. Permite monitorizar o sistema, controlar os seus m\u00e9dia e gerir as suas aplica\u00e7\u00f5es, tudo a partir de uma interface \u00fanica otimizada para ecr\u00e3s ultra-largos.',
    layoutTitle: 'Disposi\u00e7\u00e3o do Ecr\u00e3',
    layoutSidebar: 'Barra lateral (esquerda) \u2014 Navega\u00e7\u00e3o entre m\u00f3dulos',
    layoutMain: '\u00c1rea principal (centro) \u2014 Exibi\u00e7\u00e3o do m\u00f3dulo ativo',
    layoutLauncher: 'Lan\u00e7ador (direita) \u2014 Grelha de atalhos personaliz\u00e1veis',
    modulesTitle: 'M\u00f3dulos',
    setupLabel: 'Configura\u00e7\u00e3o',
    monitoring: { name: 'Monitoring', desc: 'Monitoriza\u00e7\u00e3o do sistema em tempo real com gr\u00e1ficos de curvas.', features: ['Curvas em tempo real por n\u00facleo de CPU, GPU, rede e discos', 'Barras de progresso para RAM, armazenamento e d\u00e9bito de rede', 'Cores personaliz\u00e1veis por widget', 'Alertas de temperatura personaliz\u00e1veis com notifica\u00e7\u00f5es', 'Teste de velocidade de internet integrado', 'Modo Gaming \u2014 dete\u00e7\u00e3o autom\u00e1tica ou ativa\u00e7\u00e3o manual'] },
    weather: { name: 'Meteorologia', desc: 'Previs\u00e3o meteorol\u00f3gica para a sua cidade.', features: ['Condi\u00e7\u00f5es atuais e previs\u00e3o de v\u00e1rios dias', 'Pesquisa de cidade com autocompletar', 'Dados fornecidos pelo Open-Meteo'] },
    calendar: { name: 'Calend\u00e1rio', desc: 'Gest\u00e3o de agenda com suporte multi-calend\u00e1rio.', features: ['Liga\u00e7\u00e3o ao Google Calendar via OAuth2', 'Suporte de calend\u00e1rios ICS externos', 'Exibi\u00e7\u00e3o de pr\u00f3ximos eventos', 'Cria\u00e7\u00e3o r\u00e1pida de eventos Google'], setup: 'Ligue a sua conta Google ou adicione URLs de calend\u00e1rios ICS nas defini\u00e7\u00f5es do m\u00f3dulo.' },
    homeassistant: { name: 'Home Assistant', desc: 'Controlo de casa inteligente com interface estilo HA OS.', features: ['Interface em mosaicos por dom\u00ednio (luzes, interruptores, sensores, estores, etc.)', '\u00cdcones com c\u00f3digo de cor por dom\u00ednio da entidade', 'Estores: bot\u00f5es abrir / parar / fechar diretamente no mosaico', 'Luzes: seletor de cor e controlo de brilho para l\u00e2mpadas compat\u00edveis', 'Cor RGB real exibida no \u00edcone da luz', 'Atualiza\u00e7\u00f5es em tempo real via WebSocket'], setup: 'Insira o URL da sua inst\u00e2ncia Home Assistant e um token de acesso de longa dura\u00e7\u00e3o (Perfil \u2192 Tokens).' },
    volume: { name: 'Volume e M\u00e9dia', desc: 'Interface DJ deck/mixer com controlo de \u00e1udio avan\u00e7ado e visualizador.', features: ['Bot\u00e3o circular SVG para volume do sistema', 'VU-metro LED com n\u00edveis codificados por cor', 'Controlos de transporte: anterior, reproduzir/pausar (\u00edcone din\u00e2mico), seguinte', 'Visualizador de \u00e1udio em tempo real (64 barras)', 'Sele\u00e7\u00e3o de dispositivo de sa\u00edda de \u00e1udio', 'Predefini\u00e7\u00f5es de volume r\u00e1pidas'] },
    tools: { name: 'Ferramentas', desc: 'Suite de 5 ferramentas de produtividade.', features: ['Pomodoro \u2014 Temporizador de produtividade configur\u00e1vel', 'Temporizador \u2014 Contagem decrescente personaliz\u00e1vel', 'Cron\u00f3metro \u2014 Medi\u00e7\u00e3o com registo de voltas', 'Notas \u2014 Notas com categorias coloridas', 'Capturas de ecr\u00e3 \u2014 Captura e galeria'] },
    news: { name: 'Not\u00edcias e Crypto', desc: 'Leitor de feeds RSS com ticker de criptomoedas.', features: ['Feeds RSS personaliz\u00e1veis por categoria (jogos, tech, promo\u00e7\u00f5es)', 'Feeds padr\u00e3o adaptados ao seu idioma', 'Mudan\u00e7a autom\u00e1tica de feeds ao alterar o idioma', 'Atualiza\u00e7\u00e3o autom\u00e1tica a cada 5 minutos', 'Ticker crypto em tempo real (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: '\u00c1rea de Transfer\u00eancia', desc: 'Hist\u00f3rico autom\u00e1tico da \u00e1rea de transfer\u00eancia.', features: ['Hist\u00f3rico autom\u00e1tico (at\u00e9 20 itens)', 'Suporte de texto e imagens', 'C\u00f3pia com um clique'] },
    obs: { name: 'OBS Studio', desc: 'Controlo nativo do OBS Studio via WebSocket.', features: ['Mudan\u00e7a de cenas com um clique', 'Alternar visibilidade das fontes', 'Controlo de stream e grava\u00e7\u00e3o', 'Estat\u00edsticas em direto (FPS, CPU, quadros perdidos, RAM)'], setup: 'Ative o servidor WebSocket no OBS (Configura\u00e7\u00f5es \u2192 Servidor WebSocket) e ligue-se com ws://localhost:4455.' },
    streaming: { name: 'Servi\u00e7os de Streaming', desc: 'Aceda ao Spotify, SoundCloud, YouTube Music e Twitch a partir do painel.', features: ['Interface web integrada para cada servi\u00e7o', 'Sess\u00f5es persistentes \u2014 a reprodu\u00e7\u00e3o continua em segundo plano', 'Cada servi\u00e7o mant\u00e9m a sua liga\u00e7\u00e3o entre sess\u00f5es'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitoriza\u00e7\u00e3o de servidores via a sua inst\u00e2ncia Uptime Kuma.', features: ['Interface web integrada', 'Sess\u00e3o persistente'], setup: 'Insira o URL da sua inst\u00e2ncia Uptime Kuma.' },
    customWebviews: { name: 'Webviews Personalizadas', desc: 'Adicione qualquer website como m\u00f3dulo.', features: ['At\u00e9 5 webviews personalizadas', 'Sess\u00f5es persistentes', '\u00cdcone e nome personaliz\u00e1veis', 'Configur\u00e1vel nas Defini\u00e7\u00f5es'] },
    launcher: { name: 'Lan\u00e7ador', desc: 'Painel de atalhos no lado direito do ecr\u00e3.', features: ['Grelha de bot\u00f5es personaliz\u00e1veis', 'Quatro tipos: Aplica\u00e7\u00e3o, Sistema (desligar, reiniciar, suspender\u2026), Perfil, Home Assistant', 'Controlo de luzes HA com sele\u00e7\u00e3o de cor e brilho', '\u00cdcones personaliz\u00e1veis (PNG, JPG, ICO, WebP)', 'Exporta\u00e7\u00e3o/importa\u00e7\u00e3o de configura\u00e7\u00e3o JSON'] },
    settingsModule: { name: 'Defini\u00e7\u00f5es', desc: 'Configura\u00e7\u00e3o completa da aplica\u00e7\u00e3o.', features: ['Sele\u00e7\u00e3o de idioma (9 idiomas)', 'Temas de cores predefinidos e personalizados', 'Ordem e visibilidade dos m\u00f3dulos', 'Dimens\u00f5es da barra lateral e do lan\u00e7ador', 'Seletor de ecr\u00e3 de destino', 'Arranque autom\u00e1tico com Windows', 'Atualiza\u00e7\u00f5es autom\u00e1ticas (verifica\u00e7\u00e3o, download, instala\u00e7\u00e3o)', 'Gest\u00e3o de licen\u00e7a', 'Webviews personalizadas', 'Links: pol\u00edtica de privacidade, condi\u00e7\u00f5es de utiliza\u00e7\u00e3o, contacto'] },
    docker: { name: 'Docker', desc: 'Monitoriza\u00e7\u00e3o e controlo de contentores Docker em m\u00e1quinas remotas via SSH.', features: ['Conex\u00e3o SSH por palavra-passe ou chave privada', 'Lista de contentores com estado em tempo real (running, stopped, paused)', 'Estat\u00edsticas de CPU e RAM por contentor (atualiza\u00e7\u00e3o a cada 10s)', 'Detalhes completos: imagem, portas, volumes, vari\u00e1veis de ambiente, pol\u00edtica de rein\u00edcio', 'A\u00e7\u00f5es: iniciar, parar, reiniciar um contentor', 'Visualiza\u00e7\u00e3o de logs (\u00faltimas 50 linhas)', 'Suporte multi-host com cores personalizadas', 'Teste de conex\u00e3o integrado'], setup: 'Requisitos no servidor remoto:\n1. SSH ativado (sudo apt install openssh-server && sudo systemctl enable --now ssh)\n2. Docker instalado (curl -fsSL https://get.docker.com | sudo sh)\n3. Utilizador no grupo docker (sudo usermod -aG docker UTILIZADOR)\n\nNo PulseDeck: clique em \"+ Adicionar host\", insira o endere\u00e7o IP, porta SSH (22), utilizador e palavra-passe ou selecione uma chave SSH. Teste a conex\u00e3o antes de guardar.' },
    voicecommands: { name: 'Comandos de voz', desc: 'Controlo por voz offline do PulseDeck via reconhecimento Vosk.', features: ['Reconhecimento de voz offline (sem envio de dados para a internet)', 'Download autom\u00e1tico do modelo de idioma (~40 MB)', '9 idiomas suportados (FR, EN, DE, NL, ES, PT, IT, PL, JA)', 'Comandos do sistema: desligar, reiniciar, suspender, bloquear', 'Comandos multim\u00e9dia: reproduzir, pausar, seguinte, anterior', 'Controlo de volume: ajustar, aumentar, diminuir, silenciar', 'Home Assistant: ligar/desligar luzes, abrir/fechar estores (por nome)', 'OBS: iniciar/parar stream e grava\u00e7\u00e3o', 'Hist\u00f3rico de comandos com estado'], setup: 'Selecione o seu microfone no m\u00f3dulo e clique no bot\u00e3o do microfone para iniciar. O modelo do idioma selecionado nas defini\u00e7\u00f5es ser\u00e1 descarregado automaticamente no primeiro arranque.' },
    footerText: 'PulseDeck \u2014 Guia gerado automaticamente',
  },
  it: {
    guideTitle: 'Guida Utente',
    forDevice: 'per Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Indice',
    overviewTitle: 'Panoramica',
    overviewDesc: 'PulseDeck \u00e8 un pannello di controllo tutto-in-uno progettato per il touchscreen Corsair Xeneon Edge. Permette di monitorare il sistema, controllare i media e gestire le applicazioni, tutto da un\'unica interfaccia ottimizzata per display ultra-wide.',
    layoutTitle: 'Layout dello Schermo',
    layoutSidebar: 'Barra laterale (sinistra) \u2014 Navigazione tra i moduli',
    layoutMain: 'Area principale (centro) \u2014 Visualizzazione del modulo attivo',
    layoutLauncher: 'Launcher (destra) \u2014 Griglia di scorciatoie personalizzabili',
    modulesTitle: 'Moduli',
    setupLabel: 'Configurazione',
    monitoring: { name: 'Monitoring', desc: 'Monitoraggio del sistema in tempo reale con grafici a curve.', features: ['Curve in tempo reale per core CPU, GPU, rete e dischi', 'Barre di progresso per RAM, archiviazione e throughput di rete', 'Colori personalizzabili per widget', 'Avvisi di temperatura personalizzabili con notifiche', 'Test di velocit\u00e0 internet integrato', 'Modalit\u00e0 Gaming \u2014 rilevamento automatico o attivazione manuale'] },
    weather: { name: 'Meteo', desc: 'Previsioni meteorologiche per la tua citt\u00e0.', features: ['Condizioni attuali e previsioni multi-giorno', 'Ricerca citt\u00e0 con autocompletamento', 'Dati forniti da Open-Meteo'] },
    calendar: { name: 'Calendario', desc: 'Gestione agenda con supporto multi-calendario.', features: ['Connessione Google Calendar tramite OAuth2', 'Supporto calendari ICS esterni', 'Visualizzazione eventi imminenti', 'Creazione rapida eventi Google'], setup: 'Collega il tuo account Google o aggiungi URL di calendari ICS nelle impostazioni del modulo.' },
    homeassistant: { name: 'Home Assistant', desc: 'Controllo della casa intelligente con interfaccia stile HA OS.', features: ['Interfaccia a riquadri per dominio (luci, interruttori, sensori, tapparelle, ecc.)', 'Icone con codice colore per dominio dell\'entit\u00e0', 'Tapparelle: pulsanti apri / stop / chiudi direttamente sul riquadro', 'Luci: selettore colore e cursore luminosit\u00e0 per lampadine compatibili', 'Colore RGB reale visualizzato sull\'icona della luce', 'Aggiornamenti in tempo reale via WebSocket'], setup: 'Inserisci l\'URL della tua istanza Home Assistant e un token di accesso a lunga durata (Profilo \u2192 Token).' },
    volume: { name: 'Volume e Media', desc: 'Interfaccia DJ deck/mixer con controllo audio avanzato e visualizzatore.', features: ['Manopola circolare SVG per il volume di sistema', 'VU-metro LED con livelli codificati per colore', 'Controlli di trasporto: precedente, play/pausa (icona dinamica), successivo', 'Visualizzatore audio in tempo reale (64 barre)', 'Selezione dispositivo di uscita audio', 'Preset volume rapidi'] },
    tools: { name: 'Strumenti', desc: 'Suite di 5 strumenti di produttivit\u00e0.', features: ['Pomodoro \u2014 Timer di produttivit\u00e0 configurabile', 'Timer \u2014 Conto alla rovescia personalizzabile', 'Cronometro \u2014 Misurazione tempo con giri', 'Note \u2014 Appunti con categorie colorate', 'Screenshot \u2014 Cattura schermo e galleria'] },
    news: { name: 'Notizie e Crypto', desc: 'Lettore di feed RSS con ticker criptovalute.', features: ['Feed RSS personalizzabili per categoria (gaming, tech, offerte)', 'Feed predefiniti adattati alla tua lingua', 'Cambio automatico dei feed al cambio di lingua', 'Aggiornamento automatico ogni 5 minuti', 'Ticker crypto in tempo reale (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Appunti', desc: 'Cronologia automatica degli appunti.', features: ['Cronologia automatica (fino a 20 elementi)', 'Supporto testo e immagini', 'Copia con un clic'] },
    obs: { name: 'OBS Studio', desc: 'Controllo nativo di OBS Studio via WebSocket.', features: ['Cambio scena con un clic', 'Attiva/disattiva visibilit\u00e0 sorgenti', 'Controllo stream e registrazione', 'Statistiche in diretta (FPS, CPU, frame persi, RAM)'], setup: 'Attiva il server WebSocket in OBS (Impostazioni \u2192 Server WebSocket) e connettiti con ws://localhost:4455.' },
    streaming: { name: 'Servizi di Streaming', desc: 'Accedi a Spotify, SoundCloud, YouTube Music e Twitch dal pannello.', features: ['Interfaccia web integrata per ogni servizio', 'Sessioni persistenti \u2014 la riproduzione continua in background', 'Ogni servizio mantiene la connessione tra le sessioni'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitoraggio server tramite la tua istanza Uptime Kuma.', features: ['Interfaccia web integrata', 'Sessione persistente'], setup: 'Inserisci l\'URL della tua istanza Uptime Kuma.' },
    customWebviews: { name: 'Webview Personalizzate', desc: 'Aggiungi qualsiasi sito web come modulo.', features: ['Fino a 5 webview personalizzate', 'Sessioni persistenti', 'Icona e nome personalizzabili', 'Configurabile nelle Impostazioni'] },
    launcher: { name: 'Launcher', desc: 'Pannello scorciatoie sul lato destro dello schermo.', features: ['Griglia di pulsanti personalizzabili', 'Quattro tipi: Applicazione, Sistema (spegnimento, riavvio, sospensione\u2026), Profilo, Home Assistant', 'Controllo luci HA con selezione colore e luminosit\u00e0', 'Icone personalizzabili (PNG, JPG, ICO, WebP)', 'Esportazione/importazione configurazione JSON'] },
    settingsModule: { name: 'Impostazioni', desc: 'Configurazione completa dell\'applicazione.', features: ['Selezione lingua (9 lingue)', 'Temi colori predefiniti e personalizzati', 'Ordine e visibilit\u00e0 dei moduli', 'Dimensioni barra laterale e launcher', 'Selettore schermo di destinazione', 'Avvio automatico con Windows', 'Aggiornamenti automatici (verifica, download, installazione)', 'Gestione licenza', 'Webview personalizzate', 'Link: informativa sulla privacy, condizioni d\'uso, contatto'] },
    docker: { name: 'Docker', desc: 'Monitoraggio e controllo di container Docker su macchine remote via SSH.', features: ['Connessione SSH tramite password o chiave privata', 'Lista container con stato in tempo reale (running, stopped, paused)', 'Statistiche CPU e RAM per container (aggiornamento ogni 10s)', 'Dettagli completi: immagine, porte, volumi, variabili di ambiente, policy di riavvio', 'Azioni: avviare, fermare, riavviare un container', 'Visualizzazione log (ultime 50 righe)', 'Supporto multi-host con colori personalizzati', 'Test di connessione integrato'], setup: 'Prerequisiti sul server remoto:\n1. SSH attivo (sudo apt install openssh-server && sudo systemctl enable --now ssh)\n2. Docker installato (curl -fsSL https://get.docker.com | sudo sh)\n3. Utente nel gruppo docker (sudo usermod -aG docker UTENTE)\n\nIn PulseDeck: clicca su \"+ Aggiungi host\", inserisci l\'indirizzo IP, porta SSH (22), nome utente e password o seleziona una chiave SSH. Testa la connessione prima di salvare.' },
    voicecommands: { name: 'Comandi vocali', desc: 'Controllo vocale offline di PulseDeck tramite riconoscimento Vosk.', features: ['Riconoscimento vocale offline (nessun dato inviato su internet)', 'Download automatico del modello linguistico (~40 MB)', '9 lingue supportate (FR, EN, DE, NL, ES, PT, IT, PL, JA)', 'Comandi di sistema: spegnere, riavviare, sospendere, bloccare', 'Comandi multimediali: riproduci, pausa, successivo, precedente', 'Controllo volume: impostare, alzare, abbassare, muto', 'Home Assistant: accendere/spegnere luci, aprire/chiudere tapparelle (per nome)', 'OBS: avviare/fermare stream e registrazione', 'Cronologia comandi con stato'], setup: 'Seleziona il tuo microfono nel modulo e clicca sul pulsante microfono per iniziare. Il modello della lingua selezionata nelle impostazioni verr\u00e0 scaricato automaticamente al primo avvio.' },
    footerText: 'PulseDeck \u2014 Guida generata automaticamente',
  },
  pl: {
    guideTitle: 'Podr\u0119cznik U\u017cytkownika',
    forDevice: 'dla Corsair Xeneon Edge (2560\u00d7720)',
    tocTitle: 'Spis Tre\u015bci',
    overviewTitle: 'Przegl\u0105d',
    overviewDesc: 'PulseDeck to wszechstronny panel kontrolny zaprojektowany dla ekranu dotykowego Corsair Xeneon Edge. Umo\u017cliwia monitorowanie systemu, sterowanie multimediami i zarz\u0105dzanie aplikacjami \u2014 wszystko z jednego interfejsu zoptymalizowanego pod ultra-szerokie wy\u015bwietlacze.',
    layoutTitle: 'Uk\u0142ad Ekranu',
    layoutSidebar: 'Pasek boczny (lewy) \u2014 Nawigacja mi\u0119dzy modu\u0142ami',
    layoutMain: 'Obszar g\u0142\u00f3wny (\u015brodek) \u2014 Wy\u015bwietlanie aktywnego modu\u0142u',
    layoutLauncher: 'Launcher (prawy) \u2014 Siatka konfigurowalnych skr\u00f3t\u00f3w',
    modulesTitle: 'Modu\u0142y',
    setupLabel: 'Konfiguracja',
    monitoring: { name: 'Monitoring', desc: 'Monitorowanie systemu w czasie rzeczywistym z wykresami krzywych.', features: ['Krzywe w czasie rzeczywistym dla ka\u017cdego rdzenia CPU, GPU, sieci i dysk\u00f3w', 'Paski post\u0119pu dla RAM, pami\u0119ci masowej i przepustowo\u015bci sieci', 'Konfigurowalne kolory dla ka\u017cdego widgetu', 'Konfigurowalne alerty temperaturowe z powiadomieniami', 'Wbudowany test pr\u0119dko\u015bci internetu', 'Tryb Gaming \u2014 automatyczne wykrywanie lub r\u0119czna aktywacja'] },
    weather: { name: 'Pogoda', desc: 'Prognoza pogody dla Twojego miasta.', features: ['Aktualne warunki i prognoza na kilka dni', 'Wyszukiwanie miasta z autouzupe\u0142nianiem', 'Dane z Open-Meteo'] },
    calendar: { name: 'Kalendarz', desc: 'Zarz\u0105dzanie kalendarzem z obs\u0142ug\u0105 wielu kalendarzy.', features: ['Po\u0142\u0105czenie z Google Calendar przez OAuth2', 'Obs\u0142uga zewn\u0119trznych kalendarzy ICS', 'Wy\u015bwietlanie nadchodz\u0105cych wydarze\u0144', 'Szybkie tworzenie wydarze\u0144 Google'], setup: 'Po\u0142\u0105cz swoje konto Google lub dodaj adresy URL kalendarzy ICS w ustawieniach modu\u0142u.' },
    homeassistant: { name: 'Home Assistant', desc: 'Sterowanie inteligentnym domem z interfejsem w stylu HA OS.', features: ['Interfejs kafelkowy wed\u0142ug domeny (o\u015bwietlenie, prze\u0142\u0105czniki, czujniki, rolety itp.)', 'Ikony z kodem kolor\u00f3w wed\u0142ug domeny encji', 'Rolety: przyciski otw\u00f3rz / stop / zamknij bezpo\u015brednio na kafelku', 'O\u015bwietlenie: selektor kolor\u00f3w i suwak jasno\u015bci dla kompatybilnych \u017car\u00f3wek', 'Rzeczywisty kolor RGB wy\u015bwietlany na ikonie \u015bwiat\u0142a', 'Aktualizacje w czasie rzeczywistym przez WebSocket'], setup: 'Wprowad\u017a URL swojej instancji Home Assistant i d\u0142ugotrwa\u0142y token dost\u0119pu (Profil \u2192 Tokeny).' },
    volume: { name: 'G\u0142o\u015bno\u015b\u0107 i Media', desc: 'Interfejs DJ deck/mixer z zaawansowanym sterowaniem d\u017awi\u0119kiem i wizualizatorem.', features: ['Okr\u0105g\u0142y pokr\u0119t\u0142o SVG do g\u0142o\u015bno\u015bci systemu', 'Wska\u017anik VU LED z poziomami kodowanymi kolorem', 'Kontrole transportu: poprzedni, odtw\u00f3rz/pauza (dynamiczna ikona), nast\u0119pny', 'Wizualizator audio w czasie rzeczywistym (64 paski)', 'Wyb\u00f3r urz\u0105dzenia wyj\u015bciowego audio', 'Szybkie presety g\u0142o\u015bno\u015bci'] },
    tools: { name: 'Narz\u0119dzia', desc: 'Zestaw 5 narz\u0119dzi produktywno\u015bci.', features: ['Pomodoro \u2014 Konfigurowalny timer produktywno\u015bci', 'Timer \u2014 Konfigurowalny odlicznik', 'Stoper \u2014 Pomiar czasu z rejestracj\u0105 okr\u0105\u017ce\u0144', 'Notatki \u2014 Notatki z kolorowymi kategoriami', 'Zrzuty ekranu \u2014 Przechwytywanie i galeria'] },
    news: { name: 'Wiadomo\u015bci i Crypto', desc: 'Czytnik kana\u0142\u00f3w RSS z tickerem kryptowalut.', features: ['Konfigurowalne kana\u0142y RSS wg kategorii (gry, tech, okazje)', 'Domy\u015blne kana\u0142y dostosowane do Twojego j\u0119zyka', 'Automatyczna zmiana kana\u0142\u00f3w przy zmianie j\u0119zyka', 'Automatyczne od\u015bwie\u017canie co 5 minut', 'Ticker crypto w czasie rzeczywistym (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Schowek', desc: 'Automatyczna historia schowka.', features: ['Automatyczna historia (do 20 element\u00f3w)', 'Obs\u0142uga tekstu i obraz\u00f3w', 'Kopiowanie jednym klikni\u0119ciem'] },
    obs: { name: 'OBS Studio', desc: 'Natywne sterowanie OBS Studio przez WebSocket.', features: ['Zmiana scen jednym klikni\u0119ciem', 'Prze\u0142\u0105czanie widoczno\u015bci \u017ar\u00f3de\u0142', 'Sterowanie streamem i nagrywaniem', 'Statystyki na \u017cywo (FPS, CPU, utracone klatki, RAM)'], setup: 'W\u0142\u0105cz serwer WebSocket w OBS (Ustawienia \u2192 Serwer WebSocket) i po\u0142\u0105cz si\u0119 z ws://localhost:4455.' },
    streaming: { name: 'Us\u0142ugi streamingowe', desc: 'Dost\u0119p do Spotify, SoundCloud, YouTube Music i Twitch z panelu.', features: ['Wbudowany interfejs webowy dla ka\u017cdej us\u0142ugi', 'Trwa\u0142e sesje \u2014 odtwarzanie kontynuowane w tle', 'Ka\u017cda us\u0142uga zachowuje po\u0142\u0105czenie mi\u0119dzy sesjami'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitorowanie serwer\u00f3w przez instancj\u0119 Uptime Kuma.', features: ['Wbudowany interfejs webowy', 'Trwa\u0142a sesja'], setup: 'Wprowad\u017a URL swojej instancji Uptime Kuma.' },
    customWebviews: { name: 'Niestandardowe Webviews', desc: 'Dodaj dowoln\u0105 stron\u0119 jako modu\u0142.', features: ['Do 5 niestandardowych webviews', 'Trwa\u0142e sesje', 'Konfigurowalna ikona i nazwa', 'Konfiguracja w Ustawieniach'] },
    launcher: { name: 'Launcher', desc: 'Panel skr\u00f3t\u00f3w po prawej stronie ekranu.', features: ['Konfigurowalna siatka przycisk\u00f3w', 'Cztery typy: Aplikacja, System (zamknij, uruchom ponownie, u\u015bpij\u2026), Profil, Home Assistant', 'Sterowanie o\u015bwietleniem HA z wyborem koloru i jasno\u015bci', 'Niestandardowe ikony (PNG, JPG, ICO, WebP)', 'Eksport/import konfiguracji JSON'] },
    settingsModule: { name: 'Ustawienia', desc: 'Pe\u0142na konfiguracja aplikacji.', features: ['Wyb\u00f3r j\u0119zyka (9 j\u0119zyk\u00f3w)', 'Predefiniowane i niestandardowe motywy kolor\u00f3w', 'Kolejno\u015b\u0107 i widoczno\u015b\u0107 modu\u0142\u00f3w', 'Wymiary paska bocznego i launchera', 'Wyb\u00f3r ekranu docelowego', 'Automatyczne uruchamianie z Windows', 'Automatyczne aktualizacje (sprawdzanie, pobieranie, instalacja)', 'Zarz\u0105dzanie licencj\u0105', 'Niestandardowe webviews', 'Linki: polityka prywatno\u015bci, warunki u\u017cytkowania, kontakt'] },
    docker: { name: 'Docker', desc: 'Monitorowanie i zarz\u0105dzanie kontenerami Docker na zdalnych maszynach przez SSH.', features: ['Po\u0142\u0105czenie SSH przez has\u0142o lub klucz prywatny', 'Lista kontener\u00f3w ze statusem w czasie rzeczywistym (running, stopped, paused)', 'Statystyki CPU i RAM na kontener (od\u015bwie\u017canie co 10s)', 'Pe\u0142ne szczeg\u00f3\u0142y: obraz, porty, wolumeny, zmienne \u015brodowiskowe, polityka restartu', 'Akcje: uruchomienie, zatrzymanie, restart kontenera', 'Podgl\u0105d log\u00f3w (ostatnie 50 linii)', 'Obs\u0142uga wielu host\u00f3w z niestandardowymi kolorami', 'Wbudowany test po\u0142\u0105czenia'], setup: 'Wymagania na serwerze zdalnym:\n1. SSH w\u0142\u0105czony (sudo apt install openssh-server && sudo systemctl enable --now ssh)\n2. Docker zainstalowany (curl -fsSL https://get.docker.com | sudo sh)\n3. U\u017cytkownik w grupie docker (sudo usermod -aG docker U\u017bYTKOWNIK)\n\nW PulseDeck: kliknij \"+ Dodaj host\", wprowad\u017a adres IP, port SSH (22), nazw\u0119 u\u017cytkownika i has\u0142o lub wybierz klucz SSH. Przetestuj po\u0142\u0105czenie przed zapisaniem.' },
    voicecommands: { name: 'Komendy g\u0142osowe', desc: 'Offline sterowanie g\u0142osowe PulseDeck przez rozpoznawanie Vosk.', features: ['Rozpoznawanie g\u0142osu offline (\u017cadne dane nie s\u0105 wysy\u0142ane do internetu)', 'Automatyczne pobieranie modelu j\u0119zykowego (~40 MB)', '9 obs\u0142ugiwanych j\u0119zyk\u00f3w (FR, EN, DE, NL, ES, PT, IT, PL, JA)', 'Polecenia systemowe: wy\u0142\u0105cz, uruchom ponownie, u\u015bpij, zablokuj', 'Polecenia multimedialne: odtwarzaj, pauza, nast\u0119pny, poprzedni', 'Sterowanie g\u0142o\u015bno\u015bci\u0105: ustaw, g\u0142o\u015bniej, ciszej, wycisz', 'Home Assistant: w\u0142\u0105cz/wy\u0142\u0105cz \u015bwiat\u0142a, otw\u00f3rz/zamknij rolety (po nazwie)', 'OBS: rozpocznij/zatrzymaj stream i nagrywanie', 'Historia polece\u0144 ze statusem'], setup: 'Wybierz sw\u00f3j mikrofon w module i kliknij przycisk mikrofonu, aby rozpocz\u0105\u0107. Model j\u0119zyka wybranego w ustawieniach zostanie automatycznie pobrany przy pierwszym uruchomieniu.' },
    footerText: 'PulseDeck \u2014 Automatycznie wygenerowany podr\u0119cznik',
  },
  ja: {
    guideTitle: '\u30e6\u30fc\u30b6\u30fc\u30ac\u30a4\u30c9',
    forDevice: 'Corsair Xeneon Edge\u5bfe\u5fdc (2560\u00d7720)',
    tocTitle: '\u76ee\u6b21',
    overviewTitle: '\u6982\u8981',
    overviewDesc: 'PulseDeck\u306f\u3001Corsair Xeneon Edge\u30bf\u30c3\u30c1\u30b9\u30af\u30ea\u30fc\u30f3\u5411\u3051\u306e\u30aa\u30fc\u30eb\u30a4\u30f3\u30ef\u30f3\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u3067\u3059\u3002\u30b7\u30b9\u30c6\u30e0\u306e\u76e3\u8996\u3001\u30e1\u30c7\u30a3\u30a2\u306e\u5236\u5fa1\u3001\u30a2\u30d7\u30ea\u30b1\u30fc\u30b7\u30e7\u30f3\u306e\u7ba1\u7406\u3092\u30a6\u30eb\u30c8\u30e9\u30ef\u30a4\u30c9\u30c7\u30a3\u30b9\u30d7\u30ec\u30a4\u306b\u6700\u9069\u5316\u3055\u308c\u305f\u5358\u4e00\u306e\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9\u3067\u884c\u3048\u307e\u3059\u3002',
    layoutTitle: '\u753b\u9762\u30ec\u30a4\u30a2\u30a6\u30c8',
    layoutSidebar: '\u30b5\u30a4\u30c9\u30d0\u30fc\uff08\u5de6\uff09\u2014 \u30e2\u30b8\u30e5\u30fc\u30eb\u9593\u306e\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3',
    layoutMain: '\u30e1\u30a4\u30f3\u30a8\u30ea\u30a2\uff08\u4e2d\u592e\uff09\u2014 \u30a2\u30af\u30c6\u30a3\u30d6\u30e2\u30b8\u30e5\u30fc\u30eb\u306e\u8868\u793a',
    layoutLauncher: '\u30e9\u30f3\u30c1\u30e3\u30fc\uff08\u53f3\uff09\u2014 \u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u30b0\u30ea\u30c3\u30c9',
    modulesTitle: '\u30e2\u30b8\u30e5\u30fc\u30eb',
    setupLabel: '\u8a2d\u5b9a\u65b9\u6cd5',
    monitoring: { name: '\u30e2\u30cb\u30bf\u30ea\u30f3\u30b0', desc: '\u30ab\u30fc\u30d6\u30c1\u30e3\u30fc\u30c8\u306b\u3088\u308b\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30b7\u30b9\u30c6\u30e0\u76e3\u8996\u3002', features: ['CPU\u30b3\u30a2\u5225\u3001GPU\u3001\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u3001\u30c7\u30a3\u30b9\u30af\u306e\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30ab\u30fc\u30d6', 'RAM\u3001\u30b9\u30c8\u30ec\u30fc\u30b8\u3001\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u30b9\u30eb\u30fc\u30d7\u30c3\u30c8\u306e\u30d7\u30ed\u30b0\u30ec\u30b9\u30d0\u30fc', '\u30a6\u30a3\u30b8\u30a7\u30c3\u30c8\u3054\u3068\u306e\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u30ab\u30e9\u30fc', '\u901a\u77e5\u4ed8\u304d\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u6e29\u5ea6\u30a2\u30e9\u30fc\u30c8', '\u5185\u8535\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8\u901f\u5ea6\u30c6\u30b9\u30c8', '\u30b2\u30fc\u30df\u30f3\u30b0\u30e2\u30fc\u30c9 \u2014 \u81ea\u52d5\u691c\u51fa\u307e\u305f\u306f\u624b\u52d5\u6709\u52b9\u5316'] },
    weather: { name: '\u5929\u6c17', desc: '\u304a\u4f4f\u307e\u3044\u306e\u90fd\u5e02\u306e\u5929\u6c17\u4e88\u5831\u3002', features: ['\u73fe\u5728\u306e\u6c17\u8c61\u6761\u4ef6\u3068\u6570\u65e5\u9593\u306e\u4e88\u5831', '\u30aa\u30fc\u30c8\u30b3\u30f3\u30d7\u30ea\u30fc\u30c8\u4ed8\u304d\u90fd\u5e02\u691c\u7d22', 'Open-Meteo\u306e\u30c7\u30fc\u30bf'] },
    calendar: { name: '\u30ab\u30ec\u30f3\u30c0\u30fc', desc: '\u30de\u30eb\u30c1\u30ab\u30ec\u30f3\u30c0\u30fc\u5bfe\u5fdc\u306e\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u7ba1\u7406\u3002', features: ['OAuth2\u306b\u3088\u308bGoogle\u30ab\u30ec\u30f3\u30c0\u30fc\u63a5\u7d9a', '\u5916\u90e8ICS\u30ab\u30ec\u30f3\u30c0\u30fc\u306e\u30b5\u30dd\u30fc\u30c8', '\u4eca\u5f8c\u306e\u30a4\u30d9\u30f3\u30c8\u8868\u793a', 'Google\u30a4\u30d9\u30f3\u30c8\u306e\u7d20\u65e9\u3044\u4f5c\u6210'], setup: 'Google\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u63a5\u7d9a\u3059\u308b\u304b\u3001\u30e2\u30b8\u30e5\u30fc\u30eb\u8a2d\u5b9a\u3067ICS\u30ab\u30ec\u30f3\u30c0\u30fc\u306eURL\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    homeassistant: { name: 'Home Assistant', desc: 'HA OS\u30b9\u30bf\u30a4\u30eb\u306e\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9\u3067\u30b9\u30de\u30fc\u30c8\u30db\u30fc\u30e0\u5236\u5fa1\u3002', features: ['\u30c9\u30e1\u30a4\u30f3\u5225\u30bf\u30a4\u30eb\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9\uff08\u30e9\u30a4\u30c8\u3001\u30b9\u30a4\u30c3\u30c1\u3001\u30bb\u30f3\u30b5\u30fc\u3001\u30ab\u30d0\u30fc\u306a\u3069\uff09', '\u30a8\u30f3\u30c6\u30a3\u30c6\u30a3\u30c9\u30e1\u30a4\u30f3\u5225\u306e\u30ab\u30e9\u30fc\u30b3\u30fc\u30c9\u30a2\u30a4\u30b3\u30f3', '\u30ab\u30d0\u30fc\uff1a\u30bf\u30a4\u30eb\u4e0a\u306e\u958b\u304f / \u505c\u6b62 / \u9589\u3058\u308b\u30dc\u30bf\u30f3', '\u30e9\u30a4\u30c8\uff1a\u5bfe\u5fdc\u96fb\u7403\u7528\u306e\u30ab\u30e9\u30fc\u30d4\u30c3\u30ab\u30fc\u3068\u8f1d\u5ea6\u30b9\u30e9\u30a4\u30c0\u30fc', '\u30e9\u30a4\u30c8\u30a2\u30a4\u30b3\u30f3\u306b\u5b9f\u969b\u306eRGB\u30ab\u30e9\u30fc\u3092\u8868\u793a', 'WebSocket\u306b\u3088\u308b\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u66f4\u65b0'], setup: 'Home Assistant\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306eURL\u3068\u9577\u671f\u30a2\u30af\u30bb\u30b9\u30c8\u30fc\u30af\u30f3\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb \u2192 \u30c8\u30fc\u30af\u30f3\uff09\u3002' },
    volume: { name: '\u30dc\u30ea\u30e5\u30fc\u30e0\uff06\u30e1\u30c7\u30a3\u30a2', desc: 'DJ\u30c7\u30c3\u30ad/\u30df\u30ad\u30b5\u30fc\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9\u3067\u9ad8\u5ea6\u306a\u30aa\u30fc\u30c7\u30a3\u30aa\u5236\u5fa1\u3068\u30d3\u30b8\u30e5\u30a2\u30e9\u30a4\u30b6\u30fc\u3002', features: ['\u30b7\u30b9\u30c6\u30e0\u97f3\u91cf\u7528SVG\u5186\u5f62\u30ce\u30d6', '\u30ab\u30e9\u30fc\u30b3\u30fc\u30c9\u30ec\u30d9\u30eb\u4ed8\u304dLED VU\u30e1\u30fc\u30bf\u30fc', '\u30c8\u30e9\u30f3\u30b9\u30dd\u30fc\u30c8\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb\uff1a\u524d\u3001\u518d\u751f/\u4e00\u6642\u505c\u6b62\uff08\u52d5\u7684\u30a2\u30a4\u30b3\u30f3\uff09\u3001\u6b21', '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30aa\u30fc\u30c7\u30a3\u30aa\u30d3\u30b8\u30e5\u30a2\u30e9\u30a4\u30b6\u30fc\uff0864\u30d0\u30fc\uff09', '\u30aa\u30fc\u30c7\u30a3\u30aa\u51fa\u529b\u30c7\u30d0\u30a4\u30b9\u306e\u9078\u629e', '\u30af\u30a4\u30c3\u30af\u30dc\u30ea\u30e5\u30fc\u30e0\u30d7\u30ea\u30bb\u30c3\u30c8'] },
    tools: { name: '\u30c4\u30fc\u30eb', desc: '5\u3064\u306e\u751f\u7523\u6027\u30c4\u30fc\u30eb\u30b9\u30a4\u30fc\u30c8\u3002', features: ['\u30dd\u30e2\u30c9\u30fc\u30ed \u2014 \u8a2d\u5b9a\u53ef\u80fd\u306a\u751f\u7523\u6027\u30bf\u30a4\u30de\u30fc', '\u30bf\u30a4\u30de\u30fc \u2014 \u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u30ab\u30a6\u30f3\u30c8\u30c0\u30a6\u30f3', '\u30b9\u30c8\u30c3\u30d7\u30a6\u30a9\u30c3\u30c1 \u2014 \u30e9\u30c3\u30d7\u8a18\u9332\u4ed8\u304d\u8a08\u6642', '\u30e1\u30e2 \u2014 \u30ab\u30e9\u30fc\u30ab\u30c6\u30b4\u30ea\u4ed8\u304d\u30e1\u30e2\u5e33', '\u30b9\u30af\u30ea\u30fc\u30f3\u30b7\u30e7\u30c3\u30c8 \u2014 \u753b\u9762\u30ad\u30e3\u30d7\u30c1\u30e3\u3068\u30ae\u30e3\u30e9\u30ea\u30fc'] },
    news: { name: '\u30cb\u30e5\u30fc\u30b9\uff06\u6697\u53f7\u901a\u8ca8', desc: '\u6697\u53f7\u901a\u8ca8\u30c6\u30a3\u30c3\u30ab\u30fc\u4ed8\u304dRSS\u30d5\u30a3\u30fc\u30c9\u30ea\u30fc\u30c0\u30fc\u3002', features: ['\u30ab\u30c6\u30b4\u30ea\u5225\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fdRSS\u30d5\u30a3\u30fc\u30c9\uff08\u30b2\u30fc\u30e0\u3001\u30c6\u30c3\u30af\u3001\u30bb\u30fc\u30eb\uff09', '\u8a00\u8a9e\u306b\u5408\u308f\u305b\u305f\u30c7\u30d5\u30a9\u30eb\u30c8\u30d5\u30a3\u30fc\u30c9', '\u8a00\u8a9e\u5909\u66f4\u6642\u306e\u30d5\u30a3\u30fc\u30c9\u81ea\u52d5\u5207\u308a\u66ff\u3048', '5\u5206\u3054\u3068\u306e\u81ea\u52d5\u66f4\u65b0', '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u6697\u53f7\u901a\u8ca8\u30c6\u30a3\u30c3\u30ab\u30fc\uff08Bitcoin\u3001Ethereum\u3001Solana\u3001BNB\u2026\uff09'] },
    clipboard: { name: '\u30af\u30ea\u30c3\u30d7\u30dc\u30fc\u30c9', desc: '\u81ea\u52d5\u30af\u30ea\u30c3\u30d7\u30dc\u30fc\u30c9\u5c65\u6b74\u3002', features: ['\u81ea\u52d5\u5c65\u6b74\uff08\u6700\u592720\u4ef6\uff09', '\u30c6\u30ad\u30b9\u30c8\u3068\u753b\u50cf\u306b\u5bfe\u5fdc', '\u30ef\u30f3\u30af\u30ea\u30c3\u30af\u3067\u30b3\u30d4\u30fc'] },
    obs: { name: 'OBS Studio', desc: 'WebSocket\u7d4c\u7531\u306e\u30cd\u30a4\u30c6\u30a3\u30d6OBS Studio\u5236\u5fa1\u3002', features: ['\u30ef\u30f3\u30af\u30ea\u30c3\u30af\u3067\u30b7\u30fc\u30f3\u5207\u308a\u66ff\u3048', '\u30bd\u30fc\u30b9\u306e\u8868\u793a/\u975e\u8868\u793a\u5207\u308a\u66ff\u3048', '\u914d\u4fe1\u30fb\u9332\u753b\u306e\u5236\u5fa1', '\u30e9\u30a4\u30d6\u7d71\u8a08\uff08FPS\u3001CPU\u3001\u30c9\u30ed\u30c3\u30d7\u30d5\u30ec\u30fc\u30e0\u3001RAM\uff09'], setup: 'OBS\u306eWebSocket\u30b5\u30fc\u30d0\u30fc\u3092\u6709\u52b9\u306b\u3057\uff08\u8a2d\u5b9a \u2192 WebSocket\u30b5\u30fc\u30d0\u30fc\uff09\u3001ws://localhost:4455\u3067\u63a5\u7d9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    streaming: { name: '\u30b9\u30c8\u30ea\u30fc\u30df\u30f3\u30b0\u30b5\u30fc\u30d3\u30b9', desc: 'Spotify\u3001SoundCloud\u3001YouTube Music\u3001Twitch\u306b\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u304b\u3089\u76f4\u63a5\u30a2\u30af\u30bb\u30b9\u3002', features: ['\u5404\u30b5\u30fc\u30d3\u30b9\u306e\u5185\u8535Web\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9', '\u6c38\u7d9a\u30bb\u30c3\u30b7\u30e7\u30f3 \u2014 \u30d0\u30c3\u30af\u30b0\u30e9\u30a6\u30f3\u30c9\u3067\u518d\u751f\u304c\u7d99\u7d9a', '\u5404\u30b5\u30fc\u30d3\u30b9\u304c\u30bb\u30c3\u30b7\u30e7\u30f3\u9593\u3067\u63a5\u7d9a\u3092\u7dad\u6301'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Uptime Kuma\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306b\u3088\u308b\u30b5\u30fc\u30d0\u30fc\u76e3\u8996\u3002', features: ['\u5185\u8535Web\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9', '\u6c38\u7d9a\u30bb\u30c3\u30b7\u30e7\u30f3'], setup: 'Uptime Kuma\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306eURL\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    customWebviews: { name: '\u30ab\u30b9\u30bf\u30e0Webview', desc: '\u4efb\u610f\u306eWeb\u30b5\u30a4\u30c8\u3092\u30e2\u30b8\u30e5\u30fc\u30eb\u3068\u3057\u3066\u8ffd\u52a0\u3002', features: ['\u6700\u59275\u3064\u306e\u30ab\u30b9\u30bf\u30e0Webview', '\u6c38\u7d9a\u30bb\u30c3\u30b7\u30e7\u30f3', '\u30a2\u30a4\u30b3\u30f3\u3068\u540d\u524d\u306e\u30ab\u30b9\u30bf\u30de\u30a4\u30ba', '\u8a2d\u5b9a\u3067\u69cb\u6210\u53ef\u80fd'] },
    launcher: { name: '\u30e9\u30f3\u30c1\u30e3\u30fc', desc: '\u753b\u9762\u53f3\u5074\u306e\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u30d1\u30cd\u30eb\u3002', features: ['\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u30dc\u30bf\u30f3\u30b0\u30ea\u30c3\u30c9', '4\u30bf\u30a4\u30d7\uff1a\u30a2\u30d7\u30ea\u3001\u30b7\u30b9\u30c6\u30e0\uff08\u30b7\u30e3\u30c3\u30c8\u30c0\u30a6\u30f3\u3001\u518d\u8d77\u52d5\u3001\u30b9\u30ea\u30fc\u30d7\u2026\uff09\u3001\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb\u3001Home Assistant', 'HA\u30e9\u30a4\u30c8\u5236\u5fa1\uff08\u30ab\u30e9\u30fc\u3068\u8f1d\u5ea6\u306e\u9078\u629e\uff09', '\u30ab\u30b9\u30bf\u30e0\u30a2\u30a4\u30b3\u30f3\uff08PNG\u3001JPG\u3001ICO\u3001WebP\uff09', 'JSON\u8a2d\u5b9a\u306e\u30a8\u30af\u30b9\u30dd\u30fc\u30c8/\u30a4\u30f3\u30dd\u30fc\u30c8'] },
    settingsModule: { name: '\u8a2d\u5b9a', desc: '\u30a2\u30d7\u30ea\u306e\u5168\u4f53\u8a2d\u5b9a\u3002', features: ['\u8a00\u8a9e\u9078\u629e\uff089\u8a00\u8a9e\u5bfe\u5fdc\uff09', '\u30d7\u30ea\u30bb\u30c3\u30c8\uff06\u30ab\u30b9\u30bf\u30e0\u30ab\u30e9\u30fc\u30c6\u30fc\u30de', '\u30e2\u30b8\u30e5\u30fc\u30eb\u306e\u9806\u5e8f\u3068\u8868\u793a/\u975e\u8868\u793a', '\u30b5\u30a4\u30c9\u30d0\u30fc\u3068\u30e9\u30f3\u30c1\u30e3\u30fc\u306e\u30b5\u30a4\u30ba', '\u30bf\u30fc\u30b2\u30c3\u30c8\u30c7\u30a3\u30b9\u30d7\u30ec\u30a4\u306e\u9078\u629e', 'Windows\u8d77\u52d5\u6642\u306e\u81ea\u52d5\u8d77\u52d5', '\u81ea\u52d5\u30a2\u30c3\u30d7\u30c7\u30fc\u30c8\uff08\u78ba\u8a8d\u3001\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3001\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\uff09', '\u30e9\u30a4\u30bb\u30f3\u30b9\u7ba1\u7406', '\u30ab\u30b9\u30bf\u30e0Webview', '\u30ea\u30f3\u30af\uff1a\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc\u30dd\u30ea\u30b7\u30fc\u3001\u5229\u7528\u898f\u7d04\u3001\u304a\u554f\u3044\u5408\u308f\u305b'] },
    docker: { name: 'Docker', desc: 'SSH\u7d4c\u7531\u3067\u30ea\u30e2\u30fc\u30c8\u30de\u30b7\u30f3\u4e0a\u306eDocker\u30b3\u30f3\u30c6\u30ca\u3092\u76e3\u8996\u30fb\u5236\u5fa1\u3002', features: ['\u30d1\u30b9\u30ef\u30fc\u30c9\u307e\u305f\u306f\u79d8\u5bc6\u9375\u306b\u3088\u308bSSH\u63a5\u7d9a', '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30b9\u30c6\u30fc\u30bf\u30b9\u4ed8\u304d\u30b3\u30f3\u30c6\u30ca\u4e00\u89a7\uff08running, stopped, paused\uff09', '\u30b3\u30f3\u30c6\u30ca\u3054\u3068\u306eCPU\u30fbRAM\u30b9\u30c6\u30fc\u30bf\u30b9\uff0810\u79d2\u66f4\u65b0\uff09', '\u5b8c\u5168\u306a\u8a73\u7d30\uff1a\u30a4\u30e1\u30fc\u30b8\u3001\u30dd\u30fc\u30c8\u3001\u30dc\u30ea\u30e5\u30fc\u30e0\u3001\u74b0\u5883\u5909\u6570\u3001\u518d\u8d77\u52d5\u30dd\u30ea\u30b7\u30fc', '\u30a2\u30af\u30b7\u30e7\u30f3\uff1a\u30b3\u30f3\u30c6\u30ca\u306e\u8d77\u52d5\u3001\u505c\u6b62\u3001\u518d\u8d77\u52d5', '\u30ed\u30b0\u8868\u793a\uff08\u76f4\u8fd150\u884c\uff09', '\u30ab\u30b9\u30bf\u30e0\u30ab\u30e9\u30fc\u4ed8\u304d\u30de\u30eb\u30c1\u30db\u30b9\u30c8\u30b5\u30dd\u30fc\u30c8', '\u5185\u8535\u63a5\u7d9a\u30c6\u30b9\u30c8'], setup: '\u30ea\u30e2\u30fc\u30c8\u30b5\u30fc\u30d0\u30fc\u306e\u524d\u63d0\u6761\u4ef6\uff1a\n1. SSH\u304c\u6709\u52b9\uff08sudo apt install openssh-server && sudo systemctl enable --now ssh\uff09\n2. Docker\u304c\u30a4\u30f3\u30b9\u30c8\u30fc\u30eb\u6e08\u307f\uff08curl -fsSL https://get.docker.com | sudo sh\uff09\n3. \u30e6\u30fc\u30b6\u30fc\u304cdocker\u30b0\u30eb\u30fc\u30d7\u306b\u6240\u5c5e\uff08sudo usermod -aG docker \u30e6\u30fc\u30b6\u30fc\u540d\uff09\n\nPulseDeck\u3067\uff1a\u300c+ \u30db\u30b9\u30c8\u8ffd\u52a0\u300d\u3092\u30af\u30ea\u30c3\u30af\u3057\u3001IP\u30a2\u30c9\u30ec\u30b9\u3001SSH\u30dd\u30fc\u30c8\uff0822\uff09\u3001\u30e6\u30fc\u30b6\u30fc\u540d\u3068\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u5165\u529b\u3059\u308b\u304b\u3001SSH\u9375\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u4fdd\u5b58\u524d\u306b\u63a5\u7d9a\u3092\u30c6\u30b9\u30c8\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    voicecommands: { name: '\u97f3\u58f0\u30b3\u30de\u30f3\u30c9', desc: 'Vosk\u8a8d\u8b58\u306b\u3088\u308bPulseDeck\u306e\u30aa\u30d5\u30e9\u30a4\u30f3\u97f3\u58f0\u5236\u5fa1\u3002', features: ['\u30aa\u30d5\u30e9\u30a4\u30f3\u97f3\u58f0\u8a8d\u8b58\uff08\u30c7\u30fc\u30bf\u306f\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8\u306b\u9001\u4fe1\u3055\u308c\u307e\u305b\u3093\uff09', '\u8a00\u8a9e\u30e2\u30c7\u30eb\u306e\u81ea\u52d5\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\uff08\u7d0440 MB\uff09', '9\u8a00\u8a9e\u5bfe\u5fdc\uff08FR, EN, DE, NL, ES, PT, IT, PL, JA\uff09', '\u30b7\u30b9\u30c6\u30e0\u30b3\u30de\u30f3\u30c9\uff1a\u30b7\u30e3\u30c3\u30c8\u30c0\u30a6\u30f3\u3001\u518d\u8d77\u52d5\u3001\u30b9\u30ea\u30fc\u30d7\u3001\u30ed\u30c3\u30af', '\u30e1\u30c7\u30a3\u30a2\u30b3\u30de\u30f3\u30c9\uff1a\u518d\u751f\u3001\u4e00\u6642\u505c\u6b62\u3001\u6b21\u3001\u524d', '\u97f3\u91cf\u5236\u5fa1\uff1a\u8a2d\u5b9a\u3001\u4e0a\u3052\u308b\u3001\u4e0b\u3052\u308b\u3001\u30df\u30e5\u30fc\u30c8', 'Home Assistant\uff1a\u540d\u524d\u3067\u30e9\u30a4\u30c8\u306e\u30aa\u30f3/\u30aa\u30d5\u3001\u30ab\u30d0\u30fc\u306e\u958b\u9589', 'OBS\uff1a\u914d\u4fe1\u30fb\u9332\u753b\u306e\u958b\u59cb/\u505c\u6b62', '\u30b9\u30c6\u30fc\u30bf\u30b9\u4ed8\u304d\u30b3\u30de\u30f3\u30c9\u5c65\u6b74'], setup: '\u30e2\u30b8\u30e5\u30fc\u30eb\u3067\u30de\u30a4\u30af\u3092\u9078\u629e\u3057\u3001\u30de\u30a4\u30af\u30dc\u30bf\u30f3\u3092\u30af\u30ea\u30c3\u30af\u3057\u3066\u958b\u59cb\u3057\u307e\u3059\u3002\u8a2d\u5b9a\u3067\u9078\u629e\u3055\u308c\u305f\u8a00\u8a9e\u306e\u30e2\u30c7\u30eb\u304c\u521d\u56de\u8d77\u52d5\u6642\u306b\u81ea\u52d5\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3055\u308c\u307e\u3059\u3002' },
    footerText: 'PulseDeck \u2014 \u81ea\u52d5\u751f\u6210\u3055\u308c\u305f\u30ac\u30a4\u30c9',
  },
};

function buildHTML(lang) {
  const c = C[lang] || C.fr;
  const appName = 'PulseDeck';

  // Table of contents entries
  const tocItems = [
    `<li>1. ${c.overviewTitle}</li>`,
    ...MODULE_KEYS.map((key, i) => `<li>${i + 2}. ${c[key].name}</li>`),
  ].join('\n');

  // Module sections
  const moduleSections = MODULE_KEYS.map((key, i) => {
    const m = c[key];
    const features = m.features.map(f => `<li>${f}</li>`).join('');
    const setup = m.setup
      ? `<div class="setup"><span class="setup-label">${c.setupLabel} :</span> ${m.setup}</div>`
      : '';
    return `
    <div class="module">
      <h3>${i + 2}. ${m.name}</h3>
      <p>${m.desc}</p>
      <ul>${features}</ul>
      ${setup}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', 'Yu Gothic UI', 'Meiryo', 'Noto Sans', sans-serif;
  color: #1f2937; line-height: 1.65; padding: 50px;
}
.title-page {
  text-align: center; padding: 100px 0 40px;
  page-break-after: always;
}
.title-page h1 { font-size: 34px; color: #6366f1; margin-bottom: 6px; }
.title-page .subtitle { font-size: 18px; color: #6b7280; }
.title-page .device { font-size: 14px; color: #9ca3af; margin-top: 4px; }
.toc { page-break-after: always; }
.toc h2 { font-size: 22px; color: #6366f1; margin-bottom: 16px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; }
.toc ul { list-style: none; padding: 0; }
.toc li { padding: 5px 0; font-size: 14px; border-bottom: 1px dotted #d1d5db; }
h2 { font-size: 20px; color: #6366f1; margin: 28px 0 12px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; }
.module {
  margin: 14px 0; padding: 14px 18px;
  border-left: 4px solid #6366f1; background: #f9fafb;
  border-radius: 0 8px 8px 0; page-break-inside: avoid;
}
.module h3 { font-size: 16px; color: #4f46e5; margin-bottom: 4px; }
.module p { font-size: 13px; color: #4b5563; margin-bottom: 6px; }
.module ul { padding-left: 18px; margin: 0; }
.module li { font-size: 12px; color: #374151; margin: 2px 0; }
.setup {
  margin-top: 8px; padding: 8px 12px; background: #eef2ff;
  border-radius: 6px; font-size: 12px; color: #4338ca;
}
.setup-label { font-weight: 600; }
.overview-text { font-size: 14px; color: #374151; margin-bottom: 14px; }
.layout-list { list-style: none; padding: 0; }
.layout-list li { padding: 4px 0 4px 16px; position: relative; font-size: 13px; }
.layout-list li::before { content: '\\25b8'; position: absolute; left: 0; color: #6366f1; }
.footer {
  margin-top: 30px; padding-top: 12px; border-top: 1px solid #d1d5db;
  text-align: center; font-size: 11px; color: #9ca3af;
}
</style>
</head>
<body>
  <div class="title-page">
    <h1>${c.guideTitle}</h1>
    <div class="subtitle">${appName}</div>
    <div class="device">${c.forDevice}</div>
  </div>

  <div class="toc">
    <h2>${c.tocTitle}</h2>
    <ul>${tocItems}</ul>
  </div>

  <h2>1. ${c.overviewTitle}</h2>
  <p class="overview-text">${c.overviewDesc}</p>
  <h3>${c.layoutTitle}</h3>
  <ul class="layout-list">
    <li>${c.layoutSidebar}</li>
    <li>${c.layoutMain}</li>
    <li>${c.layoutLauncher}</li>
  </ul>

  <h2>${c.modulesTitle}</h2>
  ${moduleSections}

  <div class="footer">${c.footerText}</div>
</body>
</html>`;
}

async function generateAndOpenPDF(lang) {
  const guidesDir = path.join(app.getPath('userData'), 'guides');
  const pdfPath = path.join(guidesDir, `guide-${lang}-v${GUIDE_VERSION}.pdf`);

  // Return cached version if exists
  if (fs.existsSync(pdfPath)) {
    await shell.openPath(pdfPath);
    return { success: true, path: pdfPath };
  }

  // Generate HTML
  const html = buildHTML(lang);
  fs.mkdirSync(guidesDir, { recursive: true });
  const tmpPath = path.join(guidesDir, `_tmp_${lang}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');

  // Render in hidden window and print to PDF
  const win = new BrowserWindow({ show: false, width: 800, height: 600 });
  await win.loadFile(tmpPath);

  const pdfBuffer = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
  });

  fs.writeFileSync(pdfPath, pdfBuffer);
  win.close();

  // Cleanup temp HTML
  try { fs.unlinkSync(tmpPath); } catch {}

  await shell.openPath(pdfPath);
  return { success: true, path: pdfPath };
}

module.exports = { generateAndOpenPDF };
