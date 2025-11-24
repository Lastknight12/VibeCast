const isSpeaking = ref(false);
const isMuted = ref(true);
const videoStream = ref<MediaStream | null>(null);

export function useMedia(mediaConn: mediasoupConn) {
  async function checkMic() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices.some((device) => device.kind === "audioinput");
  }

  async function startMic() {
    const stream = await mediaConn.getAudioStream();
    if (!stream) return;

    trackVoiceActivity(stream, (currSpeaking) => {
      isSpeaking.value = currSpeaking && !isMuted.value;
    });

    await mediaConn.produce("audio");
  }

  async function toggleMicState() {
    if (!mediaConn.audioStream) await startMic();

    isMuted.value = mediaConn.toggleMic();
  }

  async function toggleScreenShare() {
    if (!videoStream.value) {
      const stream = await mediaConn.getMediaStream();
      const videoTracks = stream.getVideoTracks();

      videoTracks.forEach((track) => {
        track.addEventListener("ended", async () => {
          console.log("called in hook", videoStream.value);
          videoStream.value = null;
          await mediaConn.stopStream();
        });
      });

      videoStream.value = new MediaStream(videoTracks);
      await mediaConn.produce("video");
      if (stream.getAudioTracks().length > 0) {
        await mediaConn.produce("video_audio");
      }
    } else {
      mediaConn.stopStream();
      videoStream.value = null;
    }
  }

  onUnmounted(() => {
    isSpeaking.value = false;
    isMuted.value = true;
    videoStream.value = null;
  });

  return {
    isSpeaking,
    isMuted,
    videoStream,
    startMic,
    toggleMicState,
    toggleScreenShare,
    checkMic,
  };
}
