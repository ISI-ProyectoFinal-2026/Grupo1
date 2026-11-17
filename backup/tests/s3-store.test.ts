import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { S3ObjectStore, type S3Like } from "../src/adapters/s3-store";

function fakeClient(responder: (command: unknown) => unknown) {
  const sent: unknown[] = [];
  const client: S3Like = {
    send: async (command: unknown) => {
      sent.push(command);
      return responder(command);
    },
  } as S3Like;
  return { client, sent };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s3-store-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("S3ObjectStore.list", () => {
  it("pagina con ContinuationToken y mapea clave, tamaño y ETag", async () => {
    const { client, sent } = fakeClient((command) => {
      const input = (command as ListObjectsV2Command).input;
      if (!input.ContinuationToken) {
        return { Contents: [{ Key: "db/a.dump", Size: 1, ETag: '"e1"' }], IsTruncated: true, NextContinuationToken: "t2" };
      }
      return { Contents: [{ Key: "db/b.dump", Size: 2, ETag: '"e2"' }], IsTruncated: false };
    });

    const objects = await new S3ObjectStore(client).list("backups", "db/");

    expect(objects).toEqual([
      { key: "db/a.dump", size: 1, etag: '"e1"' },
      { key: "db/b.dump", size: 2, etag: '"e2"' },
    ]);
    expect(sent).toHaveLength(2);
    expect((sent[0] as ListObjectsV2Command).input).toMatchObject({ Bucket: "backups", Prefix: "db/" });
    expect((sent[1] as ListObjectsV2Command).input.ContinuationToken).toBe("t2");
  });

  it("bucket vacío devuelve lista vacía", async () => {
    const { client } = fakeClient(() => ({ IsTruncated: false }));
    expect(await new S3ObjectStore(client).list("x")).toEqual([]);
  });
});

describe("S3ObjectStore.copy", () => {
  it("usa CopyObject del lado del servidor con la clave codificada", async () => {
    const { client, sent } = fakeClient(() => ({}));
    await new S3ObjectStore(client).copy("imagenes", "pets/mi foto ñ.jpg", "backups", "images/pets/mi foto ñ.jpg");

    expect(sent[0]).toBeInstanceOf(CopyObjectCommand);
    expect((sent[0] as CopyObjectCommand).input).toEqual({
      Bucket: "backups",
      Key: "images/pets/mi foto ñ.jpg",
      CopySource: "imagenes/pets/mi%20foto%20%C3%B1.jpg",
    });
  });
});

describe("S3ObjectStore.remove", () => {
  it("borra en lotes de 1000 con DeleteObjects", async () => {
    const { client, sent } = fakeClient(() => ({}));
    const keys = Array.from({ length: 1001 }, (_, i) => `db/${i}.dump`);
    await new S3ObjectStore(client).remove("backups", keys);

    expect(sent).toHaveLength(2);
    expect(sent[0]).toBeInstanceOf(DeleteObjectsCommand);
    expect((sent[0] as DeleteObjectsCommand).input.Delete?.Objects).toHaveLength(1000);
    expect((sent[1] as DeleteObjectsCommand).input.Delete?.Objects).toEqual([{ Key: "db/1000.dump" }]);
  });

  it("sin claves no llama a R2", async () => {
    const { client, sent } = fakeClient(() => ({}));
    await new S3ObjectStore(client).remove("backups", []);
    expect(sent).toEqual([]);
  });

  it("falla si R2 informa errores por objeto", async () => {
    const { client } = fakeClient(() => ({ Errors: [{ Key: "db/a.dump", Message: "AccessDenied" }] }));
    await expect(new S3ObjectStore(client).remove("backups", ["db/a.dump"])).rejects.toThrow(/db\/a\.dump.*AccessDenied/);
  });
});

describe("S3ObjectStore.upload y download", () => {
  it("sube el archivo con su tamaño", async () => {
    const file = path.join(tmp, "x.dump");
    fs.writeFileSync(file, "contenido");
    let body = "";
    const { client, sent } = fakeClient(async (command) => {
      // consume el stream como haría el SDK
      for await (const chunk of (command as PutObjectCommand).input.Body as Readable) body += chunk;
      return {};
    });

    await new S3ObjectStore(client).upload("backups", "db/x.dump", file);

    expect(sent[0]).toBeInstanceOf(PutObjectCommand);
    expect((sent[0] as PutObjectCommand).input).toMatchObject({
      Bucket: "backups",
      Key: "db/x.dump",
      ContentLength: 9,
    });
    expect(body).toBe("contenido");
  });

  it("baja el objeto a disco", async () => {
    const { client, sent } = fakeClient(() => ({ Body: Readable.from([Buffer.from("dump")]) }));
    const file = path.join(tmp, "bajado.dump");

    await new S3ObjectStore(client).download("backups", "db/x.dump", file);

    expect(sent[0]).toBeInstanceOf(GetObjectCommand);
    expect(fs.readFileSync(file, "utf8")).toBe("dump");
  });
});
