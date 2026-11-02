# Puesto y Remolque 3D

Propuesta de diseño en 3D de un **puesto de acero inoxidable** y un **remolque con barra**. Se abre en el navegador, en computadora o celular, sin instalar nada.

<p>
  <a href="https://eliasgaribi-ctrl-z.github.io/puesto-remolque-3d/"><img alt="Abrir visor 3D" src="https://img.shields.io/badge/Abrir_visor_3D-%E2%96%B6-df6f1d?style=for-the-badge"></a>
  &nbsp;
  <a href="https://eliasgaribi-ctrl-z.github.io/puesto-remolque-3d/#puesto"><img alt="Ver puesto" src="https://img.shields.io/badge/Ver_puesto-14181b?style=for-the-badge"></a>
  &nbsp;
  <a href="https://eliasgaribi-ctrl-z.github.io/puesto-remolque-3d/#remolque"><img alt="Ver remolque" src="https://img.shields.io/badge/Ver_remolque-14181b?style=for-the-badge"></a>
</p>

![Puesto de acero inoxidable](renders/puesto-detalle.jpg)

| Puesto completo | Remolque con barra |
| --- | --- |
| ![Puesto 3/4](renders/puesto-3-4.jpg) | ![Remolque 3/4](renders/remolque-3-4.jpg) |

## Qué se puede hacer en el visor

- **Girar, acercar y mover** el modelo con el mouse o con los dedos. La primera vez aparece una tarjeta que explica cómo; se vuelve a abrir con el botón **?**.
- **Recorrido**: cada área tiene un número en el modelo y en el panel. Con **Siguiente** (o las flechas del teclado) se pasa de una a otra, y cada parada trae su acción: abrir la puerta, ver las medidas del módulo, cambiar el acabado…
- **Vistas rápidas** en la barra de abajo: 3/4, frente, costado, desde arriba y más. Cada botón dibuja desde dónde se ve.
- **Medidas**: el largo total y las medidas clave arriba, las que faltan por confirmar marcadas aparte, y las cotas sobre el modelo con un clic. Las medidas *por confirmar* se validan antes de fabricar.
- **Acabado**: frente inox o blanco en el puesto; caja blanca, grafito o inox en el remolque. También se abren puertas y tapas, se baja la repisa y se muestran u ocultan los bancos.
- **Compartir**: foto HD de la vista actual (en el celular abre el menú de compartir), enlace directo al modelo y descarga del modelo 3D en `.glb`.
- **Modo técnico** (maqueta blanca con aristas), **tema claro u oscuro** y **calidad** Alta, Media o Ligera; la calidad baja sola si el equipo se traba.
- **Funciona en laptop y teléfono**: en pantallas grandes el panel flota a un lado del modelo; en el celular baja debajo del visor. También se puede usar acostado y en pantalla completa.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| [`index.html`](index.html) | El visor completo en un solo archivo. Funciona sin internet si lo descargas. |
| [`modelos/`](modelos/) | Los modelos 3D en `.glb` (puesto y remolque), en metros. |
| [`renders/`](renders/) | Imágenes listas para presentar. |
| [`fuente/`](fuente/) | Código fuente del visor y de los modelos. |

## Editar los modelos

Los modelos se construyen con código en [`fuente/src/`](fuente/src/) (`puesto.js` y `remolque.js`), con las medidas en centímetros tal como vienen en el boceto. Para regenerar `index.html`:

```bash
cd fuente
npm install
npm run build
```

Los logos son provisionales.
