export const ADMIN_TOKEN_VALUE = 'aajaas_ahmed1523_gamely'
export const ADMIN_COOKIE_NAME = 'admin_token'
export const ADMIN_USERNAME = 'aajaas'
export const ADMIN_PASSWORD = 'ahmed1523'

export function validateCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export function isValidAdminToken(token: string | undefined): boolean {
  return token === ADMIN_TOKEN_VALUE
}
