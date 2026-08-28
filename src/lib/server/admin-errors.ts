export type CreateUserError = {
  message: string;
  field?: 'password';
};

const PASSWORD_ERROR = 'La contraseña debe tener al menos 8 caracteres.';

/** Keep Mailu's API details on the server and return only actionable UI copy. */
export function classifyCreateUserError(input: unknown): CreateUserError {
  const raw = input instanceof Error ? input.message : String(input ?? '');
  const normalized = raw.toLowerCase();
  const status = raw.match(/\b(?:->\s*)?(401|403|404|409|422|429|500|502|503)\b/)?.[1];

  if (
    normalized.includes('password') ||
    normalized.includes('contraseña') ||
    normalized.includes('raw_password') ||
    normalized.includes('passwd') ||
    normalized.includes('password policy') ||
    normalized.includes('too short') ||
    normalized.includes('minimum length')
  ) {
    return { message: PASSWORD_ERROR, field: 'password' };
  }

  if (normalized.includes('already exists') || normalized.includes('duplicate') || normalized.includes('user exists')) {
    return { message: 'Ese usuario ya existe. Elegí otro nombre.' };
  }

  if (
    status === '404' ||
    (normalized.includes('domain') && (normalized.includes('does not exist') || normalized.includes('not found'))) ||
    normalized.includes('invalid email')
  ) {
    return { message: 'El dominio no es válido o no está disponible.' };
  }

  if (
    normalized.includes('too many users') ||
    normalized.includes('max_users') ||
    normalized.includes('user limit') ||
    normalized.includes('maximum number of users')
  ) {
    return { message: 'Se alcanzó el límite de usuarios para este dominio.' };
  }

  if (normalized.includes('quota') || normalized.includes('cuota')) {
    return { message: 'La cuota debe ser un número válido mayor o igual a cero.' };
  }

  if (
    status === '401' ||
    status === '403' ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('authorization') ||
    normalized.includes('api key')
  ) {
    return { message: 'No tenés autorización para crear usuarios.' };
  }

  if (status === '429' || normalized.includes('rate limit') || normalized.includes('límite alcanzado')) {
    return { message: 'Se alcanzó el límite de intentos. Esperá un minuto y probá de nuevo.' };
  }

  return { message: 'No se pudo crear el usuario. Revisá los datos y probá de nuevo.' };
}

export const createUserPasswordError = PASSWORD_ERROR;
