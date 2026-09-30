// Pix copia e cola: BR Code estático no padrão do Banco Central
const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
const ascii = (s, n) => s.normalize('NFD').replace(/[^\x20-\x7E]/g, '').slice(0, n);

export function crc16(s) {
  let crc = 0xFFFF;
  for (const ch of s) {
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// valor vazio = o cliente digita o valor no app do banco
export function pix({ chave, nome, cidade, valor, txid = '***' }) {
  const p = campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') + campo('53', '986') +
    (valor ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') + campo('59', ascii(nome, 25)) + campo('60', ascii(cidade, 15)) +
    campo('62', campo('05', txid)) + '6304';
  return p + crc16(p);
}
