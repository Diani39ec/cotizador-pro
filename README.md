# Cotizador Pro — Sistema de Cotizaciones Automáticas

![Desarrollado por Diana Trujillo](https://img.shields.io/badge/Autora-Diana%20Trujillo-6366f1?style=for-the-badge&logo=github)
![Estado](https://img.shields.io/badge/Estado-Profesional-10b981?style=for-the-badge)
![Licencia](https://img.shields.io/badge/Licencia-MIT-3b82f6?style=for-the-badge)

## Descripción

Aplicación **Node.js + Express** para calcular y generar cotizaciones profesionales de servicios en tiempo real: autenticación con JWT, base de datos SQLite (`sql.js`), generación de PDFs (`pdfkit`), sistema de licencias con HMAC y frontend estático servido desde `public/`. Endurecida con `helmet`, `cors`, compresión y rate-limiting.

## Demo

- Repositorio: <https://github.com/Diani39ec/cotizador-pro>
- Demo local (Laragon): `http://cotizador-pro.test`
- Demo dev: `npm run dev` → `http://localhost:3000`

## Características

- Auth JWT (login con límite de intentos) y contraseñas con `bcryptjs`
- CRUD de cotizaciones con persistencia SQLite
- Exportación a PDF
- Generador/verificador de licencias (`npm run generate-license`)
- Rate limiting en `/api/` y cabeceras seguras con Helmet

## Tecnologías

`Node.js` `Express` `SQLite (sql.js)` `jsonwebtoken` `bcryptjs` `pdfkit` `helmet` `express-rate-limit` `JavaScript` `HTML5` `CSS3`

## Instalación

```bash
git clone https://github.com/Diani39ec/cotizador-pro.git
cd cotizador-pro
npm install
cp .env.example .env   # y completa tus secretos
npm run dev            # servidor de desarrollo (src/server.js)
npm start              # servidor de producción
```

> Este proyecto es un backend + frontend estático: no tiene script `npm run build`. El frontend vive en `public/`.

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | `tu_jwt_secret_largo_y_aleatorio` |
| `LICENSE_SECRET` | Secreto HMAC del generador de licencias | `tu_license_secret` |
| `DB_ENCRYPTION_KEY` | Clave de cifrado de datos sensibles | `tu_db_key` |
| `LICENSE_KEY` | Licencia de despliegue | `tu_license_key` |
| `APP_NAME` / `APP_VERSION` | Metadatos de la app | `CotizadorPro` / `1.0.0` |

> Seguridad: los secretos se leen vía `process.env` (con `dotenv`). El `.env` real está en `.gitignore` y nunca se sube. Los valores por defecto en el código son solo fallbacks de desarrollo: defínelos siempre en producción.

## Autora

**Diana Trujillo © 2026**
Desarrolladora de Software — GitHub: [Diani39ec](https://github.com/Diani39ec)

## Licencia

MIT. Consulta el archivo `LICENSE` para más detalles.

## Estructura del proyecto
```
cotizador-pro/
├── src/server.js (Express + helmet + rate-limit + JWT)
├── src/database.js (sql.js) · src/pdf-generator.js (pdfkit) · src/license-generator.js
├── public/ (index.html + css/ + js/ — frontend del cotizador)
├── data/cotizador.db (base embebida) · .env / .env.example
└── scripts: start · dev · generate-license
```
Stack: Node.js + Express + SQLite (sql.js) + PDFKit + JWT.
