/**
 * vosk-koffi.js — Wrapper Vosk utilisant koffi au lieu de ffi-napi
 * koffi est compatible avec toutes les versions Node.js + Electron (N-API stable)
 */

'use strict';

const os = require('os');
const path = require('path');
const koffi = require('koffi');

// Trouver le chemin vers les DLLs vosk
const voskDir = path.dirname(require.resolve('vosk/package.json'));

let soname;
if (os.platform() === 'win32') {
  // Ajouter le dossier DLL au PATH pour les dépendances (libgcc, libstdc++, etc.)
  const dllDir = path.join(voskDir, 'lib', 'win-x86_64');
  process.env.Path = process.env.Path + path.delimiter + dllDir;
  soname = path.join(dllDir, 'libvosk.dll');
} else if (os.platform() === 'darwin') {
  soname = path.join(voskDir, 'lib', 'osx-universal', 'libvosk.dylib');
} else {
  soname = path.join(voskDir, 'lib', 'linux-x86_64', 'libvosk.so');
}

// Charger la librairie native
const lib = koffi.load(soname);

// Définir les types opaques (pointeurs)
const VoskModel = koffi.opaque('VoskModel');
const VoskRecognizer = koffi.opaque('VoskRecognizer');

// Déclarer les fonctions de la librairie
const vosk_set_log_level = lib.func('void vosk_set_log_level(int level)');
const vosk_model_new = lib.func('VoskModel* vosk_model_new(const char* model_path)');
const vosk_model_free = lib.func('void vosk_model_free(VoskModel* model)');
const vosk_recognizer_new = lib.func('VoskRecognizer* vosk_recognizer_new(VoskModel* model, float sample_rate)');
const vosk_recognizer_free = lib.func('void vosk_recognizer_free(VoskRecognizer* recognizer)');
const vosk_recognizer_set_words = lib.func('void vosk_recognizer_set_words(VoskRecognizer* recognizer, int words)');
const vosk_recognizer_accept_waveform = lib.func('int vosk_recognizer_accept_waveform(VoskRecognizer* recognizer, const uint8_t* data, int length)');
const vosk_recognizer_result = lib.func('const char* vosk_recognizer_result(VoskRecognizer* recognizer)');
const vosk_recognizer_partial_result = lib.func('const char* vosk_recognizer_partial_result(VoskRecognizer* recognizer)');
const vosk_recognizer_final_result = lib.func('const char* vosk_recognizer_final_result(VoskRecognizer* recognizer)');
const vosk_recognizer_reset = lib.func('void vosk_recognizer_reset(VoskRecognizer* recognizer)');

// ========== API compatible avec le package vosk ==========

function setLogLevel(level) {
  vosk_set_log_level(level);
}

class Model {
  constructor(modelPath) {
    this.handle = vosk_model_new(modelPath);
    if (!this.handle) {
      throw new Error('Failed to create Vosk model from: ' + modelPath);
    }
  }

  free() {
    if (this.handle) {
      vosk_model_free(this.handle);
      this.handle = null;
    }
  }
}

class Recognizer {
  constructor({ model, sampleRate }) {
    this.handle = vosk_recognizer_new(model.handle, sampleRate);
    if (!this.handle) {
      throw new Error('Failed to create Vosk recognizer');
    }
  }

  setWords(words) {
    vosk_recognizer_set_words(this.handle, words ? 1 : 0);
  }

  acceptWaveform(data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return !!vosk_recognizer_accept_waveform(this.handle, buf, buf.length);
  }

  result() {
    const json = vosk_recognizer_result(this.handle);
    return JSON.parse(json);
  }

  partialResult() {
    const json = vosk_recognizer_partial_result(this.handle);
    return JSON.parse(json);
  }

  finalResult() {
    const json = vosk_recognizer_final_result(this.handle);
    return JSON.parse(json);
  }

  reset() {
    vosk_recognizer_reset(this.handle);
  }

  free() {
    if (this.handle) {
      vosk_recognizer_free(this.handle);
      this.handle = null;
    }
  }
}

module.exports = { setLogLevel, Model, Recognizer };
