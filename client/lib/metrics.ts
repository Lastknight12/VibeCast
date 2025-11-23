import type { User } from "better-auth/types";
import { user } from "./randomUser";

const reportsMap = new Map();

export async function collectProducersMetrics(
  mediaConn: mediasoupConn,
  roomId: string
) {
  if (!mediaConn.transports.send) return;
  try {
    const stats = await mediaConn.transports.send.getStats();
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

export async function collectConsumersMetrics(
  mediaConn: mediasoupConn,
  roomId: string
) {
  try {
    const stats = await mediaConn.getConsumerStatistic();
    let payload = "";

    stats.forEach(({ stats: s, id }) => {
      s.forEach((report) => {
        if (report.type === "inbound-rtp" && report.kind === "video") {
          const labels = `clientId="${user.id}",roomId="${roomId}",consumerId="${id}"`;

          const metrics: { [key: string]: number } = {
            fractionLost: report.fractionLost ?? 0,
            packetsLost: report.packetsLost ?? 0,
            packetsReceived: report.packetsReceived ?? 0,
            bytesReceived: report.bytesReceived ?? 0,
            firCount: report.firCount ?? 0,
            frameWidth: report.frameWidth ?? 0,
            frameHeight: report.frameHeight ?? 0,
            framesDropped: report.framesDropped ?? 0,
            framesDecoded: report.framesDecoded ?? 0,
            framesPerSecond: report.framesPerSecond ?? 0,
            freezeCount: report.freezeCount ?? 0,
            nackCount: report.nackCount ?? 0,
            totalFreezesDuration: report.totalFreezesDuration ?? 0,
            roundTripTime: report.roundTripTime ?? 0,
            jitter: report.jitter ?? 0,
          };

          for (const [metricName, value] of Object.entries(metrics)) {
            payload += `clientmetric_consumer_${metricName}{${labels}} ${value}\n`;
          }
        }
      });
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
