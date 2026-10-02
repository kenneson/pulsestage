type PgLikeError = { code?: string; message?: string } | null | undefined;

export function isUniqueViolation(error: PgLikeError): boolean {
  return error?.code === "23505";
}

export function isForeignKeyViolation(error: PgLikeError): boolean {
  return error?.code === "23503";
}

/** Verifica exceções lançadas pelos triggers (raise exception '<codigo>'). */
export function hasDbErrorCode(error: PgLikeError, code: string): boolean {
  return Boolean(error?.message?.includes(code));
}
