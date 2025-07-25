// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DefaultHandlerCb = (...args: any[]) => void;

export type ErrorCb = (data: { error?: string }) => void;

export interface EventError {
  event: string;
  details:
    | Error
    | {
        path: string;
        keyword: string;
        message: string;
      }[];
}
