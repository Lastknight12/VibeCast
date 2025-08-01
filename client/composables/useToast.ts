export interface Toast {
  id: string;
  label: "sucess" | "error";
  message: string;
}

const toasts = ref<Toast[]>([]);

export function useToast() {
  const { $crypto } = useNuxtApp();

  function sucess(toast: Omit<Toast, "id" | "label">) {
    const id = $crypto.randomUUID();
    const newToast: Toast = { ...toast, id, label: "sucess" };

    toasts.value.push(newToast);

    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3500);
  }

  function error(toast: Omit<Toast, "id" | "label">) {
    const id = $crypto.randomUUID();
    const newToast: Toast = { ...toast, id, label: "error" };

    toasts.value.push(newToast);

    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3500);
  }

  return {
    toasts,
    sucess,
    error,
  };
}
