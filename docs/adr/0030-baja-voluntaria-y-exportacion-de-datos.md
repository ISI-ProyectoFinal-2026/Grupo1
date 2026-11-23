# ADR-0030: Baja voluntaria de cuenta y exportación de datos

- **Estado:** Aceptada
- **Responsables:** Equipo (Matías Alvarado, PM)

## Decisión

El usuario puede editar su nombre y teléfono, descargar sus datos en JSON y eliminar su propia cuenta desde "Mi cuenta". Al darse de baja: (1) se mantiene la cascada actual sobre reportes, coincidencias, chats y mensajes; (2) un comercio con plan Premium vigente impide la baja; (3) las denuncias de cuentas que hizo el usuario se conservan sin autor; (4) el teléfono acepta dígitos, espacios, guiones, paréntesis y un `+` inicial, con 8 a 15 dígitos.

## Motivo

- Ninguna ruta permitía cargar el teléfono, por lo que el flyer nunca podía mostrarlo (RF-23), y el titular de los datos no tenía forma de obtener una copia de ellos ni de eliminar su cuenta: la única eliminación era la sanción de un administrador.
- (1) Si el usuario decide darse de baja, su actividad en la aplicación deja de existir y no es necesario que sus reportes sigan: la baja es completa, con todas sus consecuencias.
- (2) Un plan Premium vigente es un pago en curso: se espera a su vencimiento para que el usuario aproveche lo que pagó, y recién entonces puede darse de baja.
- (3) Una denuncia se refiere a otra cuenta: borrarla dejaría sin evidencia una moderación en curso o una sanción ya aplicada.
- (4) En Argentina el teléfono se escribe de muchas formas: aceptar las habituales evita rechazar números válidos, y el flyer lo muestra tal como el usuario lo reconoce.

## Alternativas

Anonimizar los reportes y los chats en lugar de borrarlos: descartada, porque la baja es completa y, sin actividad del usuario en la aplicación, no es necesario que sus reportes sigan.

## Consecuencias

- La persona con la que el usuario chateaba pierde la conversación completa, incluidos sus propios mensajes.
- El titular de un comercio Premium debe esperar al vencimiento del plan para eliminar la cuenta; la baja también se rechaza con una sanción en curso o si se trata del último administrador.
- Quedan fuera de alcance el borrado de las imágenes en R2 (#288) y la purga de los backups antes de su rotación.

## Referencias

[Issue #366](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/366); [Issue #259](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/259); [Issue #288](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/288).
