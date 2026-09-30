export const $ = s => document.querySelector(s);
export const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const toast = (text, erro = false) => Toastify({
  text, duration: 2800, gravity: 'top', position: 'center', stopOnFocus: true,
  className: erro ? 'toast erro' : 'toast',
}).showToast();
