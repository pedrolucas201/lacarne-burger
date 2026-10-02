export const $ = s => document.querySelector(s);
export const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// janela aberta (md-dialog) fica numa camada acima da página e escondia o aviso:
// como popover, o aviso entra nessa mesma camada, por cima da janela
export const toast = (text, erro = false) => {
  const t = Toastify({
    text, duration: 2800, gravity: 'top', position: 'center', stopOnFocus: true,
    className: erro ? 'toast erro' : 'toast',
  }).showToast();
  const el = t.toastElement;
  if (el?.showPopover) { el.popover = 'manual'; el.showPopover(); }
  return t;
};
