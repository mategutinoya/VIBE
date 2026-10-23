export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg, 'not_found');
export const forbidden = (msg = 'No tienes permiso para hacer esto') => new HttpError(403, msg, 'forbidden');
