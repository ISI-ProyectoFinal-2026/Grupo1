import { nextRunAt, startDailySchedule } from "../src/schedule";
import type { Logger } from "../src/ports";

// fechas en hora local: el resultado no depende del TZ de la máquina
describe("nextRunAt", () => {
  it("si todavía no pasó la hora, programa para hoy", () => {
    expect(nextRunAt(new Date(2026, 10, 15, 2, 59, 59), 3)).toEqual(
      new Date(2026, 10, 15, 3, 0, 0)
    );
  });

  it("si es exactamente la hora, programa para mañana", () => {
    expect(nextRunAt(new Date(2026, 10, 15, 3, 0, 0), 3)).toEqual(
      new Date(2026, 10, 16, 3, 0, 0)
    );
  });

  it("si ya pasó la hora, programa para mañana", () => {
    expect(nextRunAt(new Date(2026, 10, 15, 14, 0, 0), 3)).toEqual(
      new Date(2026, 10, 16, 3, 0, 0)
    );
  });

  it("cruza fin de mes y de año", () => {
    expect(nextRunAt(new Date(2026, 11, 31, 23, 0, 0), 0)).toEqual(
      new Date(2027, 0, 1, 0, 0, 0)
    );
  });
});

function silentLogger(): Logger {
  return { info: jest.fn(), error: jest.fn() };
}

describe("startDailySchedule", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 15, 2, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("ejecuta el job a la hora y vuelve a programarlo para el día siguiente", async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    const stop = startDailySchedule(job, 3, silentLogger());

    await jest.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
    expect(job).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(job).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(job).toHaveBeenCalledTimes(2);
    stop();
  });

  it("si el job falla, lo registra y sigue programando", async () => {
    const logger = silentLogger();
    const job = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const stop = startDailySchedule(job, 3, logger);

    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("boom"));

    await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(job).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stop cancela la próxima ejecución", async () => {
    const job = jest.fn().mockResolvedValue(undefined);
    const stop = startDailySchedule(job, 3, silentLogger());
    stop();
    await jest.advanceTimersByTimeAsync(48 * 60 * 60 * 1000);
    expect(job).not.toHaveBeenCalled();
  });
});
