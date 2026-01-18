import type { HandlerError } from "./useSocket";

export function useSocketEmit<Data = unknown>(event: string, ...args: any[]) {
  const socket = useSocket();
  const errors = ref<HandlerError[] | undefined>(undefined);
  const loading = ref(false);
  const data = ref<Data | undefined>(undefined);

  const handler = (result: CallbackResult<Data>) => {
    console.log(result);
    errors.value = result.errors;
    data.value = result.data;
    loading.value = false;
  };

  loading.value = true;
  socket.emit(event, ...args, handler);

  return {
    data,
    loading,
    errors,
  };
}
