// Horário vem da loja no banco: { dias: [3, 4, 5, 6], abre: 18, fecha: 22, texto: 'Quarta a sábado · 18h às 22h' }
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// dia da semana (0 = domingo) e minutos desde 00:00, no fuso da loja, não no do cliente
export function agora(data = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Recife', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(data).map(x => [x.type, x.value]));
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: +p.hour * 60 + +p.minute };
}

// data de hoje no fuso da loja, 'AAAA-MM-DD' (é o que os botões do painel gravam)
export const hoje = (data = new Date()) => data.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });

export const noHorario = (h, { dia, min } = agora()) =>
  h.dias.includes(dia) && min >= h.abre * 60 && min < h.fecha * 60;

// "fechar hoje" vence tudo; "abrir hoje" vence o horário; os dois só valem na data gravada
export const lojaAberta = (loja, t = agora(), dataHoje = hoje()) =>
  loja.fechadaHoje !== dataHoje && (noHorario(loja.horario, t) || loja.abertaHoje === dataHoje);

export function proximaAbertura(h, { dia, min } = agora(), pularHoje = false) {
  for (let i = pularHoje ? 1 : 0; i < 8; i++) {
    const d = (dia + i) % 7;
    if (h.dias.includes(d) && (i > 0 || min < h.abre * 60))
      return `${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[d]} às ${h.abre}h`;
  }
}
