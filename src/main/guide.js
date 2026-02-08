const { BrowserWindow, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');

const GUIDE_VERSION = '2';

const MODULE_KEYS = [
  'monitoring', 'weather', 'calendar', 'homeassistant',
  'volume', 'tools', 'news', 'clipboard', 'obs',
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
    monitoring: { name: 'Monitoring', desc: 'Surveillance de votre syst\u00e8me en temps r\u00e9el.', features: ['Widgets CPU, GPU, RAM, disques et r\u00e9seau', 'Alertes de temp\u00e9rature personnalisables avec notifications', 'Test de d\u00e9bit internet int\u00e9gr\u00e9 (Speedtest)', 'R\u00e9sum\u00e9 de performance avec jauges visuelles', 'Mode Gaming automatique'] },
    weather: { name: 'M\u00e9t\u00e9o', desc: 'Pr\u00e9visions m\u00e9t\u00e9orologiques pour votre ville.', features: ['Conditions actuelles et pr\u00e9visions multi-jours', 'Recherche de ville avec autocompl\u00e9tion', 'Donn\u00e9es fournies par Open-Meteo'] },
    calendar: { name: 'Calendrier', desc: 'Gestion d\u2019agenda avec support multi-calendriers.', features: ['Connexion Google Calendar via OAuth2', 'Support de calendriers ICS externes', 'Affichage des \u00e9v\u00e9nements \u00e0 venir', 'Cr\u00e9ation rapide d\u2019\u00e9v\u00e9nements Google'], setup: 'Connectez votre compte Google ou ajoutez des URLs de calendriers ICS.' },
    homeassistant: { name: 'Home Assistant', desc: 'Contr\u00f4le de votre maison connect\u00e9e.', features: ['Connexion via URL et token d\u2019acc\u00e8s longue dur\u00e9e', 'Contr\u00f4le des entit\u00e9s (lumi\u00e8res, interrupteurs, capteurs)', 'Mises \u00e0 jour en temps r\u00e9el via WebSocket'], setup: 'Entrez l\u2019URL de votre instance Home Assistant et un token d\u2019acc\u00e8s longue dur\u00e9e (Profil \u2192 Tokens).' },
    volume: { name: 'Volume & M\u00e9dias', desc: 'Contr\u00f4le audio avanc\u00e9 avec visualiseur et contr\u00f4les m\u00e9dia.', features: ['Contr\u00f4le du volume syst\u00e8me avec barres visuelles', 'S\u00e9lection du p\u00e9riph\u00e9rique audio de sortie', 'Contr\u00f4les m\u00e9dia (lecture/pause, suivant, pr\u00e9c\u00e9dent)', 'Visualiseur audio en temps r\u00e9el (64 barres)', 'Pr\u00e9r\u00e9glages de volume rapides'] },
    tools: { name: 'Outils', desc: 'Suite de 5 outils de productivit\u00e9.', features: ['Pomodoro \u2014 Minuteur de productivit\u00e9 configurable', 'Minuteur \u2014 Compte \u00e0 rebours personnalisable', 'Chronom\u00e8tre \u2014 Chronom\u00e9trage avec tours', 'Notes \u2014 Prise de notes avec cat\u00e9gories color\u00e9es', 'Captures d\u2019\u00e9cran \u2014 Capture et galerie d\u2019images'] },
    news: { name: 'Actualit\u00e9s & Crypto', desc: 'Lecteur de flux RSS avec ticker de cryptomonnaies.', features: ['Flux RSS personnalisables par cat\u00e9gorie (jeux, tech, bons plans)', 'Flux par d\u00e9faut adapt\u00e9s \u00e0 votre langue', 'Rafra\u00eechissement automatique toutes les 5 minutes', 'Ticker crypto en temps r\u00e9el (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Presse-papiers', desc: 'Historique automatique du presse-papiers.', features: ['Historique automatique (20 \u00e9l\u00e9ments maximum)', 'Support texte et images', 'Copie rapide en un clic'] },
    obs: { name: 'OBS Studio', desc: 'Contr\u00f4le natif d\u2019OBS Studio via WebSocket.', features: ['Changement de sc\u00e8nes en un clic', 'Activation/d\u00e9sactivation des sources', 'Contr\u00f4le du stream et de l\u2019enregistrement', 'Statistiques en direct (FPS, CPU, images perdues, RAM)'], setup: 'Activez le serveur WebSocket dans OBS (Param\u00e8tres \u2192 Serveur WebSocket), puis connectez-vous avec ws://localhost:4455.' },
    streaming: { name: 'Services de streaming', desc: 'Spotify, SoundCloud, YouTube Music et Twitch int\u00e9gr\u00e9s au tableau de bord.', features: ['Interface web int\u00e9gr\u00e9e pour chaque service', 'Sessions persistantes \u2014 la lecture continue en arri\u00e8re-plan', 'Chaque service conserve sa connexion entre les sessions'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Surveillance de serveurs via votre instance Uptime Kuma.', features: ['Interface web int\u00e9gr\u00e9e', 'Session persistante'], setup: 'Entrez l\u2019URL de votre instance Uptime Kuma.' },
    customWebviews: { name: 'Webviews personnalis\u00e9es', desc: 'Ajoutez n\u2019importe quel site web comme module.', features: ['Jusqu\u2019\u00e0 5 webviews personnalis\u00e9es', 'Sessions persistantes', 'Ic\u00f4ne et nom personnalisables', 'Configurable dans les Param\u00e8tres'] },
    launcher: { name: 'Lanceur', desc: 'Panneau de raccourcis sur le c\u00f4t\u00e9 droit de l\u2019\u00e9cran.', features: ['Grille de boutons personnalisables', 'Trois types : Application, Syst\u00e8me (arr\u00eat, red\u00e9marrage, veille\u2026), Profil', 'Ic\u00f4nes personnalisables (PNG, JPG, ICO, WebP)', 'Export/import de la configuration en JSON'] },
    settingsModule: { name: 'Param\u00e8tres', desc: 'Configuration compl\u00e8te de l\u2019application.', features: ['Choix de la langue (9 langues)', 'Th\u00e8mes de couleurs pr\u00e9d\u00e9finis et personnalis\u00e9s', 'Ordre et visibilit\u00e9 des modules', 'Dimensions de la barre lat\u00e9rale et du lanceur', 'D\u00e9marrage automatique avec Windows', 'Gestion de la licence', 'Webviews personnalis\u00e9es'] },
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
    monitoring: { name: 'Monitoring', desc: 'Real-time system monitoring.', features: ['CPU, GPU, RAM, disk and network widgets', 'Customizable temperature alerts with notifications', 'Built-in internet speed test (Speedtest)', 'Performance summary with visual gauges', 'Automatic Gaming Mode'] },
    weather: { name: 'Weather', desc: 'Weather forecast for your city.', features: ['Current conditions and multi-day forecast', 'City search with autocomplete', 'Data provided by Open-Meteo'] },
    calendar: { name: 'Calendar', desc: 'Calendar management with multi-calendar support.', features: ['Google Calendar connection via OAuth2', 'External ICS calendar support', 'Upcoming events display', 'Quick Google event creation'], setup: 'Connect your Google account or add ICS calendar URLs in the module settings.' },
    homeassistant: { name: 'Home Assistant', desc: 'Smart home control.', features: ['Connection via URL and long-lived access token', 'Entity control (lights, switches, sensors)', 'Real-time updates via WebSocket'], setup: 'Enter your Home Assistant instance URL and a long-lived access token (Profile \u2192 Tokens).' },
    volume: { name: 'Volume & Media', desc: 'Advanced audio control with visualizer and media controls.', features: ['System volume control with visual bars', 'Audio output device selection', 'Media controls (play/pause, next, previous)', 'Real-time audio visualizer (64 bars)', 'Quick volume presets'] },
    tools: { name: 'Tools', desc: 'Suite of 5 productivity tools.', features: ['Pomodoro \u2014 Configurable productivity timer', 'Timer \u2014 Customizable countdown', 'Stopwatch \u2014 Timing with lap recording', 'Notes \u2014 Note-taking with colored categories', 'Screenshots \u2014 Screen capture and image gallery'] },
    news: { name: 'News & Crypto', desc: 'RSS feed reader with cryptocurrency ticker.', features: ['Customizable RSS feeds by category (gaming, tech, deals)', 'Default feeds adapted to your language', 'Automatic refresh every 5 minutes', 'Real-time crypto ticker (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Clipboard', desc: 'Automatic clipboard history.', features: ['Automatic history (up to 20 items)', 'Text and image support', 'One-click copy'] },
    obs: { name: 'OBS Studio', desc: 'Native OBS Studio control via WebSocket.', features: ['One-click scene switching', 'Source visibility toggle', 'Stream and recording control', 'Live statistics (FPS, CPU, dropped frames, RAM)'], setup: 'Enable the WebSocket server in OBS (Settings \u2192 WebSocket Server), then connect with ws://localhost:4455.' },
    streaming: { name: 'Streaming Services', desc: 'Access Spotify, SoundCloud, YouTube Music and Twitch from the dashboard.', features: ['Built-in web interface for each service', 'Persistent sessions \u2014 playback continues in background', 'Each service keeps its connection between sessions'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Server monitoring via your Uptime Kuma instance.', features: ['Built-in web interface', 'Persistent session'], setup: 'Enter the URL of your Uptime Kuma instance.' },
    customWebviews: { name: 'Custom Webviews', desc: 'Add any website as a module.', features: ['Up to 5 custom webviews', 'Persistent sessions', 'Customizable icon and name', 'Configurable in Settings'] },
    launcher: { name: 'Launcher', desc: 'Shortcut panel on the right side of the screen.', features: ['Customizable button grid', 'Three types: Application, System (shutdown, restart, sleep\u2026), Profile', 'Custom icons (PNG, JPG, ICO, WebP)', 'JSON configuration export/import'] },
    settingsModule: { name: 'Settings', desc: 'Full application configuration.', features: ['Language selection (9 languages)', 'Preset and custom color themes', 'Module order and visibility', 'Sidebar and launcher dimensions', 'Auto-start with Windows', 'License management', 'Custom webviews'] },
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
    monitoring: { name: 'Monitoring', desc: 'Echtzeit-System\u00fcberwachung.', features: ['CPU-, GPU-, RAM-, Festplatten- und Netzwerk-Widgets', 'Anpassbare Temperaturwarnungen mit Benachrichtigungen', 'Integrierter Internet-Speedtest', 'Leistungs\u00fcbersicht mit visuellen Anzeigen', 'Automatischer Gaming-Modus'] },
    weather: { name: 'Wetter', desc: 'Wettervorhersage f\u00fcr Ihre Stadt.', features: ['Aktuelle Bedingungen und mehrt\u00e4gige Vorhersage', 'Stadtsuche mit Autovervollst\u00e4ndigung', 'Daten von Open-Meteo'] },
    calendar: { name: 'Kalender', desc: 'Kalenderverwaltung mit Multi-Kalender-Unterst\u00fctzung.', features: ['Google Calendar-Verbindung \u00fcber OAuth2', 'Externe ICS-Kalender-Unterst\u00fctzung', 'Anzeige bevorstehender Termine', 'Schnelle Google-Terminerstellung'], setup: 'Verbinden Sie Ihr Google-Konto oder f\u00fcgen Sie ICS-Kalender-URLs in den Moduleinstellungen hinzu.' },
    homeassistant: { name: 'Home Assistant', desc: 'Smart-Home-Steuerung.', features: ['Verbindung \u00fcber URL und langlebiges Zugriffstoken', 'Entit\u00e4tssteuerung (Lichter, Schalter, Sensoren)', 'Echtzeit-Updates \u00fcber WebSocket'], setup: 'Geben Sie die URL Ihrer Home Assistant-Instanz und ein langlebiges Zugriffstoken ein (Profil \u2192 Tokens).' },
    volume: { name: 'Lautst\u00e4rke & Medien', desc: 'Erweiterte Audiosteuerung mit Visualizer und Mediensteuerung.', features: ['Systemlautst\u00e4rke mit visuellen Balken', 'Auswahl des Audio-Ausgabeger\u00e4ts', 'Mediensteuerung (Play/Pause, Weiter, Zur\u00fcck)', 'Echtzeit-Audio-Visualizer (64 Balken)', 'Schnelle Lautst\u00e4rke-Voreinstellungen'] },
    tools: { name: 'Werkzeuge', desc: 'Suite mit 5 Produktivit\u00e4tswerkzeugen.', features: ['Pomodoro \u2014 Konfigurierbarer Produktivit\u00e4tstimer', 'Timer \u2014 Anpassbarer Countdown', 'Stoppuhr \u2014 Zeitmessung mit Rundenaufzeichnung', 'Notizen \u2014 Notizen mit farbigen Kategorien', 'Screenshots \u2014 Bildschirmaufnahme und Bildergalerie'] },
    news: { name: 'Nachrichten & Crypto', desc: 'RSS-Feed-Reader mit Kryptow\u00e4hrungs-Ticker.', features: ['Anpassbare RSS-Feeds nach Kategorie (Gaming, Tech, Angebote)', 'Standard-Feeds angepasst an Ihre Sprache', 'Automatische Aktualisierung alle 5 Minuten', 'Echtzeit-Crypto-Ticker (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Zwischenablage', desc: 'Automatischer Zwischenablage-Verlauf.', features: ['Automatischer Verlauf (bis zu 20 Eintr\u00e4ge)', 'Text- und Bildunterst\u00fctzung', 'Kopieren mit einem Klick'] },
    obs: { name: 'OBS Studio', desc: 'Native OBS Studio-Steuerung \u00fcber WebSocket.', features: ['Szenenwechsel mit einem Klick', 'Quellensichtbarkeit umschalten', 'Stream- und Aufnahmesteuerung', 'Live-Statistiken (FPS, CPU, verlorene Frames, RAM)'], setup: 'Aktivieren Sie den WebSocket-Server in OBS (Einstellungen \u2192 WebSocket-Server) und verbinden Sie sich mit ws://localhost:4455.' },
    streaming: { name: 'Streaming-Dienste', desc: 'Zugriff auf Spotify, SoundCloud, YouTube Music und Twitch aus dem Dashboard.', features: ['Integrierte Weboberfl\u00e4che f\u00fcr jeden Dienst', 'Persistente Sitzungen \u2014 Wiedergabe l\u00e4uft im Hintergrund weiter', 'Jeder Dienst beh\u00e4lt seine Verbindung zwischen Sitzungen'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Server\u00fcberwachung \u00fcber Ihre Uptime Kuma-Instanz.', features: ['Integrierte Weboberfl\u00e4che', 'Persistente Sitzung'], setup: 'Geben Sie die URL Ihrer Uptime Kuma-Instanz ein.' },
    customWebviews: { name: 'Benutzerdefinierte Webviews', desc: 'F\u00fcgen Sie beliebige Websites als Modul hinzu.', features: ['Bis zu 5 benutzerdefinierte Webviews', 'Persistente Sitzungen', 'Anpassbares Symbol und Name', 'Konfigurierbar in den Einstellungen'] },
    launcher: { name: 'Launcher', desc: 'Verkn\u00fcpfungspanel auf der rechten Seite des Bildschirms.', features: ['Anpassbares Schaltfl\u00e4chenraster', 'Drei Typen: Anwendung, System (Herunterfahren, Neustart, Ruhezustand\u2026), Profil', 'Benutzerdefinierte Symbole (PNG, JPG, ICO, WebP)', 'JSON-Konfigurationsexport/-import'] },
    settingsModule: { name: 'Einstellungen', desc: 'Vollst\u00e4ndige Anwendungskonfiguration.', features: ['Sprachauswahl (9 Sprachen)', 'Voreingestellte und benutzerdefinierte Farbthemen', 'Modulreihenfolge und Sichtbarkeit', 'Seitenleisten- und Launcher-Abmessungen', 'Autostart mit Windows', 'Lizenzverwaltung', 'Benutzerdefinierte Webviews'] },
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
    monitoring: { name: 'Monitoring', desc: 'Real-time systeemmonitoring.', features: ['CPU, GPU, RAM, schijf- en netwerkwidgets', 'Aanpasbare temperatuurwaarschuwingen met meldingen', 'Ingebouwde internet-speedtest', 'Prestatieoverzicht met visuele meters', 'Automatische gamingmodus'] },
    weather: { name: 'Weer', desc: 'Weersvoorspelling voor uw stad.', features: ['Huidige omstandigheden en meerdaagse voorspelling', 'Stad zoeken met autocomplete', 'Gegevens van Open-Meteo'] },
    calendar: { name: 'Kalender', desc: 'Agendabeheer met multi-kalender ondersteuning.', features: ['Google Calendar-verbinding via OAuth2', 'Externe ICS-kalender ondersteuning', 'Weergave van komende afspraken', 'Snel Google-afspraken aanmaken'], setup: 'Verbind uw Google-account of voeg ICS-kalender-URLs toe in de moduleinstellingen.' },
    homeassistant: { name: 'Home Assistant', desc: 'Slimme huisbesturing.', features: ['Verbinding via URL en langlevend toegangstoken', 'Entiteitbesturing (lampen, schakelaars, sensoren)', 'Real-time updates via WebSocket'], setup: 'Voer de URL van uw Home Assistant-instantie en een langlevend toegangstoken in (Profiel \u2192 Tokens).' },
    volume: { name: 'Volume & Media', desc: 'Geavanceerde audiobediening met visualizer en mediabediening.', features: ['Systeemvolume met visuele balken', 'Selectie van audio-uitvoerapparaat', 'Mediabediening (afspelen/pauzeren, volgende, vorige)', 'Real-time audiovisualizer (64 balken)', 'Snelle volumepresets'] },
    tools: { name: 'Hulpmiddelen', desc: 'Suite van 5 productiviteitstools.', features: ['Pomodoro \u2014 Instelbare productiviteitstimer', 'Timer \u2014 Aanpasbare afteltimer', 'Stopwatch \u2014 Tijdmeting met ronderegistratie', 'Notities \u2014 Notities met gekleurde categorie\u00ebn', 'Screenshots \u2014 Schermopname en galerij'] },
    news: { name: 'Nieuws & Crypto', desc: 'RSS-feedlezer met crypto-ticker.', features: ['Aanpasbare RSS-feeds per categorie (gaming, tech, aanbiedingen)', 'Standaardfeeds aangepast aan uw taal', 'Automatische vernieuwing elke 5 minuten', 'Real-time crypto-ticker (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Klembord', desc: 'Automatische klembordgeschiedenis.', features: ['Automatische geschiedenis (max. 20 items)', 'Tekst- en afbeeldingsondersteuning', 'Kopi\u00ebren met \u00e9\u00e9n klik'] },
    obs: { name: 'OBS Studio', desc: 'Native OBS Studio-bediening via WebSocket.', features: ['Sc\u00e8newisseling met \u00e9\u00e9n klik', 'Bronzichtbaarheid schakelen', 'Stream- en opnamebediening', 'Live statistieken (FPS, CPU, verloren frames, RAM)'], setup: 'Schakel de WebSocket-server in OBS in (Instellingen \u2192 WebSocket-server) en maak verbinding met ws://localhost:4455.' },
    streaming: { name: 'Streamingdiensten', desc: 'Toegang tot Spotify, SoundCloud, YouTube Music en Twitch vanuit het dashboard.', features: ['Ingebouwde webinterface voor elke dienst', 'Persistente sessies \u2014 afspelen gaat door op de achtergrond', 'Elke dienst behoudt zijn verbinding tussen sessies'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Servermonitoring via uw Uptime Kuma-instantie.', features: ['Ingebouwde webinterface', 'Persistente sessie'], setup: 'Voer de URL van uw Uptime Kuma-instantie in.' },
    customWebviews: { name: 'Aangepaste Webviews', desc: 'Voeg elke website toe als module.', features: ['Tot 5 aangepaste webviews', 'Persistente sessies', 'Aanpasbaar pictogram en naam', 'Configureerbaar in Instellingen'] },
    launcher: { name: 'Launcher', desc: 'Snelkoppelingenpaneel aan de rechterkant van het scherm.', features: ['Aanpasbaar knoppenraster', 'Drie typen: Applicatie, Systeem (afsluiten, herstarten, slaapstand\u2026), Profiel', 'Aangepaste pictogrammen (PNG, JPG, ICO, WebP)', 'JSON-configuratie export/import'] },
    settingsModule: { name: 'Instellingen', desc: 'Volledige applicatieconfiguratie.', features: ['Taalselectie (9 talen)', 'Vooraf ingestelde en aangepaste kleurthema\'s', 'Modulevolgorde en zichtbaarheid', 'Zijbalk- en launcher-afmetingen', 'Automatisch starten met Windows', 'Licentiebeheer', 'Aangepaste webviews'] },
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
    monitoring: { name: 'Monitoring', desc: 'Monitorizaci\u00f3n del sistema en tiempo real.', features: ['Widgets de CPU, GPU, RAM, discos y red', 'Alertas de temperatura personalizables con notificaciones', 'Test de velocidad de internet integrado', 'Resumen de rendimiento con indicadores visuales', 'Modo Gaming autom\u00e1tico'] },
    weather: { name: 'Clima', desc: 'Pron\u00f3stico del tiempo para su ciudad.', features: ['Condiciones actuales y pron\u00f3stico de varios d\u00edas', 'B\u00fasqueda de ciudad con autocompletado', 'Datos proporcionados por Open-Meteo'] },
    calendar: { name: 'Calendario', desc: 'Gesti\u00f3n de agenda con soporte multi-calendario.', features: ['Conexi\u00f3n a Google Calendar v\u00eda OAuth2', 'Soporte de calendarios ICS externos', 'Visualizaci\u00f3n de pr\u00f3ximos eventos', 'Creaci\u00f3n r\u00e1pida de eventos Google'], setup: 'Conecte su cuenta de Google o a\u00f1ada URLs de calendarios ICS en la configuraci\u00f3n del m\u00f3dulo.' },
    homeassistant: { name: 'Home Assistant', desc: 'Control del hogar inteligente.', features: ['Conexi\u00f3n mediante URL y token de acceso de larga duraci\u00f3n', 'Control de entidades (luces, interruptores, sensores)', 'Actualizaciones en tiempo real v\u00eda WebSocket'], setup: 'Introduzca la URL de su instancia de Home Assistant y un token de acceso de larga duraci\u00f3n (Perfil \u2192 Tokens).' },
    volume: { name: 'Volumen y Medios', desc: 'Control de audio avanzado con visualizador y controles multimedia.', features: ['Control de volumen del sistema con barras visuales', 'Selecci\u00f3n de dispositivo de salida de audio', 'Controles multimedia (reproducir/pausar, siguiente, anterior)', 'Visualizador de audio en tiempo real (64 barras)', 'Preajustes de volumen r\u00e1pidos'] },
    tools: { name: 'Herramientas', desc: 'Suite de 5 herramientas de productividad.', features: ['Pomodoro \u2014 Temporizador de productividad configurable', 'Temporizador \u2014 Cuenta regresiva personalizable', 'Cron\u00f3metro \u2014 Medici\u00f3n con registro de vueltas', 'Notas \u2014 Notas con categor\u00edas de colores', 'Capturas de pantalla \u2014 Captura y galer\u00eda'] },
    news: { name: 'Noticias y Crypto', desc: 'Lector de feeds RSS con ticker de criptomonedas.', features: ['Feeds RSS personalizables por categor\u00eda (juegos, tech, ofertas)', 'Feeds por defecto adaptados a su idioma', 'Actualizaci\u00f3n autom\u00e1tica cada 5 minutos', 'Ticker crypto en tiempo real (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Portapapeles', desc: 'Historial autom\u00e1tico del portapapeles.', features: ['Historial autom\u00e1tico (hasta 20 elementos)', 'Soporte de texto e im\u00e1genes', 'Copia con un clic'] },
    obs: { name: 'OBS Studio', desc: 'Control nativo de OBS Studio v\u00eda WebSocket.', features: ['Cambio de escenas con un clic', 'Alternar visibilidad de fuentes', 'Control de stream y grabaci\u00f3n', 'Estad\u00edsticas en vivo (FPS, CPU, fotogramas perdidos, RAM)'], setup: 'Active el servidor WebSocket en OBS (Ajustes \u2192 Servidor WebSocket) y con\u00e9ctese con ws://localhost:4455.' },
    streaming: { name: 'Servicios de streaming', desc: 'Acceda a Spotify, SoundCloud, YouTube Music y Twitch desde el panel.', features: ['Interfaz web integrada para cada servicio', 'Sesiones persistentes \u2014 la reproducci\u00f3n contin\u00faa en segundo plano', 'Cada servicio mantiene su conexi\u00f3n entre sesiones'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitorizaci\u00f3n de servidores v\u00eda su instancia de Uptime Kuma.', features: ['Interfaz web integrada', 'Sesi\u00f3n persistente'], setup: 'Introduzca la URL de su instancia de Uptime Kuma.' },
    customWebviews: { name: 'Webviews personalizadas', desc: 'A\u00f1ada cualquier sitio web como m\u00f3dulo.', features: ['Hasta 5 webviews personalizadas', 'Sesiones persistentes', 'Icono y nombre personalizables', 'Configurable en Ajustes'] },
    launcher: { name: 'Lanzador', desc: 'Panel de accesos directos en el lado derecho de la pantalla.', features: ['Cuadr\u00edcula de botones personalizables', 'Tres tipos: Aplicaci\u00f3n, Sistema (apagar, reiniciar, suspender\u2026), Perfil', 'Iconos personalizables (PNG, JPG, ICO, WebP)', 'Exportaci\u00f3n/importaci\u00f3n de configuraci\u00f3n JSON'] },
    settingsModule: { name: 'Ajustes', desc: 'Configuraci\u00f3n completa de la aplicaci\u00f3n.', features: ['Selecci\u00f3n de idioma (9 idiomas)', 'Temas de colores predefinidos y personalizados', 'Orden y visibilidad de m\u00f3dulos', 'Dimensiones de barra lateral y lanzador', 'Inicio autom\u00e1tico con Windows', 'Gesti\u00f3n de licencia', 'Webviews personalizadas'] },
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
    monitoring: { name: 'Monitoring', desc: 'Monitoriza\u00e7\u00e3o do sistema em tempo real.', features: ['Widgets de CPU, GPU, RAM, discos e rede', 'Alertas de temperatura personaliz\u00e1veis com notifica\u00e7\u00f5es', 'Teste de velocidade de internet integrado', 'Resumo de desempenho com indicadores visuais', 'Modo Gaming autom\u00e1tico'] },
    weather: { name: 'Meteorologia', desc: 'Previs\u00e3o meteorol\u00f3gica para a sua cidade.', features: ['Condi\u00e7\u00f5es atuais e previs\u00e3o de v\u00e1rios dias', 'Pesquisa de cidade com autocompletar', 'Dados fornecidos pelo Open-Meteo'] },
    calendar: { name: 'Calend\u00e1rio', desc: 'Gest\u00e3o de agenda com suporte multi-calend\u00e1rio.', features: ['Liga\u00e7\u00e3o ao Google Calendar via OAuth2', 'Suporte de calend\u00e1rios ICS externos', 'Exibi\u00e7\u00e3o de pr\u00f3ximos eventos', 'Cria\u00e7\u00e3o r\u00e1pida de eventos Google'], setup: 'Ligue a sua conta Google ou adicione URLs de calend\u00e1rios ICS nas defini\u00e7\u00f5es do m\u00f3dulo.' },
    homeassistant: { name: 'Home Assistant', desc: 'Controlo de casa inteligente.', features: ['Liga\u00e7\u00e3o via URL e token de acesso de longa dura\u00e7\u00e3o', 'Controlo de entidades (luzes, interruptores, sensores)', 'Atualiza\u00e7\u00f5es em tempo real via WebSocket'], setup: 'Insira o URL da sua inst\u00e2ncia Home Assistant e um token de acesso de longa dura\u00e7\u00e3o (Perfil \u2192 Tokens).' },
    volume: { name: 'Volume e M\u00e9dia', desc: 'Controlo de \u00e1udio avan\u00e7ado com visualizador e controlos de m\u00e9dia.', features: ['Controlo de volume do sistema com barras visuais', 'Sele\u00e7\u00e3o de dispositivo de sa\u00edda de \u00e1udio', 'Controlos de m\u00e9dia (reproduzir/pausar, seguinte, anterior)', 'Visualizador de \u00e1udio em tempo real (64 barras)', 'Predefini\u00e7\u00f5es de volume r\u00e1pidas'] },
    tools: { name: 'Ferramentas', desc: 'Suite de 5 ferramentas de produtividade.', features: ['Pomodoro \u2014 Temporizador de produtividade configur\u00e1vel', 'Temporizador \u2014 Contagem decrescente personaliz\u00e1vel', 'Cron\u00f3metro \u2014 Medi\u00e7\u00e3o com registo de voltas', 'Notas \u2014 Notas com categorias coloridas', 'Capturas de ecr\u00e3 \u2014 Captura e galeria'] },
    news: { name: 'Not\u00edcias e Crypto', desc: 'Leitor de feeds RSS com ticker de criptomoedas.', features: ['Feeds RSS personaliz\u00e1veis por categoria (jogos, tech, promo\u00e7\u00f5es)', 'Feeds padr\u00e3o adaptados ao seu idioma', 'Atualiza\u00e7\u00e3o autom\u00e1tica a cada 5 minutos', 'Ticker crypto em tempo real (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: '\u00c1rea de Transfer\u00eancia', desc: 'Hist\u00f3rico autom\u00e1tico da \u00e1rea de transfer\u00eancia.', features: ['Hist\u00f3rico autom\u00e1tico (at\u00e9 20 itens)', 'Suporte de texto e imagens', 'C\u00f3pia com um clique'] },
    obs: { name: 'OBS Studio', desc: 'Controlo nativo do OBS Studio via WebSocket.', features: ['Mudan\u00e7a de cenas com um clique', 'Alternar visibilidade das fontes', 'Controlo de stream e grava\u00e7\u00e3o', 'Estat\u00edsticas em direto (FPS, CPU, quadros perdidos, RAM)'], setup: 'Ative o servidor WebSocket no OBS (Configura\u00e7\u00f5es \u2192 Servidor WebSocket) e ligue-se com ws://localhost:4455.' },
    streaming: { name: 'Servi\u00e7os de Streaming', desc: 'Aceda ao Spotify, SoundCloud, YouTube Music e Twitch a partir do painel.', features: ['Interface web integrada para cada servi\u00e7o', 'Sess\u00f5es persistentes \u2014 a reprodu\u00e7\u00e3o continua em segundo plano', 'Cada servi\u00e7o mant\u00e9m a sua liga\u00e7\u00e3o entre sess\u00f5es'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitoriza\u00e7\u00e3o de servidores via a sua inst\u00e2ncia Uptime Kuma.', features: ['Interface web integrada', 'Sess\u00e3o persistente'], setup: 'Insira o URL da sua inst\u00e2ncia Uptime Kuma.' },
    customWebviews: { name: 'Webviews Personalizadas', desc: 'Adicione qualquer website como m\u00f3dulo.', features: ['At\u00e9 5 webviews personalizadas', 'Sess\u00f5es persistentes', '\u00cdcone e nome personaliz\u00e1veis', 'Configur\u00e1vel nas Defini\u00e7\u00f5es'] },
    launcher: { name: 'Lan\u00e7ador', desc: 'Painel de atalhos no lado direito do ecr\u00e3.', features: ['Grelha de bot\u00f5es personaliz\u00e1veis', 'Tr\u00eas tipos: Aplica\u00e7\u00e3o, Sistema (desligar, reiniciar, suspender\u2026), Perfil', '\u00cdcones personaliz\u00e1veis (PNG, JPG, ICO, WebP)', 'Exporta\u00e7\u00e3o/importa\u00e7\u00e3o de configura\u00e7\u00e3o JSON'] },
    settingsModule: { name: 'Defini\u00e7\u00f5es', desc: 'Configura\u00e7\u00e3o completa da aplica\u00e7\u00e3o.', features: ['Sele\u00e7\u00e3o de idioma (9 idiomas)', 'Temas de cores predefinidos e personalizados', 'Ordem e visibilidade dos m\u00f3dulos', 'Dimens\u00f5es da barra lateral e do lan\u00e7ador', 'Arranque autom\u00e1tico com Windows', 'Gest\u00e3o de licen\u00e7a', 'Webviews personalizadas'] },
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
    monitoring: { name: 'Monitoring', desc: 'Monitoraggio del sistema in tempo reale.', features: ['Widget CPU, GPU, RAM, dischi e rete', 'Avvisi di temperatura personalizzabili con notifiche', 'Test di velocit\u00e0 internet integrato', 'Riepilogo prestazioni con indicatori visivi', 'Modalit\u00e0 Gaming automatica'] },
    weather: { name: 'Meteo', desc: 'Previsioni meteorologiche per la tua citt\u00e0.', features: ['Condizioni attuali e previsioni multi-giorno', 'Ricerca citt\u00e0 con autocompletamento', 'Dati forniti da Open-Meteo'] },
    calendar: { name: 'Calendario', desc: 'Gestione agenda con supporto multi-calendario.', features: ['Connessione Google Calendar tramite OAuth2', 'Supporto calendari ICS esterni', 'Visualizzazione eventi imminenti', 'Creazione rapida eventi Google'], setup: 'Collega il tuo account Google o aggiungi URL di calendari ICS nelle impostazioni del modulo.' },
    homeassistant: { name: 'Home Assistant', desc: 'Controllo della casa intelligente.', features: ['Connessione tramite URL e token di accesso a lunga durata', 'Controllo entit\u00e0 (luci, interruttori, sensori)', 'Aggiornamenti in tempo reale via WebSocket'], setup: 'Inserisci l\'URL della tua istanza Home Assistant e un token di accesso a lunga durata (Profilo \u2192 Token).' },
    volume: { name: 'Volume e Media', desc: 'Controllo audio avanzato con visualizzatore e controlli multimediali.', features: ['Controllo volume di sistema con barre visive', 'Selezione dispositivo di uscita audio', 'Controlli multimediali (play/pausa, successivo, precedente)', 'Visualizzatore audio in tempo reale (64 barre)', 'Preset volume rapidi'] },
    tools: { name: 'Strumenti', desc: 'Suite di 5 strumenti di produttivit\u00e0.', features: ['Pomodoro \u2014 Timer di produttivit\u00e0 configurabile', 'Timer \u2014 Conto alla rovescia personalizzabile', 'Cronometro \u2014 Misurazione tempo con giri', 'Note \u2014 Appunti con categorie colorate', 'Screenshot \u2014 Cattura schermo e galleria'] },
    news: { name: 'Notizie e Crypto', desc: 'Lettore di feed RSS con ticker criptovalute.', features: ['Feed RSS personalizzabili per categoria (gaming, tech, offerte)', 'Feed predefiniti adattati alla tua lingua', 'Aggiornamento automatico ogni 5 minuti', 'Ticker crypto in tempo reale (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Appunti', desc: 'Cronologia automatica degli appunti.', features: ['Cronologia automatica (fino a 20 elementi)', 'Supporto testo e immagini', 'Copia con un clic'] },
    obs: { name: 'OBS Studio', desc: 'Controllo nativo di OBS Studio via WebSocket.', features: ['Cambio scena con un clic', 'Attiva/disattiva visibilit\u00e0 sorgenti', 'Controllo stream e registrazione', 'Statistiche in diretta (FPS, CPU, frame persi, RAM)'], setup: 'Attiva il server WebSocket in OBS (Impostazioni \u2192 Server WebSocket) e connettiti con ws://localhost:4455.' },
    streaming: { name: 'Servizi di Streaming', desc: 'Accedi a Spotify, SoundCloud, YouTube Music e Twitch dal pannello.', features: ['Interfaccia web integrata per ogni servizio', 'Sessioni persistenti \u2014 la riproduzione continua in background', 'Ogni servizio mantiene la connessione tra le sessioni'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitoraggio server tramite la tua istanza Uptime Kuma.', features: ['Interfaccia web integrata', 'Sessione persistente'], setup: 'Inserisci l\'URL della tua istanza Uptime Kuma.' },
    customWebviews: { name: 'Webview Personalizzate', desc: 'Aggiungi qualsiasi sito web come modulo.', features: ['Fino a 5 webview personalizzate', 'Sessioni persistenti', 'Icona e nome personalizzabili', 'Configurabile nelle Impostazioni'] },
    launcher: { name: 'Launcher', desc: 'Pannello scorciatoie sul lato destro dello schermo.', features: ['Griglia di pulsanti personalizzabili', 'Tre tipi: Applicazione, Sistema (spegnimento, riavvio, sospensione\u2026), Profilo', 'Icone personalizzabili (PNG, JPG, ICO, WebP)', 'Esportazione/importazione configurazione JSON'] },
    settingsModule: { name: 'Impostazioni', desc: 'Configurazione completa dell\'applicazione.', features: ['Selezione lingua (9 lingue)', 'Temi colori predefiniti e personalizzati', 'Ordine e visibilit\u00e0 dei moduli', 'Dimensioni barra laterale e launcher', 'Avvio automatico con Windows', 'Gestione licenza', 'Webview personalizzate'] },
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
    monitoring: { name: 'Monitoring', desc: 'Monitorowanie systemu w czasie rzeczywistym.', features: ['Wid\u017cety CPU, GPU, RAM, dysk\u00f3w i sieci', 'Konfigurowalne alerty temperaturowe z powiadomieniami', 'Wbudowany test pr\u0119dko\u015bci internetu', 'Podsumowanie wydajno\u015bci ze wska\u017anikami wizualnymi', 'Automatyczny tryb Gaming'] },
    weather: { name: 'Pogoda', desc: 'Prognoza pogody dla Twojego miasta.', features: ['Aktualne warunki i prognoza na kilka dni', 'Wyszukiwanie miasta z autouzupe\u0142nianiem', 'Dane z Open-Meteo'] },
    calendar: { name: 'Kalendarz', desc: 'Zarz\u0105dzanie kalendarzem z obs\u0142ug\u0105 wielu kalendarzy.', features: ['Po\u0142\u0105czenie z Google Calendar przez OAuth2', 'Obs\u0142uga zewn\u0119trznych kalendarzy ICS', 'Wy\u015bwietlanie nadchodz\u0105cych wydarze\u0144', 'Szybkie tworzenie wydarze\u0144 Google'], setup: 'Po\u0142\u0105cz swoje konto Google lub dodaj adresy URL kalendarzy ICS w ustawieniach modu\u0142u.' },
    homeassistant: { name: 'Home Assistant', desc: 'Sterowanie inteligentnym domem.', features: ['Po\u0142\u0105czenie przez URL i d\u0142ugotrwa\u0142y token dost\u0119pu', 'Sterowanie encjami (\u015bwiat\u0142a, prze\u0142\u0105czniki, czujniki)', 'Aktualizacje w czasie rzeczywistym przez WebSocket'], setup: 'Wprowad\u017a URL swojej instancji Home Assistant i d\u0142ugotrwa\u0142y token dost\u0119pu (Profil \u2192 Tokeny).' },
    volume: { name: 'G\u0142o\u015bno\u015b\u0107 i Media', desc: 'Zaawansowane sterowanie d\u017awi\u0119kiem z wizualizatorem i kontrolami multimedi\u00f3w.', features: ['Sterowanie g\u0142o\u015bno\u015bci\u0105 systemu z paskami wizualnymi', 'Wyb\u00f3r urz\u0105dzenia wyj\u015bciowego audio', 'Kontrole multimedi\u00f3w (odtw\u00f3rz/pauza, nast\u0119pny, poprzedni)', 'Wizualizator audio w czasie rzeczywistym (64 paski)', 'Szybkie presety g\u0142o\u015bno\u015bci'] },
    tools: { name: 'Narz\u0119dzia', desc: 'Zestaw 5 narz\u0119dzi produktywno\u015bci.', features: ['Pomodoro \u2014 Konfigurowalny timer produktywno\u015bci', 'Timer \u2014 Konfigurowalny odlicznik', 'Stoper \u2014 Pomiar czasu z rejestracj\u0105 okr\u0105\u017ce\u0144', 'Notatki \u2014 Notatki z kolorowymi kategoriami', 'Zrzuty ekranu \u2014 Przechwytywanie i galeria'] },
    news: { name: 'Wiadomo\u015bci i Crypto', desc: 'Czytnik kana\u0142\u00f3w RSS z tickerem kryptowalut.', features: ['Konfigurowalne kana\u0142y RSS wg kategorii (gry, tech, okazje)', 'Domy\u015blne kana\u0142y dostosowane do Twojego j\u0119zyka', 'Automatyczne od\u015bwie\u017canie co 5 minut', 'Ticker crypto w czasie rzeczywistym (Bitcoin, Ethereum, Solana, BNB\u2026)'] },
    clipboard: { name: 'Schowek', desc: 'Automatyczna historia schowka.', features: ['Automatyczna historia (do 20 element\u00f3w)', 'Obs\u0142uga tekstu i obraz\u00f3w', 'Kopiowanie jednym klikni\u0119ciem'] },
    obs: { name: 'OBS Studio', desc: 'Natywne sterowanie OBS Studio przez WebSocket.', features: ['Zmiana scen jednym klikni\u0119ciem', 'Prze\u0142\u0105czanie widoczno\u015bci \u017ar\u00f3de\u0142', 'Sterowanie streamem i nagrywaniem', 'Statystyki na \u017cywo (FPS, CPU, utracone klatki, RAM)'], setup: 'W\u0142\u0105cz serwer WebSocket w OBS (Ustawienia \u2192 Serwer WebSocket) i po\u0142\u0105cz si\u0119 z ws://localhost:4455.' },
    streaming: { name: 'Us\u0142ugi streamingowe', desc: 'Dost\u0119p do Spotify, SoundCloud, YouTube Music i Twitch z panelu.', features: ['Wbudowany interfejs webowy dla ka\u017cdej us\u0142ugi', 'Trwa\u0142e sesje \u2014 odtwarzanie kontynuowane w tle', 'Ka\u017cda us\u0142uga zachowuje po\u0142\u0105czenie mi\u0119dzy sesjami'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Monitorowanie serwer\u00f3w przez instancj\u0119 Uptime Kuma.', features: ['Wbudowany interfejs webowy', 'Trwa\u0142a sesja'], setup: 'Wprowad\u017a URL swojej instancji Uptime Kuma.' },
    customWebviews: { name: 'Niestandardowe Webviews', desc: 'Dodaj dowoln\u0105 stron\u0119 jako modu\u0142.', features: ['Do 5 niestandardowych webviews', 'Trwa\u0142e sesje', 'Konfigurowalna ikona i nazwa', 'Konfiguracja w Ustawieniach'] },
    launcher: { name: 'Launcher', desc: 'Panel skr\u00f3t\u00f3w po prawej stronie ekranu.', features: ['Konfigurowalna siatka przycisk\u00f3w', 'Trzy typy: Aplikacja, System (zamknij, uruchom ponownie, u\u015bpij\u2026), Profil', 'Niestandardowe ikony (PNG, JPG, ICO, WebP)', 'Eksport/import konfiguracji JSON'] },
    settingsModule: { name: 'Ustawienia', desc: 'Pe\u0142na konfiguracja aplikacji.', features: ['Wyb\u00f3r j\u0119zyka (9 j\u0119zyk\u00f3w)', 'Predefiniowane i niestandardowe motywy kolor\u00f3w', 'Kolejno\u015b\u0107 i widoczno\u015b\u0107 modu\u0142\u00f3w', 'Wymiary paska bocznego i launchera', 'Automatyczne uruchamianie z Windows', 'Zarz\u0105dzanie licencj\u0105', 'Niestandardowe webviews'] },
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
    monitoring: { name: '\u30e2\u30cb\u30bf\u30ea\u30f3\u30b0', desc: '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30b7\u30b9\u30c6\u30e0\u76e3\u8996\u3002', features: ['CPU\u3001GPU\u3001RAM\u3001\u30c7\u30a3\u30b9\u30af\u3001\u30cd\u30c3\u30c8\u30ef\u30fc\u30af\u30a6\u30a3\u30b8\u30a7\u30c3\u30c8', '\u901a\u77e5\u4ed8\u304d\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u6e29\u5ea6\u30a2\u30e9\u30fc\u30c8', '\u5185\u8535\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8\u901f\u5ea6\u30c6\u30b9\u30c8', '\u30d3\u30b8\u30e5\u30a2\u30eb\u30b2\u30fc\u30b8\u306b\u3088\u308b\u30d1\u30d5\u30a9\u30fc\u30de\u30f3\u30b9\u30b5\u30de\u30ea\u30fc', '\u81ea\u52d5\u30b2\u30fc\u30df\u30f3\u30b0\u30e2\u30fc\u30c9'] },
    weather: { name: '\u5929\u6c17', desc: '\u304a\u4f4f\u307e\u3044\u306e\u90fd\u5e02\u306e\u5929\u6c17\u4e88\u5831\u3002', features: ['\u73fe\u5728\u306e\u6c17\u8c61\u6761\u4ef6\u3068\u6570\u65e5\u9593\u306e\u4e88\u5831', '\u30aa\u30fc\u30c8\u30b3\u30f3\u30d7\u30ea\u30fc\u30c8\u4ed8\u304d\u90fd\u5e02\u691c\u7d22', 'Open-Meteo\u306e\u30c7\u30fc\u30bf'] },
    calendar: { name: '\u30ab\u30ec\u30f3\u30c0\u30fc', desc: '\u30de\u30eb\u30c1\u30ab\u30ec\u30f3\u30c0\u30fc\u5bfe\u5fdc\u306e\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u7ba1\u7406\u3002', features: ['OAuth2\u306b\u3088\u308bGoogle\u30ab\u30ec\u30f3\u30c0\u30fc\u63a5\u7d9a', '\u5916\u90e8ICS\u30ab\u30ec\u30f3\u30c0\u30fc\u306e\u30b5\u30dd\u30fc\u30c8', '\u4eca\u5f8c\u306e\u30a4\u30d9\u30f3\u30c8\u8868\u793a', 'Google\u30a4\u30d9\u30f3\u30c8\u306e\u7d20\u65e9\u3044\u4f5c\u6210'], setup: 'Google\u30a2\u30ab\u30a6\u30f3\u30c8\u3092\u63a5\u7d9a\u3059\u308b\u304b\u3001\u30e2\u30b8\u30e5\u30fc\u30eb\u8a2d\u5b9a\u3067ICS\u30ab\u30ec\u30f3\u30c0\u30fc\u306eURL\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    homeassistant: { name: 'Home Assistant', desc: '\u30b9\u30de\u30fc\u30c8\u30db\u30fc\u30e0\u5236\u5fa1\u3002', features: ['URL\u3068\u9577\u671f\u30a2\u30af\u30bb\u30b9\u30c8\u30fc\u30af\u30f3\u306b\u3088\u308b\u63a5\u7d9a', '\u30a8\u30f3\u30c6\u30a3\u30c6\u30a3\u5236\u5fa1\uff08\u30e9\u30a4\u30c8\u3001\u30b9\u30a4\u30c3\u30c1\u3001\u30bb\u30f3\u30b5\u30fc\uff09', 'WebSocket\u306b\u3088\u308b\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u66f4\u65b0'], setup: 'Home Assistant\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306eURL\u3068\u9577\u671f\u30a2\u30af\u30bb\u30b9\u30c8\u30fc\u30af\u30f3\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb \u2192 \u30c8\u30fc\u30af\u30f3\uff09\u3002' },
    volume: { name: '\u30dc\u30ea\u30e5\u30fc\u30e0\uff06\u30e1\u30c7\u30a3\u30a2', desc: '\u30d3\u30b8\u30e5\u30a2\u30e9\u30a4\u30b6\u30fc\u3068\u30e1\u30c7\u30a3\u30a2\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb\u4ed8\u304d\u9ad8\u5ea6\u306a\u30aa\u30fc\u30c7\u30a3\u30aa\u5236\u5fa1\u3002', features: ['\u30d3\u30b8\u30e5\u30a2\u30eb\u30d0\u30fc\u4ed8\u304d\u30b7\u30b9\u30c6\u30e0\u97f3\u91cf\u5236\u5fa1', '\u30aa\u30fc\u30c7\u30a3\u30aa\u51fa\u529b\u30c7\u30d0\u30a4\u30b9\u306e\u9078\u629e', '\u30e1\u30c7\u30a3\u30a2\u30b3\u30f3\u30c8\u30ed\u30fc\u30eb\uff08\u518d\u751f/\u4e00\u6642\u505c\u6b62\u3001\u6b21\u3001\u524d\uff09', '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30aa\u30fc\u30c7\u30a3\u30aa\u30d3\u30b8\u30e5\u30a2\u30e9\u30a4\u30b6\u30fc\uff0864\u30d0\u30fc\uff09', '\u30af\u30a4\u30c3\u30af\u30dc\u30ea\u30e5\u30fc\u30e0\u30d7\u30ea\u30bb\u30c3\u30c8'] },
    tools: { name: '\u30c4\u30fc\u30eb', desc: '5\u3064\u306e\u751f\u7523\u6027\u30c4\u30fc\u30eb\u30b9\u30a4\u30fc\u30c8\u3002', features: ['\u30dd\u30e2\u30c9\u30fc\u30ed \u2014 \u8a2d\u5b9a\u53ef\u80fd\u306a\u751f\u7523\u6027\u30bf\u30a4\u30de\u30fc', '\u30bf\u30a4\u30de\u30fc \u2014 \u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u30ab\u30a6\u30f3\u30c8\u30c0\u30a6\u30f3', '\u30b9\u30c8\u30c3\u30d7\u30a6\u30a9\u30c3\u30c1 \u2014 \u30e9\u30c3\u30d7\u8a18\u9332\u4ed8\u304d\u8a08\u6642', '\u30e1\u30e2 \u2014 \u30ab\u30e9\u30fc\u30ab\u30c6\u30b4\u30ea\u4ed8\u304d\u30e1\u30e2\u5e33', '\u30b9\u30af\u30ea\u30fc\u30f3\u30b7\u30e7\u30c3\u30c8 \u2014 \u753b\u9762\u30ad\u30e3\u30d7\u30c1\u30e3\u3068\u30ae\u30e3\u30e9\u30ea\u30fc'] },
    news: { name: '\u30cb\u30e5\u30fc\u30b9\uff06\u6697\u53f7\u901a\u8ca8', desc: '\u6697\u53f7\u901a\u8ca8\u30c6\u30a3\u30c3\u30ab\u30fc\u4ed8\u304dRSS\u30d5\u30a3\u30fc\u30c9\u30ea\u30fc\u30c0\u30fc\u3002', features: ['\u30ab\u30c6\u30b4\u30ea\u5225\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fdRSS\u30d5\u30a3\u30fc\u30c9\uff08\u30b2\u30fc\u30e0\u3001\u30c6\u30c3\u30af\u3001\u30bb\u30fc\u30eb\uff09', '\u8a00\u8a9e\u306b\u5408\u308f\u305b\u305f\u30c7\u30d5\u30a9\u30eb\u30c8\u30d5\u30a3\u30fc\u30c9', '5\u5206\u3054\u3068\u306e\u81ea\u52d5\u66f4\u65b0', '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u6697\u53f7\u901a\u8ca8\u30c6\u30a3\u30c3\u30ab\u30fc\uff08Bitcoin\u3001Ethereum\u3001Solana\u3001BNB\u2026\uff09'] },
    clipboard: { name: '\u30af\u30ea\u30c3\u30d7\u30dc\u30fc\u30c9', desc: '\u81ea\u52d5\u30af\u30ea\u30c3\u30d7\u30dc\u30fc\u30c9\u5c65\u6b74\u3002', features: ['\u81ea\u52d5\u5c65\u6b74\uff08\u6700\u592720\u4ef6\uff09', '\u30c6\u30ad\u30b9\u30c8\u3068\u753b\u50cf\u306b\u5bfe\u5fdc', '\u30ef\u30f3\u30af\u30ea\u30c3\u30af\u3067\u30b3\u30d4\u30fc'] },
    obs: { name: 'OBS Studio', desc: 'WebSocket\u7d4c\u7531\u306e\u30cd\u30a4\u30c6\u30a3\u30d6OBS Studio\u5236\u5fa1\u3002', features: ['\u30ef\u30f3\u30af\u30ea\u30c3\u30af\u3067\u30b7\u30fc\u30f3\u5207\u308a\u66ff\u3048', '\u30bd\u30fc\u30b9\u306e\u8868\u793a/\u975e\u8868\u793a\u5207\u308a\u66ff\u3048', '\u914d\u4fe1\u30fb\u9332\u753b\u306e\u5236\u5fa1', '\u30e9\u30a4\u30d6\u7d71\u8a08\uff08FPS\u3001CPU\u3001\u30c9\u30ed\u30c3\u30d7\u30d5\u30ec\u30fc\u30e0\u3001RAM\uff09'], setup: 'OBS\u306eWebSocket\u30b5\u30fc\u30d0\u30fc\u3092\u6709\u52b9\u306b\u3057\uff08\u8a2d\u5b9a \u2192 WebSocket\u30b5\u30fc\u30d0\u30fc\uff09\u3001ws://localhost:4455\u3067\u63a5\u7d9a\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    streaming: { name: '\u30b9\u30c8\u30ea\u30fc\u30df\u30f3\u30b0\u30b5\u30fc\u30d3\u30b9', desc: 'Spotify\u3001SoundCloud\u3001YouTube Music\u3001Twitch\u306b\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u304b\u3089\u76f4\u63a5\u30a2\u30af\u30bb\u30b9\u3002', features: ['\u5404\u30b5\u30fc\u30d3\u30b9\u306e\u5185\u8535Web\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9', '\u6c38\u7d9a\u30bb\u30c3\u30b7\u30e7\u30f3 \u2014 \u30d0\u30c3\u30af\u30b0\u30e9\u30a6\u30f3\u30c9\u3067\u518d\u751f\u304c\u7d99\u7d9a', '\u5404\u30b5\u30fc\u30d3\u30b9\u304c\u30bb\u30c3\u30b7\u30e7\u30f3\u9593\u3067\u63a5\u7d9a\u3092\u7dad\u6301'] },
    uptimekuma: { name: 'Uptime Kuma', desc: 'Uptime Kuma\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306b\u3088\u308b\u30b5\u30fc\u30d0\u30fc\u76e3\u8996\u3002', features: ['\u5185\u8535Web\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9', '\u6c38\u7d9a\u30bb\u30c3\u30b7\u30e7\u30f3'], setup: 'Uptime Kuma\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u306eURL\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002' },
    customWebviews: { name: '\u30ab\u30b9\u30bf\u30e0Webview', desc: '\u4efb\u610f\u306eWeb\u30b5\u30a4\u30c8\u3092\u30e2\u30b8\u30e5\u30fc\u30eb\u3068\u3057\u3066\u8ffd\u52a0\u3002', features: ['\u6700\u59275\u3064\u306e\u30ab\u30b9\u30bf\u30e0Webview', '\u6c38\u7d9a\u30bb\u30c3\u30b7\u30e7\u30f3', '\u30a2\u30a4\u30b3\u30f3\u3068\u540d\u524d\u306e\u30ab\u30b9\u30bf\u30de\u30a4\u30ba', '\u8a2d\u5b9a\u3067\u69cb\u6210\u53ef\u80fd'] },
    launcher: { name: '\u30e9\u30f3\u30c1\u30e3\u30fc', desc: '\u753b\u9762\u53f3\u5074\u306e\u30b7\u30e7\u30fc\u30c8\u30ab\u30c3\u30c8\u30d1\u30cd\u30eb\u3002', features: ['\u30ab\u30b9\u30bf\u30de\u30a4\u30ba\u53ef\u80fd\u306a\u30dc\u30bf\u30f3\u30b0\u30ea\u30c3\u30c9', '3\u30bf\u30a4\u30d7: \u30a2\u30d7\u30ea\u3001\u30b7\u30b9\u30c6\u30e0\uff08\u30b7\u30e3\u30c3\u30c8\u30c0\u30a6\u30f3\u3001\u518d\u8d77\u52d5\u3001\u30b9\u30ea\u30fc\u30d7\u2026\uff09\u3001\u30d7\u30ed\u30d5\u30a1\u30a4\u30eb', '\u30ab\u30b9\u30bf\u30e0\u30a2\u30a4\u30b3\u30f3\uff08PNG\u3001JPG\u3001ICO\u3001WebP\uff09', 'JSON\u8a2d\u5b9a\u306e\u30a8\u30af\u30b9\u30dd\u30fc\u30c8/\u30a4\u30f3\u30dd\u30fc\u30c8'] },
    settingsModule: { name: '\u8a2d\u5b9a', desc: '\u30a2\u30d7\u30ea\u306e\u5168\u4f53\u8a2d\u5b9a\u3002', features: ['\u8a00\u8a9e\u9078\u629e\uff089\u8a00\u8a9e\u5bfe\u5fdc\uff09', '\u30d7\u30ea\u30bb\u30c3\u30c8\uff06\u30ab\u30b9\u30bf\u30e0\u30ab\u30e9\u30fc\u30c6\u30fc\u30de', '\u30e2\u30b8\u30e5\u30fc\u30eb\u306e\u9806\u5e8f\u3068\u8868\u793a/\u975e\u8868\u793a', '\u30b5\u30a4\u30c9\u30d0\u30fc\u3068\u30e9\u30f3\u30c1\u30e3\u30fc\u306e\u30b5\u30a4\u30ba', 'Windows\u8d77\u52d5\u6642\u306e\u81ea\u52d5\u8d77\u52d5', '\u30e9\u30a4\u30bb\u30f3\u30b9\u7ba1\u7406', '\u30ab\u30b9\u30bf\u30e0Webview'] },
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
