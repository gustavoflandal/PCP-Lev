// Teste de carga (k6) -- rode com e2e/carga/run.sh. Usuarios simultaneos de
// uma fabrica (ate 30) navegando pelas listas mais usadas, com uma escrita de
// vez em quando (preferencias, que passa pela trilha de auditoria).
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://frontend/api/v1';

export const options = {
  scenarios: {
    fabrica: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{tipo:leitura}': ['p(95)<300'],
    'http_req_duration{tipo:escrita}': ['p(95)<800'],
    'http_req_failed': ['rate<0.01'],
  },
};

const LISTAS = [
  '/fornecedores?pagina=1&por_pagina=20',
  '/partes-pecas?pagina=1&por_pagina=20',
  '/partes-pecas?pagina=1&por_pagina=20&busca=CARGA-01',
  '/estoque?pagina=1&por_pagina=20',
  '/estoque/criticos',
  '/pedidos-compra?pagina=1&por_pagina=20',
  '/pedidos-compra/em-atraso',
  '/necessidade-compra',
  '/kanban',
  '/ops?pagina=1&por_pagina=20',
  '/notas-entrada?pagina=1&por_pagina=20',
  '/lotes',
  // Paineis: agregacoes sobre o historico inteiro (as TVs da fabrica as
  // repetem a cada minuto).
  '/paineis/inicio',
  '/paineis/compras?dias=365',
  '/paineis/estoque?dias=365',
  '/paineis/producao?dias=90',
  '/paineis/vendas?dias=365',
  '/paineis/qualidade?dias=90',
];

// Um usuario por perfil de uso; o login acontece uma vez (setup), como na
// fabrica, onde a sessao dura o turno.
export function setup() {
  const r = http.post(`${BASE}/auth/login`, JSON.stringify({ username: 'admin', password: 'Admin@123' }),
    { headers: { 'Content-Type': 'application/json' } });
  check(r, { 'login ok': (x) => x.status === 200 });
  return { token: r.json('access_token') };
}

export default function (dados) {
  const cab = { headers: { Authorization: `Bearer ${dados.token}`, 'Content-Type': 'application/json' } };
  const rota = LISTAS[Math.floor(Math.random() * LISTAS.length)];
  const r = http.get(`${BASE}${rota}`, { ...cab, tags: { tipo: 'leitura', rota } });
  check(r, { 'leitura 200': (x) => x.status === 200 });
  if (Math.random() < 0.1) {
    const w = http.put(`${BASE}/auth/preferencias`,
      JSON.stringify({ tema: 'claro', alto_contraste: false, densidade: 'confortavel', tamanho_fonte: 'padrao' }),
      { ...cab, tags: { tipo: 'escrita' } });
    check(w, { 'escrita 200': (x) => x.status === 200 });
  }
  sleep(1);
}
