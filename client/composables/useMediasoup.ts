let connection: mediasoupConn;

export function useMediasoup() {
  const toaster = useToast();
  if (!connection) {
    connection = new mediasoupConn(toaster);
  }

  return connection;
}
