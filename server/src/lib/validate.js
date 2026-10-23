import { badRequest } from './errors.js';

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

/** Normaliza texto de usuario: recorta, colapsa saltos de línea excesivos y limita longitud. */
export function text(value, { field, max, min = 0, required = false, multiline = true } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw badRequest(`${field} no es válido`);
  let v = value.replace(/\r\n/g, '\n').trim();
  v = multiline ? v.replace(/\n{3,}/g, '\n\n') : v.replace(/\s+/g, ' ');
  if (required && !v) throw badRequest(`${field} es obligatorio`);
  if (v.length < min) throw badRequest(`${field} debe tener al menos ${min} caracteres`);
  if ([...v].length > max) throw badRequest(`${field} admite como máximo ${max} caracteres`);
  return v;
}

export function oneOf(value, options, field) {
  if (!options.includes(value)) throw badRequest(`${field} no es válido`);
  return value;
}

export function intId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw badRequest(`${field} no es válido`);
  return n;
}

export function optionalCursor(value) {
  if (value === undefined || value === '') return Number.MAX_SAFE_INTEGER;
  return intId(value, 'cursor');
}

export const REACTIONS = ['💜', '🔥', '😂', '🥹', '😮', '🫶'];
