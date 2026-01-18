export interface Toast {
  id: string;
  label: "sucess" | "error";
  message: string;
}

interface toastOpts {
  duration?: number;
}

const toasts = ref<Map<string, Toast>>(new Map());
const duration = 3500;

export function useToast() {
  const { $crypto } = useNuxtApp();

  function sucess(
    toast: Omit<Toast, "id" | "label"> | { message?: string },
    opts?: toastOpts,
  ) {
    const id = $crypto.randomUUID();
    const newToast: Toast = {
      ...toast,
      id,
      label: "sucess",
      message: toast.message ?? "",
    };

    toasts.value.set(id, newToast);

    setTimeout(() => {
      toasts.value.delete(id);
    }, opts?.duration ?? duration);

    return id;
  }

  function error(
    toast: Omit<Toast, "id" | "label"> | { message?: string },
    opts?: toastOpts,
  ) {
    const id = $crypto.randomUUID();
    const newToast: Toast = {
      ...toast,
      id,
      label: "error",
      message: toast.message ?? "",
    };

    toasts.value.set(id, newToast);

    setTimeout(() => {
      toasts.value.delete(id);
    }, opts?.duration ?? duration);

    return id;
  }

  return {
    toasts,
    sucess,
    error,
  };
}
