// Hora del servidor para los pasos TOTP. Es un objeto para poder fijarla en
// los tests con `jest.spyOn(twoFactorClock, "now")`.
export const twoFactorClock = { now: (): number => Date.now() };
