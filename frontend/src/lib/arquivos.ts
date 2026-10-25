import { api } from '@/servicos/api';

/**
 * Baixa um arquivo autenticado da API e aciona o download no navegador. Um
 * `<a href>` puro nao carrega o header `Authorization`, entao a requisicao
 * passa pelo cliente axios (com o token) e o arquivo chega como blob.
 */
export async function baixarArquivo(url: string, nomeArquivo: string): Promise<void> {
  const resposta = await api.get<Blob>(url, { responseType: 'blob' });
  const urlObjeto = URL.createObjectURL(resposta.data);
  const link = document.createElement('a');
  link.href = urlObjeto;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // setTimeout, nao revogar na hora: alguns navegadores iniciam o download
  // de forma assincrona apos o click, e revogar cedo demais cancela o
  // download nesses casos.
  setTimeout(() => URL.revokeObjectURL(urlObjeto), 0);
}
