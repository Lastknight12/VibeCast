let connection: mediasoupConn;

export function useMediasoup() {
  if (!connection) {
    connection = new mediasoupConn();
  }

  return connection;
}
