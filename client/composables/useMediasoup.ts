let connection: mediasoupConn;

export function useMediasoup() {
  if (!connection) {
    const toaster = useToast();
    connection = new mediasoupConn(toaster);
  }

  return connection;
}
