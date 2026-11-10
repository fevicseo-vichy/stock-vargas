// Vercel Edge Middleware: pide clave (HTTP Basic Auth) por dominio.
// Las claves NO están aquí: viven en Variables de Entorno de Vercel (PW_VARGAS, PW_CPR, PW_BYC).
export const config = {
  matcher: ['/((?!favicon.ico).*)'],
};

const HOST_ENV = {
  'stock.vargasdiesel.cl': 'PW_VARGAS',
  'stock.comercialcpr.cl': 'PW_CPR',
  'stock.repuestosbyc.cl': 'PW_BYC',
  'stock-vargas.vercel.app': 'PW_VARGAS',
  'stock-cpr.vercel.app': 'PW_CPR',
  'stock-byc.vercel.app': 'PW_BYC',
};

function unauthorized() {
  return new Response('Acceso privado — ingresa la clave.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Acceso privado", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export default function middleware(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  // Clave esperada según el dominio; dominios desconocidos (p.ej. *.vercel.app) usan PW_VARGAS.
  const envName = HOST_ENV[host] || 'PW_VARGAS';
  const expectedPw = process.env[envName];

  // Si no hay clave configurada en el entorno, no bloquear (evita dejar el sitio inaccesible por error de config).
  if (!expectedPw) return;

  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) return unauthorized();

  let decoded = '';
  try {
    decoded = atob(auth.slice(6));
  } catch (e) {
    return unauthorized();
  }
  // Formato usuario:clave — aceptamos cualquier usuario, validamos solo la clave.
  const idx = decoded.indexOf(':');
  const pass = idx >= 0 ? decoded.slice(idx + 1) : decoded;

  if (pass === expectedPw) return; // correcto -> continúa y sirve el sitio
  return unauthorized();
}
