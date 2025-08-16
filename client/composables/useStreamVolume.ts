import { ref, onUnmounted } from "vue";

interface StreamVolumeOptions {
  threshold?: number;
  interval?: number;
  smoothing?: number;
  fftSize?: number;
}

export function useStreamVolume(
  stream: MediaStream,
  options: StreamVolumeOptions = {}
) {
  const speaking = ref(false);

  const threshold = options.threshold ?? -50;
  const intervalTime = options.interval ?? 100;
  const fftSize = options.fftSize ?? 512;
  const smoothing = options.smoothing ?? 0.1;

  const audioContext = new AudioContext();

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = smoothing;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const fftBins = new Float32Array(analyser.frequencyBinCount);

  const checkVolume = () => {
    analyser.getFloatFrequencyData(fftBins);

    let max = -Infinity;
    for (let i = 0; i < fftBins.length; i++) {
      if (fftBins[i]! > max && fftBins[i]! < 0) {
        max = fftBins[i]!;
      }
    }

    const current = max === -Infinity ? -100 : max;

    speaking.value = current > threshold;
  };

  const interval = setInterval(checkVolume, intervalTime);

  onUnmounted(() => {
    clearInterval(interval);
    source.disconnect();
    analyser.disconnect();
    if (audioContext.state !== "closed") {
      audioContext.close();
    }
  });

  return {
    speaking,
    trackVoiceActivity,
  };
}
