let connection: mediasoupConn;

export function useMediasoup() {
  if (!connection) {
    const appConfig = useNuxtApp().$config;

    connection = new mediasoupConn({
      enableSharingLayers: Boolean(appConfig.public.enableSharingLayers),
      numSharingSimulcastStreams: Number(
        appConfig.public.numSharingSimulcastStreams
      ),
    });
  }

  return connection;
}
