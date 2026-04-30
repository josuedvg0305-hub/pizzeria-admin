# PRD - Fase 2: PWA E-commerce para Consumidor Final

Proyecto: La Pizzeria de Buin  
Fecha: 2026-04-30  
Estado: Propuesta funcional y tecnica para implementacion  
Producto: Aplicacion Web Progresiva mobile-first para pedidos de clientes finales

---

## 1. Resumen del Producto

La Fase 2 consiste en construir una PWA/e-commerce publica para que los clientes de La Pizzeria de Buin puedan revisar la carta, personalizar productos, calcular delivery segun su direccion y enviar el pedido formateado por WhatsApp.

La nueva app debe consumir la misma base de datos que administra el panel actual:

- `categories`: categorias del menu, orden y estado activo.
- `products`: productos, imagenes, precios simples, variantes, promociones, stock y grupos de modificadores asignados.
- `modifier_groups`: reglas de extras, opciones, obligatoriedad, multiples, minimos, maximos y precios por variante.
- `delivery_zones`: poligonos de cobertura, precio exacto de delivery, color, orden y estado.

El checkout no contempla pago online en esta fase. El cierre operativo del pedido se realiza por WhatsApp mediante un mensaje estructurado enviado a la cuenta del negocio.

---

## 2. Objetivos

- Permitir que un cliente arme un pedido completo sin intervencion del local.
- Reutilizar menu, modificadores y zonas de delivery ya gestionados en el panel admin.
- Reducir errores de toma de pedidos al enviar un recibo claro por WhatsApp.
- Validar zonas de delivery y calcular costo de envio antes de enviar el pedido.
- Entregar una experiencia rapida, mobile-first e instalable como PWA.

## 3. Fuera de Alcance para esta Fase

- Pago online con WebPay, Mercado Pago u otro proveedor.
- Login obligatorio de clientes.
- Seguimiento en tiempo real del estado del pedido desde la PWA.
- Creacion directa de orden en Supabase desde el cliente final, salvo que el negocio decida activarlo en una fase posterior.
- Programa de fidelizacion, cupones o puntos.

---

## 4. Supuestos Tecnicos

- La PWA puede leer datos publicos del menu y zonas desde Supabase usando politicas RLS de solo lectura.
- Los productos y categorias inactivos no deben mostrarse al cliente.
- Los modificadores inactivos no deben estar disponibles para seleccion.
- La direccion de delivery debe resolverse con Google Maps Geocoding y validarse contra `delivery_zones.polygon`.
- El mensaje final de WhatsApp debe ser deterministico: dos carritos iguales generan el mismo resumen y total.
- Los precios se expresan en CLP y se deben renderizar con formato local chileno.

---

# Modulo 1: Catalogo y UI

## Alcance

Construir la experiencia publica del catalogo con enfoque mobile-first. La pantalla principal debe mostrar categorias, productos disponibles, imagenes, precios, promociones y acceso rapido al detalle del producto.

La UI debe ser usable principalmente desde telefono, con soporte desktop responsivo. La navegacion principal debe permitir saltar entre categorias y abrir productos en un modal o bottom sheet de personalizacion.

## Historia de Usuario

Como cliente, quiero navegar la carta desde mi celular, ver categorias, fotos, precios y productos disponibles para elegir rapidamente que quiero pedir.

## Criterios de Aceptacion Tecnicos

- La app debe cargar `categories`, `products` y `modifier_groups` desde Supabase al iniciar.
- Las categorias deben ordenarse por `sort_order` ascendente.
- Solo se deben mostrar categorias activas (`active === true` o `is_active === true`) que contengan al menos un producto activo visible.
- Solo se deben mostrar productos activos (`active === true` o `is_active === true`).
- Cada tarjeta de producto debe mostrar:
  - nombre,
  - descripcion corta cuando exista,
  - imagen principal usando `images?.[0] ?? image`,
  - precio base o rango de precios si el producto tiene variantes,
  - precio promocional cuando exista,
  - estado no disponible cuando el stock este habilitado y `stock.quantity <= 0`.
- La UI debe incluir una navegacion horizontal sticky de categorias en mobile.
- El click/tap sobre un producto debe abrir un detalle con seleccion de variante, modificadores, cantidad y nota.
- La experiencia debe funcionar correctamente en viewport mobile desde 360 px de ancho.
- Los botones y zonas tactiles principales deben tener un area minima aproximada de 44 x 44 px.
- Las imagenes deben usar carga diferida (`loading="lazy"` o estrategia equivalente) para no bloquear el primer render.
- Debe existir estado de carga, estado vacio y estado de error para el catalogo.
- El catalogo no debe depender de autenticacion del cliente.

---

# Modulo 2: Motor del Carrito y Modificadores

## Alcance

Implementar el motor de seleccion de productos, variantes, extras obligatorios/opcionales y calculo dinamico del subtotal. El comportamiento debe respetar las reglas configuradas en el admin para `modifier_groups`.

## Historia de Usuario

Como cliente, quiero personalizar mi pizza con tamanos, bordes e ingredientes extra para armar el producto exactamente como lo quiero y ver el precio actualizado antes de agregarlo al carrito.

## Criterios de Aceptacion Tecnicos

- El motor debe soportar productos con `priceType: "simple"` y productos con `priceType: "variants"`.
- En productos con variantes, el cliente debe seleccionar una variante antes de agregar al carrito.
- El precio base del item debe resolverse asi:
  - producto simple: `promoPrice` si existe y es mayor a 0; si no, `price`;
  - producto con variantes: `variant.promoPrice` si existe y es mayor a 0; si no, `variant.price`.
- Los grupos de modificadores deben resolverse desde `product.modifierGroupIds` manteniendo el orden del array.
- Las opciones con `active === false` deben ocultarse al cliente.
- Un grupo con `required === true` debe bloquear "Agregar al carrito" hasta cumplir su regla.
- Si `multiple === false`, el grupo debe comportarse como seleccion unica tipo radio.
- Si `multiple === true`, el grupo debe permitir cantidades o multiples selecciones respetando `min` y `max`.
- Si una opcion usa `priceByVariant`, el precio debe calcularse con la variante seleccionada actual.
- Si una opcion no usa `priceByVariant`, el precio debe usar `promoPrice` si existe y es mayor a 0; si no, `price`; si ambos son nulos, su precio es 0.
- El subtotal del item debe recalcularse en tiempo real con la formula:

```txt
itemSubtotal = (precioBase + sumaExtrasSeleccionados) * cantidad
```

- El carrito debe persistir durante la sesion del navegador. Se recomienda `localStorage` o Zustand con persistencia local solo para el carrito del cliente.
- Cada item del carrito debe guardar snapshots de precio y seleccion:
  - `productId`,
  - `productName`,
  - `variantId` o `variantName`,
  - `basePrice`,
  - `quantity`,
  - `note`,
  - `modifiers: [{ id, name, price, qty }]`,
  - `lineTotal`.
- Editar un item del carrito debe rehidratar variante, modificadores, cantidades y nota.
- El total del carrito debe actualizarse al agregar, editar, eliminar o cambiar cantidades.
- El carrito debe impedir finalizar checkout si esta vacio.

---

# Modulo 3: Checkout Dinamico

## Alcance

Crear un checkout condicional segun el tipo de pedido elegido por el cliente: "Para Llevar" o "Delivery". El flujo debe pedir solo los datos necesarios para cada caso y reflejar inmediatamente el costo final.

## Historia de Usuario

Como cliente, quiero elegir si retiro mi pedido o si necesito delivery para completar solo los datos necesarios y enviar mi pedido sin friccion.

## Criterios de Aceptacion Tecnicos

- El checkout debe ofrecer dos tipos de servicio:
  - `llevar`: retiro en local;
  - `delivery`: despacho a domicilio.
- El cliente debe ingresar obligatoriamente:
  - nombre,
  - telefono chileno,
  - tipo de servicio,
  - metodo de pago o nota de pago si el negocio lo requiere.
- Para `llevar`, el checkout no debe solicitar direccion ni calcular costo de delivery.
- Para `delivery`, el checkout debe solicitar direccion y referencia opcional.
- El cambio entre `llevar` y `delivery` debe actualizar el resumen de totales inmediatamente.
- El total final debe calcularse asi:

```txt
total = subtotalCarrito + costoDelivery
```

- Para `llevar`, `costoDelivery` debe ser 0.
- Para `delivery`, el boton de enviar pedido debe permanecer bloqueado hasta que:
  - exista una direccion valida,
  - la direccion pertenezca a una zona activa,
  - exista un costo de delivery calculado.
- El formulario debe validar telefono en formato chileno. Debe aceptar entradas comunes y normalizarlas al formato `56XXXXXXXXX` para WhatsApp cuando corresponda.
- El checkout debe mostrar resumen antes del envio:
  - items,
  - modificadores,
  - notas,
  - subtotal,
  - delivery,
  - total,
  - datos del cliente,
  - tipo de servicio.
- Los errores de validacion deben ser visibles junto al campo correspondiente.
- El checkout debe conservar el carrito si el usuario vuelve al catalogo.

---

# Modulo 4: Geolocalizacion

## Alcance

Integrar Google Maps para validar direcciones contra los poligonos de zonas de delivery configurados en el admin y calcular el costo exacto de envio.

El modulo debe reutilizar la logica conceptual existente del admin/PDV: geocodificar direccion, convertir el resultado a coordenadas y verificar si el punto cae dentro de algun poligono de `delivery_zones`.

## Historia de Usuario

Como cliente, quiero escribir o seleccionar mi direccion para saber automaticamente si La Pizzeria de Buin llega a mi zona y cuanto cuesta el delivery.

## Criterios de Aceptacion Tecnicos

- La PWA debe cargar Google Maps JavaScript API con las librerias necesarias para:
  - Places Autocomplete o Address Autocomplete,
  - Geocoding,
  - Geometry library para `containsLocation`.
- El input de direccion de delivery debe usar autocompletado cuando Google Maps este disponible.
- Al seleccionar o confirmar una direccion, la app debe obtener `lat` y `lng`.
- La validacion debe recorrer `delivery_zones` activas y con `polygon.length >= 3`.
- Para cada zona, se debe construir un poligono con `zone.polygon`.
- La app debe usar `google.maps.geometry.poly.containsLocation(latLng, polygon)` para determinar pertenencia.
- Si una direccion cae dentro de mas de una zona, se debe usar la primera zona segun `sort_order` ascendente, salvo que se defina una prioridad explicita posterior.
- Si la direccion esta dentro de una zona:
  - mostrar nombre de zona,
  - mostrar precio de delivery,
  - guardar `deliveryZoneId`, `deliveryZoneName`, `deliveryPrice`, `lat` y `lng` en el estado de checkout.
- Si la direccion no pertenece a ninguna zona:
  - informar que esta fuera de cobertura,
  - bloquear envio de pedido por delivery,
  - permitir cambiar a "Para Llevar".
- Si Google Maps falla o no carga:
  - mostrar error recuperable,
  - no permitir confirmar delivery sin validacion de zona.
- La validacion debe usar debounce para no geocodificar en cada tecla. Recomendacion: 500-800 ms.
- La API key debe vivir en variable de entorno, por ejemplo `VITE_GOOGLE_MAPS_API_KEY`.
- No se debe exponer ninguna clave privada ni service role key en el frontend.

---

# Modulo 5: Motor de WhatsApp

## Alcance

Generar el recibo textual del pedido y redirigir al cliente a WhatsApp usando la API `wa.me`. El mensaje debe ser claro para cocina/PDV y suficientemente estructurado para que el equipo del local lo pueda copiar, confirmar o ingresar al sistema.

## Historia de Usuario

Como cliente, quiero enviar mi pedido por WhatsApp con todos los detalles ya formateados para que el local pueda confirmarlo rapidamente y evitar errores.

## Criterios de Aceptacion Tecnicos

- El numero destino del negocio debe configurarse por variable de entorno, por ejemplo `VITE_WHATSAPP_ORDER_PHONE`, en formato internacional sin `+`.
- El motor debe construir un string de recibo antes de redirigir.
- El string debe incluir:
  - encabezado del negocio,
  - fecha y hora local,
  - nombre del cliente,
  - telefono del cliente,
  - tipo de servicio,
  - direccion y referencia si es delivery,
  - zona y costo de delivery si aplica,
  - listado de productos,
  - variante por producto si aplica,
  - modificadores con cantidad y precio,
  - nota por item si existe,
  - subtotal,
  - delivery,
  - total,
  - metodo de pago o nota de pago,
  - comentario general del pedido si existe.
- El formato recomendado es:

```txt
*Nuevo pedido web - La Pizzeria de Buin*

Cliente: [nombre]
Telefono: [telefono]
Tipo: [Para llevar | Delivery]
Direccion: [direccion]
Referencia: [referencia]
Zona: [zona] - Delivery: $[precio]

*Pedido*
1x [Producto] ([Variante]) - $[lineTotal]
   + [Modificador] x[qty] - $[precio]
   Nota: [nota]

Subtotal: $[subtotal]
Delivery: $[delivery]
*Total: $[total]*

Pago: [metodo/nota]
Comentario: [comentario]
```

- El string final debe codificarse con `encodeURIComponent`.
- La redireccion debe usar:

```txt
https://wa.me/[telefonoNegocio]?text=[mensajeCodificado]
```

- Antes de redirigir, el checkout debe validar nuevamente que:
  - el carrito no este vacio,
  - los datos obligatorios existan,
  - las reglas de delivery esten cumplidas cuando aplique.
- Tras abrir WhatsApp, la app debe mostrar una pantalla o estado de "pedido enviado a WhatsApp" con opcion de volver al menu.
- El carrito no debe limpiarse antes de ejecutar la redireccion.
- Se puede limpiar el carrito solo cuando el usuario confirme que ya envio el pedido o cuando toque "Nuevo pedido".
- El generador de mensajes debe estar cubierto por pruebas unitarias con al menos:
  - pedido para llevar,
  - pedido delivery dentro de zona,
  - producto con variante,
  - producto con modificadores multiples,
  - item con nota.

---

# Historias Transversales

## Instalacion PWA

Como cliente frecuente, quiero instalar la app en mi telefono para abrir la carta rapidamente cuando quiera pedir.

### Criterios de Aceptacion Tecnicos

- Debe existir `manifest.webmanifest` con nombre, short name, iconos y theme color.
- Debe existir service worker o integracion con Vite PWA para cachear assets estaticos.
- La app debe ser servida por HTTPS en produccion.
- El catalogo debe mostrar estado de error claro si no se puede cargar el menu desde Supabase.

## Observabilidad Basica

Como equipo del negocio, quiero detectar fallos de checkout o mapas para corregir problemas que impidan pedidos.

### Criterios de Aceptacion Tecnicos

- Registrar errores controlados de:
  - carga de menu,
  - carga de zonas,
  - geocoding,
  - validacion fuera de zona,
  - redireccion a WhatsApp.
- Los logs no deben incluir claves privadas ni datos sensibles innecesarios.

---

# Propuesta de Pila Tecnologica

## Frontend

- React 19.
- Vite 8.
- Tailwind CSS 4 para estilos, manteniendo coherencia con el admin.
- React Router para rutas publicas:
  - `/` catalogo,
  - `/checkout`,
  - `/pedido-enviado`.
- Zustand para estado global liviano del carrito y checkout.
- TanStack Query o hooks dedicados con cache manual para lectura de catalogo y zonas desde Supabase.

## Backend y Datos

- Supabase como fuente de verdad compartida.
- Lectura publica controlada por RLS para:
  - categorias activas,
  - productos activos,
  - grupos de modificadores activos,
  - zonas de delivery activas.
- Sin uso de service role key en frontend.

## Mapas

- Google Maps JavaScript API.
- Places Autocomplete.
- Geocoding API.
- Geometry library para validacion punto-en-poligono.

## PWA

- `vite-plugin-pwa` para manifest, service worker y caching.
- Estrategia inicial recomendada:
  - cache-first para assets estaticos,
  - network-first para catalogo y zonas.

## Testing Recomendado

- Vitest para funciones puras:
  - calculo de precios,
  - validacion de modificadores,
  - generador de recibo WhatsApp.
- React Testing Library para flujos clave:
  - agregar producto simple,
  - agregar producto con variante y extras,
  - checkout para llevar,
  - checkout delivery fuera/dentro de zona.
- Playwright para prueba end-to-end mobile:
  - navegar catalogo,
  - agregar al carrito,
  - completar delivery,
  - validar URL final de `wa.me`.

---

# Entregables Sugeridos para la Proxima Sesion

1. Crear app publica dentro del mismo repo o como workspace separado, manteniendo acceso al cliente Supabase.
2. Implementar lectores de catalogo y zonas con modelos normalizados.
3. Crear store de carrito y funciones puras de pricing.
4. Construir UI mobile-first de catalogo y detalle de producto.
5. Implementar checkout condicional.
6. Integrar Google Maps para validacion de delivery.
7. Implementar generador de mensaje WhatsApp y redireccion.
8. Agregar pruebas unitarias de pricing y recibo.
