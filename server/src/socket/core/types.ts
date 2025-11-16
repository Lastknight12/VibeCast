export interface HandlerError {
  code: string;
  message: string;
}

export type HandlerCallback<Data> = (result: {
  data: Data;
  errors?: HandlerError[];
}) => void;
