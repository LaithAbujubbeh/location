export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiSuccessBody<T> = {
  ok: true;
  data: T;
};

export function apiError(
  code: string,
  message: string,
  status = 400,
  init?: ResponseInit,
) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      ...init,
      status,
    },
  );
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  init?: ResponseInit,
) {
  return Response.json(
    {
      ok: true,
      data,
    },
    {
      ...init,
      status,
    },
  );
}
