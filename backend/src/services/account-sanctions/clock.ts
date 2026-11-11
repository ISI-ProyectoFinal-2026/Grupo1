// Hora del servidor para las sanciones. Es un objeto para poder fijarla en
// los tests con `jest.spyOn(sanctionClock, "now")`.
export const sanctionClock = { now: (): Date => new Date() };
