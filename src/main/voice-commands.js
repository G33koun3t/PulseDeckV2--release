/**
 * voice-commands.js — Parseur d'intentions vocales
 * Transforme le texte transcrit en intentions structurées.
 */

// Normalise le texte : minuscules, suppression diacritiques, nettoyage
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extraction de nombres (chiffres + mots par langue)
const NUMBER_WORDS = {
  fr: {
    zero: 0, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
    six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
    onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
    seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
    soixante: 60, 'soixante-dix': 70, 'quatre-vingt': 80, 'quatre-vingts': 80,
    'quatre-vingt-dix': 90, cent: 100,
  },
  en: {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80,
    ninety: 90, hundred: 100,
  },
  de: {
    null: 0, eins: 1, zwei: 2, drei: 3, vier: 4, funf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
    elf: 11, zwolf: 12, dreizehn: 13, vierzehn: 14, funfzehn: 15,
    zwanzig: 20, dreissig: 30, vierzig: 40, funfzig: 50, sechzig: 60,
    siebzig: 70, achtzig: 80, neunzig: 90, hundert: 100,
  },
  nl: {
    nul: 0, een: 1, twee: 2, drie: 3, vier: 4, vijf: 5,
    zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
    elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15,
    twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60,
    zeventig: 70, tachtig: 80, negentig: 90, honderd: 100,
  },
  es: {
    cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
    setenta: 70, ochenta: 80, noventa: 90, cien: 100,
  },
  pt: {
    zero: 0, um: 1, dois: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    onze: 11, doze: 12, treze: 13, catorze: 14, quinze: 15,
    vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
    setenta: 70, oitenta: 80, noventa: 90, cem: 100,
  },
  it: {
    zero: 0, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5,
    sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
    undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15,
    venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60,
    settanta: 70, ottanta: 80, novanta: 90, cento: 100,
  },
  pl: {
    zero: 0, jeden: 1, dwa: 2, trzy: 3, cztery: 4, piec: 5,
    szesc: 6, siedem: 7, osiem: 8, dziewiec: 9, dziesiec: 10,
    jedenascie: 11, dwanascie: 12, trzynascie: 13, czternascie: 14, pietnascie: 15,
    dwadziescia: 20, trzydziesci: 30, czterdziesci: 40, piecdziesiat: 50,
    szescdziesiat: 60, siedemdziesiat: 70, osiemdziesiat: 80, dziewiecdziesiat: 90, sto: 100,
  },
  ja: {
    zero: 0, ichi: 1, ni: 2, san: 3, yon: 4, go: 5,
    roku: 6, nana: 7, hachi: 8, kyu: 9, juu: 10,
    nijuu: 20, sanjuu: 30, yonjuu: 40, gojuu: 50, rokujuu: 60,
    nanajuu: 70, hachijuu: 80, kyuujuu: 90, hyaku: 100,
  },
};

// Articles par langue (pour extraction d'entité)
const ARTICLES = {
  fr: /^(le |la |les |l |du |de la |de l |des |d )/g,
  en: /^(the |a |an )/g,
  de: /^(der |die |das |den |dem |des |ein |eine |einen |einem |eines )/g,
  nl: /^(de |het |een )/g,
  es: /^(el |la |los |las |un |una |unos |unas |del |de la |de los |de las )/g,
  pt: /^(o |a |os |as |um |uma |uns |umas |do |da |dos |das )/g,
  it: /^(il |lo |la |i |gli |le |un |uno |una |del |dello |della |dei |degli |delle )/g,
  pl: /^()/, // Polish has no articles
  ja: /^(no )/g, // の particle (romanized)
};

// Compat: ancien nom pour ne pas casser extractNumber/extractEntityAlias
const FRENCH_NUMBERS = NUMBER_WORDS.fr;

function extractNumber(text, lang = 'fr') {
  // Chiffres numériques d'abord
  const digitMatch = text.match(/(\d+)\s*%?/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  // Mots-nombres de la langue courante + fallback FR/EN
  const normalized = normalize(text);
  const langs = [lang, 'fr', 'en'];
  const seen = new Set();
  for (const l of langs) {
    if (seen.has(l)) continue;
    seen.add(l);
    const words = NUMBER_WORDS[l];
    if (!words) continue;
    for (const [word, value] of Object.entries(words)) {
      if (normalized.includes(word)) return value;
    }
  }
  return null;
}

// Extraction d'entité HA après le verbe (retire articles)
function extractEntityAlias(text, matchedPattern, lang = 'fr') {
  const normalized = normalize(text);
  const patternNorm = normalize(matchedPattern);
  const idx = normalized.indexOf(patternNorm);
  if (idx === -1) return null;

  let afterVerb = normalized.substring(idx + patternNorm.length).trim();
  // Retirer articles de la langue courante
  const articleRegex = ARTICLES[lang] || ARTICLES.en;
  afterVerb = afterVerb.replace(articleRegex, '').trim();
  // Retirer nombre/pourcentage en fin
  const entityPart = afterVerb.replace(/\s*\d+\s*%?\s*$/, '').trim();
  // Retirer mots-nombres en fin (langue courante)
  const numberWords = NUMBER_WORDS[lang] || NUMBER_WORDS.en;
  for (const word of Object.keys(numberWords)) {
    const re = new RegExp(`\\s+${word}\\s*%?\\s*$`);
    if (re.test(entityPart)) {
      return entityPart.replace(re, '').trim() || null;
    }
  }
  return entityPart || null;
}

// Score de confiance simple
function calculateConfidence(normalized, pattern) {
  if (normalized === pattern) return 1;
  const ratio = pattern.length / normalized.length;
  return Math.min(ratio * 1.2, 0.95);
}

// Patterns par langue
const PATTERNS = {
  fr: {
    system: [
      { patterns: ['eteins le pc', 'eteindre le pc', 'eteindre l ordinateur', 'arrete le pc', 'extinction'], action: 'shutdown' },
      { patterns: ['redemarre', 'redemarrer', 'redemarre le pc', 'redemarrer le pc'], action: 'restart' },
      { patterns: ['veille', 'mise en veille', 'mode veille'], action: 'sleep' },
      { patterns: ['verrouille', 'verrouiller', 'verrouille le pc'], action: 'lock' },
    ],
    media: [
      { patterns: ['lecture', 'play', 'jouer', 'reprendre', 'reprends'], action: 'play-pause' },
      { patterns: ['pause', 'met en pause', 'mets en pause'], action: 'play-pause' },
      { patterns: ['suivant', 'prochain', 'piste suivante', 'next', 'chanson suivante'], action: 'next' },
      { patterns: ['precedent', 'piste precedente', 'previous', 'chanson precedente'], action: 'prev' },
      { patterns: ['stop', 'arrete la musique', 'stopper'], action: 'stop' },
    ],
    volume: [
      { patterns: ['volume a', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['monte le son', 'plus fort', 'augmente le volume', 'augmente le son'], action: 'up', value: 10 },
      { patterns: ['baisse le son', 'moins fort', 'diminue le volume', 'baisse le volume'], action: 'down', value: 10 },
      { patterns: ['muet', 'mute', 'coupe le son', 'silence'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['lumiere', 'luminosite'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['allume'], action: 'turn_on', extractEntity: true },
      { patterns: ['eteins'], action: 'turn_off', extractEntity: true },
      { patterns: ['ouvre'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['ferme'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['arrete', 'stop'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['lance le stream', 'demarre le stream', 'start stream', 'commence le stream'], action: 'start-stream' },
      { patterns: ['arrete le stream', 'stop stream', 'coupe le stream', 'fin du stream'], action: 'stop-stream' },
      { patterns: ['lance l enregistrement', 'demarre l enregistrement', 'start recording', 'commence l enregistrement'], action: 'start-recording' },
      { patterns: ['arrete l enregistrement', 'stop enregistrement', 'stop recording', 'fin de l enregistrement'], action: 'stop-recording' },
    ],
  },
  en: {
    system: [
      { patterns: ['shut down', 'shutdown', 'turn off the pc', 'turn off computer', 'power off'], action: 'shutdown' },
      { patterns: ['restart', 'reboot', 'restart the pc'], action: 'restart' },
      { patterns: ['sleep', 'go to sleep', 'sleep mode'], action: 'sleep' },
      { patterns: ['lock', 'lock the pc', 'lock computer', 'lock screen'], action: 'lock' },
    ],
    media: [
      { patterns: ['play', 'resume', 'start playing'], action: 'play-pause' },
      { patterns: ['pause', 'stop playing'], action: 'play-pause' },
      { patterns: ['next', 'next song', 'next track', 'skip'], action: 'next' },
      { patterns: ['previous', 'previous song', 'previous track', 'go back'], action: 'prev' },
      { patterns: ['stop', 'stop music', 'stop the music'], action: 'stop' },
    ],
    volume: [
      { patterns: ['volume to', 'set volume', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['louder', 'volume up', 'turn it up', 'raise volume'], action: 'up', value: 10 },
      { patterns: ['quieter', 'volume down', 'turn it down', 'lower volume'], action: 'down', value: 10 },
      { patterns: ['mute', 'unmute', 'toggle mute', 'silence'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['brightness', 'light'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['turn on', 'switch on'], action: 'turn_on', extractEntity: true },
      { patterns: ['turn off', 'switch off'], action: 'turn_off', extractEntity: true },
      { patterns: ['open'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['close'], action: 'close_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['start stream', 'start streaming', 'go live'], action: 'start-stream' },
      { patterns: ['stop stream', 'stop streaming', 'end stream'], action: 'stop-stream' },
      { patterns: ['start recording', 'begin recording'], action: 'start-recording' },
      { patterns: ['stop recording', 'end recording'], action: 'stop-recording' },
    ],
  },
  de: {
    system: [
      { patterns: ['pc ausschalten', 'computer ausschalten', 'herunterfahren', 'abschalten'], action: 'shutdown' },
      { patterns: ['neustart', 'neu starten', 'pc neu starten', 'neustarten'], action: 'restart' },
      { patterns: ['ruhezustand', 'schlafmodus', 'in den ruhezustand'], action: 'sleep' },
      { patterns: ['sperren', 'pc sperren', 'bildschirm sperren', 'computer sperren'], action: 'lock' },
    ],
    media: [
      { patterns: ['abspielen', 'play', 'wiedergabe', 'fortsetzen'], action: 'play-pause' },
      { patterns: ['pause', 'anhalten', 'pausieren'], action: 'play-pause' },
      { patterns: ['nachster', 'nachstes lied', 'weiter', 'uberspringen'], action: 'next' },
      { patterns: ['vorheriger', 'vorheriges lied', 'zuruck'], action: 'prev' },
      { patterns: ['stop', 'stopp', 'musik stoppen', 'musik aus'], action: 'stop' },
    ],
    volume: [
      { patterns: ['lautstarke auf', 'lautstarke', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['lauter', 'lautstarke erhohen', 'mehr lautstarke'], action: 'up', value: 10 },
      { patterns: ['leiser', 'lautstarke verringern', 'weniger lautstarke'], action: 'down', value: 10 },
      { patterns: ['stumm', 'stummschalten', 'ton aus', 'mute'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['helligkeit', 'licht'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['einschalten', 'anschalten', 'anmachen', 'mach an'], action: 'turn_on', extractEntity: true },
      { patterns: ['ausschalten', 'ausmachen', 'mach aus'], action: 'turn_off', extractEntity: true },
      { patterns: ['offne', 'offnen', 'aufmachen'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['schliessen', 'schliesse', 'zumachen'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['stoppe', 'anhalten'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['stream starten', 'starte den stream', 'live gehen'], action: 'start-stream' },
      { patterns: ['stream stoppen', 'stoppe den stream', 'stream beenden'], action: 'stop-stream' },
      { patterns: ['aufnahme starten', 'starte die aufnahme', 'aufzeichnung starten'], action: 'start-recording' },
      { patterns: ['aufnahme stoppen', 'stoppe die aufnahme', 'aufzeichnung beenden'], action: 'stop-recording' },
    ],
  },
  nl: {
    system: [
      { patterns: ['pc afsluiten', 'computer afsluiten', 'afsluiten', 'uitschakelen'], action: 'shutdown' },
      { patterns: ['herstarten', 'opnieuw opstarten', 'pc herstarten'], action: 'restart' },
      { patterns: ['slaapstand', 'slaapmodus', 'in slaapstand'], action: 'sleep' },
      { patterns: ['vergrendelen', 'pc vergrendelen', 'scherm vergrendelen'], action: 'lock' },
    ],
    media: [
      { patterns: ['afspelen', 'play', 'speel af', 'hervatten'], action: 'play-pause' },
      { patterns: ['pauze', 'pauzeren', 'stop afspelen'], action: 'play-pause' },
      { patterns: ['volgende', 'volgend nummer', 'overslaan'], action: 'next' },
      { patterns: ['vorige', 'vorig nummer', 'ga terug'], action: 'prev' },
      { patterns: ['stop', 'stop muziek', 'muziek uit'], action: 'stop' },
    ],
    volume: [
      { patterns: ['volume naar', 'volume op', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['harder', 'volume omhoog', 'luider'], action: 'up', value: 10 },
      { patterns: ['zachter', 'volume omlaag', 'stiller'], action: 'down', value: 10 },
      { patterns: ['dempen', 'mute', 'geluid uit', 'stil'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['helderheid', 'licht'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['zet aan', 'aanzetten', 'schakel in'], action: 'turn_on', extractEntity: true },
      { patterns: ['zet uit', 'uitzetten', 'schakel uit'], action: 'turn_off', extractEntity: true },
      { patterns: ['open', 'openen', 'doe open'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['sluit', 'sluiten', 'doe dicht'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['stop'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['start stream', 'begin met streamen', 'ga live'], action: 'start-stream' },
      { patterns: ['stop stream', 'stop met streamen', 'einde stream'], action: 'stop-stream' },
      { patterns: ['start opname', 'begin met opnemen'], action: 'start-recording' },
      { patterns: ['stop opname', 'stop met opnemen'], action: 'stop-recording' },
    ],
  },
  es: {
    system: [
      { patterns: ['apagar el pc', 'apagar el ordenador', 'apagar', 'apagar computadora'], action: 'shutdown' },
      { patterns: ['reiniciar', 'reiniciar el pc', 'reiniciar ordenador'], action: 'restart' },
      { patterns: ['suspender', 'modo suspension', 'hibernar'], action: 'sleep' },
      { patterns: ['bloquear', 'bloquear el pc', 'bloquear pantalla'], action: 'lock' },
    ],
    media: [
      { patterns: ['reproducir', 'play', 'reanudar', 'reproduccion'], action: 'play-pause' },
      { patterns: ['pausa', 'pausar', 'detener reproduccion'], action: 'play-pause' },
      { patterns: ['siguiente', 'siguiente cancion', 'saltar'], action: 'next' },
      { patterns: ['anterior', 'cancion anterior', 'atras'], action: 'prev' },
      { patterns: ['stop', 'detener', 'parar musica', 'detener musica'], action: 'stop' },
    ],
    volume: [
      { patterns: ['volumen a', 'volumen al', 'volumen'], action: 'set', extractNumber: true },
      { patterns: ['mas fuerte', 'subir volumen', 'mas alto', 'sube el volumen'], action: 'up', value: 10 },
      { patterns: ['mas bajo', 'bajar volumen', 'menos volumen', 'baja el volumen'], action: 'down', value: 10 },
      { patterns: ['silencio', 'mute', 'silenciar', 'quitar sonido'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['brillo', 'luminosidad', 'luz'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['enciende', 'encender', 'activa'], action: 'turn_on', extractEntity: true },
      { patterns: ['apaga', 'apagar', 'desactiva'], action: 'turn_off', extractEntity: true },
      { patterns: ['abre', 'abrir'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['cierra', 'cerrar'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['para', 'detener'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['iniciar stream', 'empezar stream', 'comenzar stream', 'ir en vivo'], action: 'start-stream' },
      { patterns: ['parar stream', 'detener stream', 'terminar stream'], action: 'stop-stream' },
      { patterns: ['iniciar grabacion', 'empezar a grabar', 'comenzar grabacion'], action: 'start-recording' },
      { patterns: ['parar grabacion', 'detener grabacion', 'terminar grabacion'], action: 'stop-recording' },
    ],
  },
  pt: {
    system: [
      { patterns: ['desligar o pc', 'desligar computador', 'desligar', 'encerrar'], action: 'shutdown' },
      { patterns: ['reiniciar', 'reiniciar o pc', 'reiniciar computador'], action: 'restart' },
      { patterns: ['suspender', 'modo suspensao', 'hibernar'], action: 'sleep' },
      { patterns: ['bloquear', 'bloquear o pc', 'bloquear ecra', 'bloquear tela'], action: 'lock' },
    ],
    media: [
      { patterns: ['reproduzir', 'play', 'tocar', 'retomar'], action: 'play-pause' },
      { patterns: ['pausa', 'pausar', 'parar reproducao'], action: 'play-pause' },
      { patterns: ['proxima', 'proxima musica', 'avancar'], action: 'next' },
      { patterns: ['anterior', 'musica anterior', 'voltar'], action: 'prev' },
      { patterns: ['stop', 'parar', 'parar musica'], action: 'stop' },
    ],
    volume: [
      { patterns: ['volume para', 'volume em', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['mais alto', 'aumentar volume', 'mais forte'], action: 'up', value: 10 },
      { patterns: ['mais baixo', 'diminuir volume', 'abaixar volume'], action: 'down', value: 10 },
      { patterns: ['silencio', 'mudo', 'silenciar', 'mute'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['brilho', 'luminosidade', 'luz'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['ligar', 'acender', 'liga'], action: 'turn_on', extractEntity: true },
      { patterns: ['desligar', 'apagar', 'desliga'], action: 'turn_off', extractEntity: true },
      { patterns: ['abrir', 'abre'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['fechar', 'fecha'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['parar'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['iniciar stream', 'comecar stream', 'ir ao vivo'], action: 'start-stream' },
      { patterns: ['parar stream', 'terminar stream', 'encerrar stream'], action: 'stop-stream' },
      { patterns: ['iniciar gravacao', 'comecar a gravar'], action: 'start-recording' },
      { patterns: ['parar gravacao', 'terminar gravacao'], action: 'stop-recording' },
    ],
  },
  it: {
    system: [
      { patterns: ['spegni il pc', 'spegnere il computer', 'spegni', 'arresta'], action: 'shutdown' },
      { patterns: ['riavvia', 'riavviare', 'riavvia il pc'], action: 'restart' },
      { patterns: ['sospendi', 'modalita sospensione', 'ibernazione'], action: 'sleep' },
      { patterns: ['blocca', 'blocca il pc', 'blocca lo schermo'], action: 'lock' },
    ],
    media: [
      { patterns: ['riproduci', 'play', 'avvia', 'riprendi'], action: 'play-pause' },
      { patterns: ['pausa', 'metti in pausa', 'ferma riproduzione'], action: 'play-pause' },
      { patterns: ['successivo', 'prossimo', 'prossima canzone', 'avanti'], action: 'next' },
      { patterns: ['precedente', 'canzone precedente', 'indietro'], action: 'prev' },
      { patterns: ['stop', 'ferma', 'ferma la musica', 'basta'], action: 'stop' },
    ],
    volume: [
      { patterns: ['volume a', 'volume al', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['piu forte', 'alza il volume', 'piu alto', 'aumenta volume'], action: 'up', value: 10 },
      { patterns: ['piu basso', 'abbassa il volume', 'meno volume', 'diminuisci volume'], action: 'down', value: 10 },
      { patterns: ['muto', 'mute', 'silenzia', 'togli audio'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['luminosita', 'luce'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['accendi', 'accendere', 'attiva'], action: 'turn_on', extractEntity: true },
      { patterns: ['spegni', 'spegnere', 'disattiva'], action: 'turn_off', extractEntity: true },
      { patterns: ['apri', 'aprire'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['chiudi', 'chiudere'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['ferma'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['avvia lo stream', 'inizia lo stream', 'vai in diretta'], action: 'start-stream' },
      { patterns: ['ferma lo stream', 'interrompi lo stream', 'fine stream'], action: 'stop-stream' },
      { patterns: ['avvia la registrazione', 'inizia a registrare'], action: 'start-recording' },
      { patterns: ['ferma la registrazione', 'interrompi la registrazione'], action: 'stop-recording' },
    ],
  },
  pl: {
    system: [
      { patterns: ['wylacz komputer', 'wylacz pc', 'zamknij komputer', 'wylacz'], action: 'shutdown' },
      { patterns: ['uruchom ponownie', 'restartuj', 'restart', 'restartuj komputer'], action: 'restart' },
      { patterns: ['uspi', 'tryb uspienia', 'uspij komputer'], action: 'sleep' },
      { patterns: ['zablokuj', 'zablokuj komputer', 'zablokuj ekran'], action: 'lock' },
    ],
    media: [
      { patterns: ['odtwarzaj', 'play', 'graj', 'wznow'], action: 'play-pause' },
      { patterns: ['pauza', 'wstrzymaj', 'zatrzymaj odtwarzanie'], action: 'play-pause' },
      { patterns: ['nastepny', 'nastepna piosenka', 'dalej', 'pomin'], action: 'next' },
      { patterns: ['poprzedni', 'poprzednia piosenka', 'cofnij'], action: 'prev' },
      { patterns: ['stop', 'zatrzymaj', 'zatrzymaj muzyke'], action: 'stop' },
    ],
    volume: [
      { patterns: ['glosnosc na', 'glosnosc', 'volume'], action: 'set', extractNumber: true },
      { patterns: ['glosniej', 'podglos', 'zwieksz glosnosc'], action: 'up', value: 10 },
      { patterns: ['ciszej', 'scisz', 'zmniejsz glosnosc'], action: 'down', value: 10 },
      { patterns: ['wycisz', 'mute', 'cisza'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['jasnosc', 'swiatlo'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['wlacz', 'zapal', 'uruchom'], action: 'turn_on', extractEntity: true },
      { patterns: ['wylacz', 'zgas', 'wygas'], action: 'turn_off', extractEntity: true },
      { patterns: ['otworz', 'otworzyc'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['zamknij', 'zamknac'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['zatrzymaj'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['rozpocznij stream', 'zacznij stream', 'uruchom stream'], action: 'start-stream' },
      { patterns: ['zatrzymaj stream', 'zakoncz stream', 'przerwij stream'], action: 'stop-stream' },
      { patterns: ['rozpocznij nagrywanie', 'zacznij nagrywac'], action: 'start-recording' },
      { patterns: ['zatrzymaj nagrywanie', 'zakoncz nagrywanie'], action: 'stop-recording' },
    ],
  },
  ja: {
    system: [
      { patterns: ['shattodaun', 'pasokon wo kesu', 'dengen wo kiru', 'shuuryou'], action: 'shutdown' },
      { patterns: ['saikidou', 'ribuuto', 'saistato'], action: 'restart' },
      { patterns: ['suripu', 'suripumodo', 'kyuushi'], action: 'sleep' },
      { patterns: ['rokku', 'gamen wo rokku', 'rokku suru'], action: 'lock' },
    ],
    media: [
      { patterns: ['saisei', 'play', 'purei', 'saikai'], action: 'play-pause' },
      { patterns: ['ichijiteishi', 'poozu', 'teishi'], action: 'play-pause' },
      { patterns: ['tsugi', 'tsugi no kyoku', 'sukippu'], action: 'next' },
      { patterns: ['mae', 'mae no kyoku', 'modoru'], action: 'prev' },
      { patterns: ['sutoppu', 'teishi', 'ongaku wo tomeru'], action: 'stop' },
    ],
    volume: [
      { patterns: ['boryuumu', 'onryou'], action: 'set', extractNumber: true },
      { patterns: ['ookiku', 'boryuumu appu', 'motto ookiku'], action: 'up', value: 10 },
      { patterns: ['chiisaku', 'boryuumu daun', 'motto chiisaku'], action: 'down', value: 10 },
      { patterns: ['myuuto', 'muon', 'oto wo kesu'], action: 'mute' },
    ],
    homeassistant: [
      { patterns: ['akarusa', 'akari', 'raito'], action: 'brightness', extractEntity: true, extractNumber: true, domain: 'light' },
      { patterns: ['tsukete', 'tsukeru', 'on ni suru'], action: 'turn_on', extractEntity: true },
      { patterns: ['keshite', 'kesu', 'off ni suru'], action: 'turn_off', extractEntity: true },
      { patterns: ['akete', 'hiraku'], action: 'open_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['shimete', 'shimeru', 'tojiru'], action: 'close_cover', extractEntity: true, domain: 'cover' },
      { patterns: ['tomete', 'tomeru'], action: 'stop_cover', extractEntity: true, domain: 'cover' },
    ],
    obs: [
      { patterns: ['sutoriimu kaishi', 'haishin kaishi', 'raibu kaishi'], action: 'start-stream' },
      { patterns: ['sutoriimu teishi', 'haishin teishi', 'raibu shuuryou'], action: 'stop-stream' },
      { patterns: ['rokuga kaishi', 'kiroku kaishi'], action: 'start-recording' },
      { patterns: ['rokuga teishi', 'kiroku teishi'], action: 'stop-recording' },
    ],
  },
};

// Pour les langues sans patterns dédiés, utiliser l'anglais comme fallback
function getPatterns(lang) {
  return PATTERNS[lang] || PATTERNS.en;
}

/**
 * Parse une commande vocale en intention structurée.
 * @param {string} text - Texte transcrit
 * @param {string} lang - Code langue (fr, en, de, ...)
 * @returns {{ category, action, value, entity, domain, service, raw, confidence }}
 */
function parseCommand(text, lang = 'fr') {
  const patterns = getPatterns(lang);
  const normalized = normalize(text);

  for (const [category, rules] of Object.entries(patterns)) {
    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        const patternNorm = normalize(pattern);
        if (normalized.includes(patternNorm)) {
          const intent = {
            category,
            action: rule.action,
            value: null,
            entity: null,
            domain: rule.domain || null,
            service: rule.action,
            raw: text,
            confidence: calculateConfidence(normalized, patternNorm),
          };

          if (rule.extractNumber) {
            intent.value = extractNumber(text, lang);
          }
          if (rule.value !== undefined && intent.value === null) {
            intent.value = rule.value;
          }
          if (rule.extractEntity) {
            intent.entity = extractEntityAlias(text, pattern, lang);
          }

          // Déduire le domaine HA si non spécifié
          if (category === 'homeassistant' && !intent.domain) {
            if (intent.action === 'turn_on' || intent.action === 'turn_off') {
              intent.domain = 'light'; // Par défaut, on suppose lumière
            }
          }

          return intent;
        }
      }
    }
  }

  return { category: 'unknown', action: null, value: null, entity: null, domain: null, service: null, raw: text, confidence: 0 };
}

module.exports = { parseCommand, normalize, extractNumber };
