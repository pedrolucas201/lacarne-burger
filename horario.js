// Funcionamento: quarta a sábado, 18h às 22h (horário de Recife)
export const HORARIO = { dias: [3, 4, 5, 6], abre: 18, fecha: 22, texto: 'Quarta a sábado · 18h às 22h' };
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// dia da semana (0 = domingo) e minutos desde 00:00, no fuso da loja, não no do cliente
export function agora(data = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Recife', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(data).map(x => [x.type, x.value]));
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: +p.hour * 60 + +p.minute };
}

export const aberto = ({ dia, min } = agora()) =>
  HORARIO.dias.includes(dia) && min >= HORARIO.abre * 60 && min < HORARIO.fecha * 60;

export function proximaAbertura({ dia, min } = agora()) {
  for (let i = 0; i < 8; i++) {
    const d = (dia + i) % 7;
    if (HORARIO.dias.includes(d) && (i > 0 || min < HORARIO.abre * 60))
      return `${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[d]} às ${HORARIO.abre}h`;
  }
}
