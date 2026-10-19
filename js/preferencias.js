export const STORAGE_KEY = 'monkey-gravity-save';

export const DEFAULT_CONTROLS = Object.freeze({
  blueLeft: 'a',
  blueRight: 'd',
  blueJump: 'w',
  blueInteract: 'e',
  redLeft: 'ArrowLeft',
  redRight: 'ArrowRight',
  redJump: 'ArrowUp',
  redInteract: 'Enter'
});

export function carregarPreferencias() {
  const defaults = { volume: 35, reducedMotion: false, controls: { ...DEFAULT_CONTROLS }, unlocked: 1, completed: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    const controls = { ...DEFAULT_CONTROLS };
    for (const action of Object.keys(controls)) {
      if (typeof saved.controls?.[action] === 'string') controls[action] = normalizarTecla(saved.controls[action]);
    }
    const completed = Array.isArray(saved.completed) ? saved.completed.filter((id) => Number.isInteger(id) && id >= 1 && id <= 5) : [];
    return {
      volume: Number.isFinite(saved.volume) ? Math.min(100, Math.max(0, saved.volume)) : defaults.volume,
      reducedMotion: saved.reducedMotion === true,
      controls,
      unlocked: Number.isInteger(saved.unlocked) ? Math.min(5, Math.max(1, saved.unlocked)) : 1,
      completed
    };
  } catch {
    return defaults;
  }
}

export function salvarPreferencias(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function normalizarTecla(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function rotuloTecla(key) {
  const labels = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ' ': 'Espaço', Enter: 'Enter' };
  return labels[key] || key.toUpperCase();
}

export function preencherConfiguracoes(root, preferences, onSave) {
  const volume = root.querySelector('#volume-setting');
  const output = root.querySelector('#volume-output');
  const motion = root.querySelector('#motion-setting');
  const message = root.querySelector('#settings-message');
  if (!volume || !output || !motion) return;

  volume.value = String(preferences.volume);
  output.value = `${preferences.volume}%`;
  output.textContent = `${preferences.volume}%`;
  motion.checked = preferences.reducedMotion;
  volume.addEventListener('input', () => {
    output.value = `${volume.value}%`;
    output.textContent = `${volume.value}%`;
  });

  let listening = null;
  root.querySelectorAll('.key-bind').forEach((button) => {
    const action = button.dataset.bind;
    button.textContent = rotuloTecla(preferences.controls[action]);
    button.addEventListener('click', () => {
      root.querySelectorAll('.key-bind').forEach((item) => item.classList.remove('is-listening'));
      listening = action;
      button.classList.add('is-listening');
      if (message) message.textContent = 'Pressione uma tecla para atribuir.';
    });
  });

  root.addEventListener('keydown', (event) => {
    if (!listening || event.key === 'Escape' || event.key === 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    const duplicate = Object.entries(preferences.controls).find(([action, key]) => action !== listening && key === normalizarTecla(event.key));
    if (duplicate) {
      if (message) message.textContent = 'Essa tecla já está atribuída a outro comando.';
      return;
    }
    preferences.controls[listening] = normalizarTecla(event.key);
    const button = root.querySelector(`[data-bind="${listening}"]`);
    if (button) {
      button.textContent = rotuloTecla(preferences.controls[listening]);
      button.classList.remove('is-listening');
    }
    listening = null;
    if (message) message.textContent = 'Atalho atualizado. Salve para manter a alteração.';
  });

  root.querySelector('#save-settings')?.addEventListener('click', () => {
    preferences.volume = Number(volume.value);
    preferences.reducedMotion = motion.checked;
    onSave(preferences);
    if (message) message.textContent = 'Configurações salvas neste dispositivo.';
  });
}