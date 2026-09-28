import { Prisma } from "@prisma/client";
import { AppError } from "../../src/errors/app-error";

// Unit test sin base: se mockea Prisma para forzar la carrera en la que el
// create choca con el unique (P2002) pero la relectura no encuentra al
// ganador (ej. el otro chat se borró en el medio). Contra la base real ese
// interleaving no se puede reproducir de forma determinística.
const reportFindUnique = jest.fn();
const chatFindUnique = jest.fn();
const chatCreate = jest.fn();

jest.mock("../../src/db/client", () => ({
  prisma: {
    report: { findUnique: (...args: unknown[]) => reportFindUnique(...args) },
    chat: {
      findUnique: (...args: unknown[]) => chatFindUnique(...args),
      create: (...args: unknown[]) => chatCreate(...args),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chatsService = require("../../src/services/chats.service");

const AUTHOR_ID = 1;
const REQUESTER_ID = 2;
const REPORT_ID = 10;

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("chats.service createChat() — carrera con P2002", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    reportFindUnique.mockResolvedValue({ userId: AUTHOR_ID });
  });

  test("si el create choca (P2002) y la relectura no encuentra ganador, lanza AppError 409", async () => {
    chatFindUnique.mockResolvedValue(null);
    chatCreate.mockRejectedValue(uniqueViolation());

    const promise = chatsService.createChat(REQUESTER_ID, AUTHOR_ID, REPORT_ID);

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ statusCode: 409 });
    // antes del create y en la relectura
    expect(chatFindUnique).toHaveBeenCalledTimes(2);
  });

  test("si el create choca (P2002) y la relectura encuentra al ganador, lo devuelve sin marcarlo como creado", async () => {
    const winner = { id: 99, userAId: AUTHOR_ID, userBId: REQUESTER_ID, reportId: REPORT_ID };
    chatFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    chatCreate.mockRejectedValue(uniqueViolation());

    await expect(chatsService.createChat(REQUESTER_ID, AUTHOR_ID, REPORT_ID)).resolves.toEqual({
      chat: winner,
      created: false,
    });
  });
});
