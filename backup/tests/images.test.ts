import { IMAGES_PREFIX, selectImagesToCopy } from "../src/images";
import type { StoredObject } from "../src/ports";

function obj(key: string, size = 10, etag = `"${key}"`): StoredObject {
  return { key, size, etag };
}

describe("selectImagesToCopy", () => {
  it("usa el prefijo images/", () => {
    expect(IMAGES_PREFIX).toBe("images/");
  });

  it("sin backup previo copia todo", () => {
    const source = [obj("pets/a.jpg"), obj("flyers/b.png")];
    expect(selectImagesToCopy(source, [])).toEqual([
      { sourceKey: "pets/a.jpg", destKey: "images/pets/a.jpg" },
      { sourceKey: "flyers/b.png", destKey: "images/flyers/b.png" },
    ]);
  });

  it("no copia lo que ya está igual", () => {
    const source = [obj("pets/a.jpg")];
    const backup = [obj("images/pets/a.jpg", 10, `"pets/a.jpg"`)];
    expect(selectImagesToCopy(source, backup)).toEqual([]);
  });

  it("copia si cambió el tamaño", () => {
    const source = [obj("pets/a.jpg", 20, `"x"`)];
    const backup = [obj("images/pets/a.jpg", 10, `"x"`)];
    expect(selectImagesToCopy(source, backup)).toHaveLength(1);
  });

  it("copia si cambió el ETag", () => {
    const source = [obj("pets/a.jpg", 10, `"nuevo"`)];
    const backup = [obj("images/pets/a.jpg", 10, `"viejo"`)];
    expect(selectImagesToCopy(source, backup)).toHaveLength(1);
  });

  it("compara ETags sin importar comillas ni mayúsculas", () => {
    const source = [obj("pets/a.jpg", 10, `"ABC"`)];
    const backup = [obj("images/pets/a.jpg", 10, "abc")];
    expect(selectImagesToCopy(source, backup)).toEqual([]);
  });

  it("nunca propone borrar: lo que solo está en el backup se ignora", () => {
    const backup = [obj("images/pets/borrada.jpg")];
    expect(selectImagesToCopy([], backup)).toEqual([]);
  });

  it("ignora 'carpetas' vacías (claves que terminan en /)", () => {
    expect(selectImagesToCopy([obj("pets/", 0)], [])).toEqual([]);
  });
});
