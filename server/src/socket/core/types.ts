export interface HandlerError {
  code: string;
  message: string;
}

// TODO: add to commit
export type HandlerCallback<Data> = (result: {
  data: Data;
  errors?: HandlerError[];
}) => void;
