import type { Transport } from "mediasoup-client/types";
import { user } from "~/lib/randomUser";

const isSpeaking = ref(false);
const isMuted = ref(true);
const videoStream = ref<MediaStream | null>(null);

const reportsMap = new Map();

export async function collectVideoMetric(transport: Transport, roomId: string) {
  try {
    const stats = await transport.getStats();
    let payload = "";

    stats.forEach((report: any) => {
      if (
        report.type === "candidate-pair" &&
        report.state === "succeeded" &&
        report.nominated
      ) {
        const labels = `clientId="${user.id}"`;
        const metrics: { [key: string]: number } = {
          availableOutgoingBitrate: report.availableOutgoingBitrate ?? 0,
        };
        for (const [metricName, value] of Object.entries(metrics)) {
          payload += `clientmetric_video_${metricName}{${labels}} ${value}\n`;
        }
      }

      if (
        report.type === "outbound-rtp" &&
        report.kind === "video" &&
        report.rid
      ) {
        const labels = `clientId="${user.id}",rid="${report.rid}",roomId="${roomId}"`;
        const metrics: { [key: string]: number } = {
          packetsSent: report.packetsSent ?? 0,
          bytesSent: report.bytesSent ?? 0,
          framesPerSecond: report.framesPerSecond ?? 0,
          frameWidth: report.frameWidth ?? 0,
          frameHeight: report.frameHeight ?? 0,
          retransmittedPacketsSent: report.retransmittedPacketsSent ?? 0,
          targetBitrate: report.targetBitrate ?? 0,
          totalEncodeTime: report.totalEncodeTime ?? 0,
          framesEncoded: report.framesEncoded ?? 0,
        };

        reportsMap.set(report.remoteId, report.rid);

        for (const [metricName, value] of Object.entries(metrics)) {
          payload += `clientmetric_video_${metricName}{${labels}} ${value}\n`;
        }
      }
      if (report.type === "remote-inbound-rtp" && report.kind === "video") {
        const rid = reportsMap.get(report.id);
        const labels = `clientId="${user.id}",rid="${rid}",roomId="${roomId}"`;

        const metrics: { [key: string]: number } = {
          fractionLost: report.fractionLost ?? 0,
          packetsLost: report.packetsLost ?? 0,
          roundTripTime: report.roundTripTime ?? 0,
          jitter: report.jitter ?? 0,
        };

        for (const [metricName, value] of Object.entries(metrics)) {
          payload += `clientmetric_video_${metricName}{${labels}} ${value}\n`;
        }
      }
    });

    if (payload) {
      $fetch(`/exportClientMetrics/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload,
        baseURL: useRuntimeConfig().public.backendUrl,
      });
      console.log("Metrics pushed successfully");
    }
  } catch (err) {
    console.error("Failed to push metrics", err);
  }
}

export function useMedia(mediaConn: mediasoupConn) {
  async function startMic() {
    const stream = await mediaConn.getAudioStream();

    trackVoiceActivity(stream, (currSpeaking) => {
      isSpeaking.value = currSpeaking && !isMuted.value;
    });

    await mediaConn.produce("audio");
  }

  function toggleMicState() {
    isMuted.value = mediaConn.toggleMic();
  }

  let interval: NodeJS.Timeout;

  async function toggleScreenShare(roomId: string) {
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

      interval = setInterval(() => {
        collectVideoMetric(mediaConn.transports.send!, roomId);
      }, 5000);

      onUnmounted(() => clearInterval(interval));
    } else {
      mediaConn.stopStream();
      videoStream.value = null;
      clearInterval(interval);
    }
  }

  onUnmounted(() => {
    isSpeaking.value = false;
    isMuted.value = true;
    videoStream.value = null;
    clearInterval(interval);
  });

  return {
    isSpeaking,
    isMuted,
    videoStream,
    startMic,
    toggleMicState,
    toggleScreenShare,
  };
}
