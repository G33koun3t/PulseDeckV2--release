// Formater le temps en HH:MM:SS ou MM:SS
export const formatTime = (totalSeconds, showHours = false) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (showHours || hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Formater le temps avec millisecondes pour le chronomètre
export const formatTimeMs = (totalMs) => {
  const totalSeconds = Math.floor(totalMs / 1000);
  const ms = Math.floor((totalMs % 1000) / 10);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

// Jouer un son d'alarme (bips oscillateur)
export const playAlarm = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();

    let count = 0;
    const beepInterval = setInterval(() => {
      gainNode.gain.value = gainNode.gain.value > 0 ? 0 : 0.3;
      count++;
      if (count >= 10) {
        clearInterval(beepInterval);
        oscillator.stop();
      }
    }, 200);
  } catch (e) {
    console.error('Audio error:', e);
  }
};
