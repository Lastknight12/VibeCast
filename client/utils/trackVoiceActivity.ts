import { watch } from "vue";
import { useStreamVolume } from "~/composables/useStreamVolume";

export function trackVoiceActivity(
  stream: MediaStream,
  callback?: (isSpeaking: boolean) => void
) {
  const { speaking } = useStreamVolume(stream);

  watch(speaking, (isSpeaking) => {
    callback?.(isSpeaking);
  });
}
