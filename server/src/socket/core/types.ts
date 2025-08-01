export interface HandlerError {
  code: string;
  message: string;
}

export type HandlerCallback<Data> = (
  result:
    | {
        data: Data;
        errors?: undefined;
      }
    | {
        data?: undefined;
        errors: HandlerError[];
      }
) => void;

export type ErrorCb = (data: { error?: string }) => void;

export interface EventError {
  event: string;
  error: {
    code: string;
    message: string;
  };
}
