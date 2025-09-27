export interface Toast {
  id: string;
  label: "sucess" | "error";
  message: string;
}

interface toastOpts {
  duration?: number;
}

const toasts = ref<Toast[]>([]);
const duration = 3500;

export function useToast() {
  const { $crypto } = useNuxtApp();

  function sucess(
    toast: Omit<Toast, "id" | "label"> | { message?: string },
    opts?: toastOpts
  ) {
    const id = $crypto.randomUUID();
    const newToast: Toast = {
      ...toast,
      id,
      label: "sucess",
      message: toast.message ?? "",
    };

    toasts.value.push(newToast);

    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, opts?.duration ?? duration);
  }

  function error(
    toast: Omit<Toast, "id" | "label"> | { message?: string },
    opts?: toastOpts
  ) {
    const id = $crypto.randomUUID();
    const newToast: Toast = {
      ...toast,
      id,
      label: "error",
      message: toast.message ?? "",
    };

    toasts.value.push(newToast);

    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, opts?.duration ?? duration);
  }

  return {
    toasts,
    sucess,
    error,
  };
}
