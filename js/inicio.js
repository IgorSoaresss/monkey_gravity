import { carregarPreferencias, preencherConfiguracoes, salvarPreferencias } from './preferencias.js';

const preferences = carregarPreferencias();
const form = document.querySelector('#launch-form');
const blueInput = document.querySelector('#player-blue');
const redInput = document.querySelector('#player-red');
const error = document.querySelector('#form-error');

preencherConfiguracoes(document, preferences, salvarPreferencias);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const blueName = blueInput.value.trim();
  const redName = redInput.value.trim();
  if (!blueName || !redName || blueName.length > 20 || redName.length > 20) {
    error.textContent = 'Informe os dois nomes, com até 20 caracteres cada.';
    (!blueName ? blueInput : redInput).focus();
    return;
  }

  const params = new URLSearchParams({ jogador1: blueName, jogador2: redName });
  window.location.assign(`jogo.html?${params.toString()}`);
});

for (const input of [blueInput, redInput]) {
  input.addEventListener('input', () => {
    error.textContent = '';
    input.value = input.value.slice(0, 20);
  });
}