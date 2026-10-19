import { LEVELS } from './dados-fases.js';
import { carregarPreferencias, preencherConfiguracoes, normalizarTecla, rotuloTecla, salvarPreferencias } from './preferencias.js';
import { ControladorEntrada, Jogo, SistemaPontuacao, intersects } from './modelos.js';

const params = new URLSearchParams(window.location.search);
const names = { blue: (params.get('jogador1') || '').trim(), red: (params.get('jogador2') || '').trim() };
const nameError = document.querySelector('#name-error');
const gameApp = document.querySelector('#game-app');
const namesAreValid = names.blue.length > 0 && names.blue.length <= 20 && names.red.length > 0 && names.red.length <= 20;

class AudioFeedback {
  constructor(getVolume) { this.getVolume = getVolume; this.context = null; }

  play(type) {
    const volume = this.getVolume() / 100;
    if (volume <= 0 || !window.AudioContext) return;
    try {
      this.context ||= new window.AudioContext();
      if (this.context.state === 'suspended') this.context.resume();
      const notes = { start: 420, jump: 240, plate: 540, door: 330, gravity: 680, core: 780, failure: 125, complete: 620 };
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type === 'failure' ? 'sawtooth' : 'square';
      oscillator.frequency.value = notes[type] || 420;
      gain.gain.setValueAtTime(.0001, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume * .035), this.context.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + .13);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + .14);
    } catch { /* Audio is optional; gameplay must remain available. */ }
  }
}

if (!namesAreValid) {
  nameError.hidden = false;
  document.querySelector('#restart-button').disabled = true;
  document.querySelector('#pause-button').disabled = true;
} else {
  gameApp.hidden = false;
  iniciarJogo();
}

function iniciarJogo() {
  const preferences = carregarPreferencias();
  const scoring = new SistemaPontuacao();
  const game = new Jogo(LEVELS, names, scoring);
  const input = new ControladorEntrada();
  const canvas = document.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  const ui = {
    state: 'selection',
    failureUntil: 0,
    historyRows: 0,
    animationTime: 0,
    terminalFlashUntil: 0
  };
  const stars = Array.from({ length: 90 }, (_, index) => ({
    x: (index * 197 + 73) % 1280,
    y: (index * 113 + 41) % 580,
    size: index % 9 === 0 ? 2 : 1,
    phase: index % 7
  }));
  const screens = {
    selection: document.querySelector('#screen-selection'),
    paused: document.querySelector('#screen-pause'),
    complete: document.querySelector('#screen-complete'),
    ending: document.querySelector('#screen-ending'),
    failure: document.querySelector('#screen-failure')
  };
  const audio = new AudioFeedback(() => preferences.volume);

  document.querySelector('#blue-name').textContent = names.blue;
  document.querySelector('#red-name').textContent = names.red;
  document.querySelector('#th-blue').textContent = names.blue;
  document.querySelector('#th-red').textContent = names.red;
  document.querySelector('#selection-names').textContent = `${names.blue} + ${names.red}`;
  buildLevelOptions();
  preencherConfiguracoes(document, preferences, salvarPreferencias);
  document.querySelector('#clear-history').addEventListener('click', clearHistory);
  document.querySelector('#clear-activity').addEventListener('click', clearActivity);
  document.querySelector('#restart-button').addEventListener('click', restartLevel);
  document.querySelector('#pause-button').addEventListener('click', togglePause);
  document.querySelector('#resume-button').addEventListener('click', resumeGame);
  document.querySelector('#pause-restart-button').addEventListener('click', restartLevel);
  document.querySelector('#next-button').addEventListener('click', () => startLevel(Math.min(5, game.phase.data.id + 1)));
  document.querySelector('#replay-button').addEventListener('click', () => startLevel(game.phase.data.id));
  document.querySelector('#ending-replay-button').addEventListener('click', () => startLevel(1));
  document.querySelector('#pause-settings-toggle').addEventListener('click', (event) => {
    const panel = document.querySelector('#game-settings');
    panel.open = !panel.open;
    event.currentTarget.setAttribute('aria-expanded', String(panel.open));
    event.currentTarget.querySelector('span').textContent = panel.open ? '−' : '+';
    if (panel.open) panel.scrollIntoView({ behavior: preferences.reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
  });

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', () => { if (ui.state === 'playing') pauseGame(); input.clear(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ui.state === 'playing') pauseGame();
    input.clear();
  });
  window.addEventListener('resize', draw);

  function buildLevelOptions() {
    const container = document.querySelector('#level-options');
    container.replaceChildren();
    for (const level of LEVELS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-option';
      button.disabled = level.id > preferences.unlocked;
      button.setAttribute('aria-label', `Iniciar fase ${level.id}, ${level.name}${button.disabled ? ', bloqueada' : ''}`);
      const number = document.createElement('strong');
      number.textContent = String(level.id).padStart(2, '0');
      const title = document.createElement('span');
      title.textContent = button.disabled ? 'BLOQUEADA' : level.name.toUpperCase();
      button.append(number, title);
      button.addEventListener('click', () => startLevel(level.id));
      container.append(button);
    }
  }

  function setState(nextState) {
    ui.state = nextState;
    input.clear();
    for (const [name, screen] of Object.entries(screens)) screen.hidden = name !== nextState;
    const active = nextState === 'playing';
    document.querySelector('#pause-button').disabled = !active && nextState !== 'paused';
    document.querySelector('#restart-button').disabled = !['playing', 'paused'].includes(nextState);
    document.querySelector('#pause-button').setAttribute('aria-pressed', String(nextState === 'paused'));
    document.querySelector('#pause-button').textContent = nextState === 'paused' ? '▶' : 'Ⅱ';
    document.querySelector('#pause-button').setAttribute('aria-label', nextState === 'paused' ? 'Retomar partida' : 'Pausar partida');
    document.body.classList.toggle('paused', nextState === 'paused');
    document.body.classList.toggle('completed', nextState === 'complete' || nextState === 'ending');
    document.querySelector('.live-indicator').innerHTML = active
      ? '<i></i> SIMULAÇÃO ATIVA'
      : `<i></i> ${nextState === 'paused' ? 'EM PAUSA' : nextState === 'failure' ? 'REINICIANDO' : 'EM ESPERA'}`;
  }

  function startLevel(levelId) {
    scoring.resetAttempt();
    game.start(levelId);
    const level = game.phase.data;
    document.querySelector('#level-title').textContent = `${String(level.id).padStart(2, '0')} / ${level.name.toUpperCase()}`;
    document.querySelector('#phase-kicker').textContent = `SETOR ${String(level.id).padStart(2, '0')} · ${level.name.toUpperCase()}`;
    document.querySelector('#phase-description').textContent = level.description.toUpperCase();
    document.querySelector('#objective-text').textContent = level.instruction;
    document.querySelector('#result-sector').textContent = String(level.id).padStart(2, '0');
    setState('playing');
    addActivity(`Setor ${String(level.id).padStart(2, '0')} · ${level.name}. ${level.instruction}`);
    audio.play('start');
    syncUI();
    draw();
  }

  function restartLevel() {
    if (!['playing', 'paused'].includes(ui.state)) return;
    const levelId = game.phase.data.id;
    game.restart();
    setState('playing');
    document.querySelector('#objective-text').textContent = game.phase.data.instruction;
    addActivity(`Setor ${String(levelId).padStart(2, '0')} reiniciado. Pontos provisórios removidos.`);
    syncUI();
  }

  function pauseGame() {
    if (ui.state !== 'playing') return;
    setState('paused');
  }

  function resumeGame() {
    if (ui.state !== 'paused') return;
    setState('playing');
  }

  function togglePause() {
    if (ui.state === 'playing') pauseGame();
    else if (ui.state === 'paused') resumeGame();
  }

  function handleKeyDown(event) {
    if (!namesAreValid) return;
    const key = normalizarTecla(event.key);
    if (key === 'Escape') {
      event.preventDefault();
      togglePause();
      return;
    }
    if (key === 'r' && ['playing', 'paused'].includes(ui.state)) {
      event.preventDefault();
      restartLevel();
      return;
    }
    if (!['playing', 'paused'].includes(ui.state) || !Object.values(preferences.controls).includes(key)) return;
    event.preventDefault();
    if (!input.press(key) || ui.state !== 'playing') return;

    const controls = preferences.controls;
    if (key === controls.blueJump) game.phase.jump('blue');
    if (key === controls.redJump) game.phase.jump('red');
    if (key === controls.blueInteract && game.phase.interact('blue')) ui.terminalFlashUntil = performance.now() + 300;
    if (key === controls.redInteract && game.phase.interact('red')) ui.terminalFlashUntil = performance.now() + 300;
    handleEvents(game.phase.drainEvents());
    syncUI();
  }

  function handleKeyUp(event) { input.release(normalizarTecla(event.key)); }

  function update(delta) {
    if (ui.state !== 'playing') return;
    if (ui.failureUntil && performance.now() >= ui.failureUntil) {
      ui.failureUntil = 0;
      restartLevel();
      return;
    }
    const controls = preferences.controls;
    game.phase.step(delta, {
      blue: { left: input.held.has(controls.blueLeft), right: input.held.has(controls.blueRight) },
      red: { left: input.held.has(controls.redLeft), right: input.held.has(controls.redRight) }
    });
    handleEvents(game.phase.drainEvents());
    syncUI();
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event.type === 'jump') audio.play('jump');
      if (event.type === 'plate') {
        if (event.points) addActivity(`${event.player?.name || 'Tripulação'} ativou a placa ${event.plate.color === 'blue' ? 'azul' : 'vermelha'}. +${event.points} pontos.`);
        else addActivity(`${event.player?.name || 'Tripulação'} acionou uma placa já pontuada.`);
        audio.play('plate');
      }
      if (event.type === 'door') {
        addActivity(`A passagem ${event.door.id === 'floor-gate' ? 'do piso' : 'do teto'} foi liberada.`);
        audio.play('door');
      }
      if (event.type === 'gravity') {
        addActivity(`${event.player.name} inverteu a gravidade da dupla.`);
        document.querySelector('#objective-text').textContent = game.phase.data.requiredInversions > game.phase.inversionCount
          ? game.phase.data.instruction
          : 'Gravidade invertida. Reúnam-se nas saídas da mesma cor.';
        audio.play('gravity');
      }
      if (event.type === 'core') {
        addActivity(`Núcleo restaurado pela dupla. +${event.bluePoints} para cada astronauta.`);
        document.querySelector('#objective-text').textContent = 'Núcleo ativo. Ativem o terminal e alcancem as saídas.';
        audio.play('core');
      }
      if (event.type === 'failure') {
        scoring.resetAttempt();
        ui.failureUntil = performance.now() + 850;
        setState('failure');
        addActivity('Falha de contenção. A tentativa foi reiniciada; pontos provisórios removidos.');
        audio.play('failure');
      }
      if (event.type === 'complete') completeLevel(event.result);
    }
  }

  function completeLevel(result) {
    const level = game.phase.data;
    addHistory(level, result);
    if (!preferences.completed.includes(level.id)) preferences.completed.push(level.id);
    preferences.unlocked = Math.max(preferences.unlocked, Math.min(5, level.id + 1));
    salvarPreferencias(preferences);
    buildLevelOptions();
    addActivity(`A dupla concluiu ${level.name}${result.repeated ? ' novamente, sem novos pontos' : ''}.`);
    document.querySelector('#result-copy').textContent = result.repeated
      ? `Fase repetida. Nenhum ponto adicional nesta sessão. Total da dupla: ${scoring.totals.blue + scoring.totals.red}.`
      : `Próximo setor liberado. ${names.blue}: +${result.blue}. ${names.red}: +${result.red}.`;
    const final = level.id === 5;
    document.querySelector('#next-button').hidden = final;
    setState(final ? 'ending' : 'complete');
    audio.play(final ? 'core' : 'complete');
  }

  function syncUI() {
    const phase = game.phase;
    if (!phase) return;
    for (const player of phase.players) {
      const isBlue = player.id === 'blue';
      const indicator = document.querySelector(isBlue ? '#blue-gravity' : '#red-gravity');
      const up = player.gravity < 0;
      indicator.classList.toggle('gravidade-cima', up);
      indicator.classList.toggle('gravidade-baixo', !up);
      indicator.querySelector('.gravity-arrow').textContent = up ? '↑' : '↓';
      indicator.querySelector('.gravity-label').textContent = up ? 'GRAVIDADE PARA CIMA' : 'GRAVIDADE PARA BAIXO';
    }
    document.querySelector('#blue-score').textContent = String(scoring.getScore('blue'));
    document.querySelector('#red-score').textContent = String(scoring.getScore('red'));
    document.querySelector('#team-score').textContent = String(scoring.getScore('blue') + scoring.getScore('red'));
    document.querySelector('#gravity-status').innerHTML = phase.players.map((player) => `${player.gravity > 0 ? '↓' : '↑'} ${player.id === 'blue' ? 'AZUL' : 'VERMELHO'}`).join(' <i></i> ');
    const provisional = scoring.provisional.blue + scoring.provisional.red;
    document.querySelector('#score-note').textContent = provisional
      ? `${provisional} ponto(s) provisório(s). Reiniciar remove estes pontos.`
      : 'Pontos provisórios aparecem durante a tentativa.';
  }

  function addActivity(text) {
    const list = document.querySelector('#activity-list');
    const item = document.createElement('li');
    item.textContent = text;
    list.append(item);
    while (list.children.length > 8) list.firstElementChild.remove();
    document.querySelector('#activity-empty').hidden = list.children.length > 0;
    document.querySelector('#clear-activity').disabled = list.children.length === 0;
    document.querySelector('#activity-count').textContent = `${list.children.length} / 8`;
  }

  function clearActivity() {
    document.querySelector('#activity-list').replaceChildren();
    document.querySelector('#activity-empty').hidden = false;
    document.querySelector('#clear-activity').disabled = true;
    document.querySelector('#activity-count').textContent = '0 / 8';
  }

  function addHistory(level, result) {
    const row = document.createElement('tr');
    const cells = [
      `${String(level.id).padStart(2, '0')} ${level.name}${result.repeated ? ' · REPETIÇÃO' : ''}`,
      String(result.blue), String(result.red), String(result.blue + result.red)
    ];
    for (const value of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const action = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-record';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Excluir registro da fase ${level.name}`);
    remove.addEventListener('click', () => { row.remove(); refreshHistory(); });
    action.append(remove);
    row.append(action);
    document.querySelector('#history-body').append(row);
    ui.historyRows += 1;
    refreshHistory();
  }

  function clearHistory() {
    document.querySelector('#history-body').replaceChildren();
    refreshHistory();
  }

  function refreshHistory() {
    const body = document.querySelector('#history-body');
    const count = body.children.length;
    document.querySelector('#history-empty').hidden = count > 0;
    document.querySelector('#clear-history').disabled = count === 0;
    document.querySelector('#history-count').textContent = String(count);
  }

  function draw() {
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 1280, 720);
    drawBackdrop();
    const phase = game.phase;
    if (!phase) return;
    drawPlatforms(phase);
    drawExits(phase);
    drawPlates(phase);
    drawDoors(phase);
    drawTerminals(phase);
    drawHazards(phase);
    drawCore(phase);
    for (const player of phase.players) drawMonkey(player);
    if (preferences.reducedMotion) return;
    ui.animationTime += 1 / 60;
    if (phase.exitHold > 0) drawExitProgress(phase.exitHold);
  }

  function drawBackdrop() {
    const sky = context.createLinearGradient(0, 0, 0, 720);
    sky.addColorStop(0, '#172631');
    sky.addColorStop(.53, '#101b24');
    sky.addColorStop(1, '#18252b');
    context.fillStyle = sky;
    context.fillRect(0, 0, 1280, 720);
    for (const star of stars) {
      context.globalAlpha = .35 + Math.sin(ui.animationTime * .8 + star.phase) * .15;
      context.fillStyle = star.phase === 0 ? '#d8f36b' : '#b3c8d0';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;

    context.fillStyle = '#263942';
    context.fillRect(35, 196, 180, 120);
    context.fillRect(1065, 180, 176, 138);
    context.fillStyle = '#13232a';
    context.fillRect(44, 205, 162, 102);
    context.fillRect(1074, 189, 158, 120);
    context.fillStyle = '#4d7882';
    context.fillRect(48, 280, 151, 26);
    context.fillRect(1078, 282, 149, 25);
    context.fillStyle = '#273b43';
    context.fillRect(88, 218, 2, 88);
    context.fillRect(155, 218, 2, 88);
    context.fillRect(1141, 200, 2, 106);
    context.fillRect(1190, 200, 2, 106);
    context.fillStyle = '#d8f36b';
    context.fillRect(55, 169, 50, 3);
    context.fillRect(1103, 155, 42, 3);

    context.fillStyle = '#202e34';
    context.fillRect(0, 618, 1280, 28);
    context.fillRect(0, 74, 1280, 17);
    context.fillStyle = '#708087';
    context.fillRect(0, 644, 1280, 3);
    context.fillRect(0, 90, 1280, 2);
    for (let x = 20; x < 1280; x += 80) {
      context.fillStyle = '#10181c';
      context.fillRect(x, 650, 2, 70);
      context.fillRect(x, 74, 2, 14);
    }
    context.fillStyle = '#d8f36b';
    context.fillRect(0, 645, 1280, 2);
  }

  function drawPlatforms(phase) {
    for (const platform of phase.platforms) {
      if (platform.id === 'floor' || platform.id === 'ceiling') continue;
      context.fillStyle = '#35464d';
      context.fillRect(platform.x, platform.y, platform.w, platform.h);
      context.fillStyle = '#829197';
      context.fillRect(platform.x, platform.y, platform.w, 3);
      context.fillStyle = '#1b282d';
      for (let x = platform.x + 14; x < platform.x + platform.w; x += 28) context.fillRect(x, platform.y + 5, 2, platform.h - 7);
      context.fillStyle = '#d8f36b';
      context.fillRect(platform.x + 7, platform.y + 7, 4, 3);
    }
  }

  function drawPlates(phase) {
    for (const plate of phase.plates) {
      const y = plate.surface === 'floor' ? 632 : 94;
      const color = plate.active ? '#d8f36b' : plate.color === 'blue' ? '#42b8ef' : '#ff695d';
      context.fillStyle = '#11191e';
      context.fillRect(plate.x - 5, y, plate.w + 10, 14);
      context.fillStyle = color;
      context.fillRect(plate.x, y + (plate.active ? 1 : 5), plate.w, plate.active ? 5 : 3);
      context.fillStyle = plate.active ? '#d8f36b' : '#75848a';
      context.fillRect(plate.x + 5, y + 2, 3, 3);
      context.fillRect(plate.x + plate.w - 8, y + 2, 3, 3);
    }
  }

  function drawDoors(phase) {
    for (const door of phase.doors) {
      const bounds = door.bounds;
      context.fillStyle = door.open ? '#253c39' : '#712f35';
      context.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      context.fillStyle = door.open ? '#d8f36b' : '#ff695d';
      for (let y = bounds.y + 8; y < bounds.y + bounds.h; y += 19) {
        context.fillRect(bounds.x + 5, y, bounds.w - 10, door.open ? 3 : 7);
      }
      context.fillStyle = door.latched ? '#d8f36b' : '#e6d1b3';
      context.fillRect(bounds.x + bounds.w / 2 - 3, bounds.y - 7, 6, 5);
      if (door.latched) {
        context.fillStyle = '#d8f36b';
        context.fillRect(bounds.x + bounds.w / 2 - 2, bounds.y + bounds.h / 2, 4, 4);
      }
    }
  }

  function drawTerminals(phase) {
    for (const terminal of phase.terminals) {
      const active = terminal.uses > 0;
      const pulse = preferences.reducedMotion ? 0 : Math.sin(ui.animationTime * 3) * 3;
      context.fillStyle = '#10181c';
      context.fillRect(terminal.x - 50, 310, 100, 91);
      context.fillStyle = active ? '#47764f' : '#2d596a';
      context.fillRect(terminal.x - 38, 322, 76, 63);
      context.fillStyle = active ? '#d8f36b' : '#42b8ef';
      context.fillRect(terminal.x - 25, 333, 50, 4);
      context.fillRect(terminal.x - 15, 347, 30, 4);
      context.fillRect(terminal.x - 5, 360, 10, 9);
      context.fillStyle = '#a8bbc0';
      context.fillRect(terminal.x - 44, 392, 88, 9);
      context.fillStyle = active ? '#d8f36b' : '#ff695d';
      context.fillRect(terminal.x - 3, 304 - pulse, 6, 6);
      context.fillStyle = '#41535a';
      context.fillRect(terminal.x - 61, 401, 122, 7);
    }
  }

  function drawHazards(phase) {
    for (const hazard of phase.hazards) {
      context.fillStyle = '#5b282d';
      context.fillRect(hazard.x - 5, hazard.y - 5, hazard.w + 10, hazard.h + 10);
      context.fillStyle = '#ff695d';
      context.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
      context.fillStyle = '#ffd58b';
      for (let x = hazard.x + 4; x < hazard.x + hazard.w; x += 13) context.fillRect(x, hazard.y + 3, 5, hazard.h - 6);
      context.fillStyle = '#ff695d';
      context.fillRect(hazard.x, hazard.y - 10, 6, 3);
      context.fillRect(hazard.x + hazard.w - 6, hazard.y - 10, 6, 3);
    }
  }

  function drawExits(phase) {
    for (const exit of phase.exits) {
      const y = exit.surface === 'floor' ? 584 : 94;
      const hue = exit.player === 'blue' ? '#42b8ef' : '#ff695d';
      context.fillStyle = '#273940';
      context.fillRect(1110, y, 78, 62);
      context.fillStyle = hue;
      context.fillRect(1117, y + 7, 64, 4);
      context.fillRect(1117, y + 7, 4, 48);
      context.fillRect(1177, y + 7, 4, 48);
      context.fillRect(1117, y + 51, 64, 4);
      context.fillStyle = '#162329';
      context.fillRect(1125, y + 15, 48, 36);
      context.fillStyle = hue;
      context.fillRect(1145, y + 26, 8, 16);
      context.fillRect(1138, y + 32, 22, 3);
      context.fillStyle = '#d8f36b';
      context.fillRect(1146, y - 8, 7, 4);
    }
  }

  function drawCore(phase) {
    if (!phase.data.corePlates.length) return;
    const x = 1040;
    const y = 330;
    context.fillStyle = '#344149';
    context.fillRect(x - 34, y - 42, 68, 92);
    context.fillStyle = phase.coreRestored ? '#d8f36b' : '#ff695d';
    context.fillRect(x - 18, y - 28, 36, 64);
    context.fillStyle = '#152128';
    context.fillRect(x - 11, y - 21, 22, 50);
    context.fillStyle = phase.coreRestored ? '#d8f36b' : '#ac403d';
    context.fillRect(x - 5, y - 16, 10, 40);
    context.fillRect(x - 27, y + 52, 54, 7);
    if (phase.coreRestored) {
      context.fillStyle = '#d8f36b';
      context.fillRect(x - 4, y - 2, 8, 8);
    }
  }

  function drawMonkey(player) {
    const stride = player.grounded && player.vx !== 0 ? Math.round(Math.sin(player.walkTime) * 3) : 0;
    const suit = player.id === 'blue' ? '#42b8ef' : '#ff695d';
    const outline = '#11171b';
    context.save();
    context.translate(Math.round(player.centerX), Math.round(player.centerY));
    if (player.gravity < 0) context.rotate(Math.PI);
    context.translate(-15, -19);

    context.fillStyle = outline;
    context.fillRect(4, 2, 22, 22);
    context.fillRect(2, 7, 3, 11);
    context.fillRect(25, 7, 3, 11);
    context.fillStyle = '#d4a47e';
    context.fillRect(5, 4, 20, 17);
    context.fillRect(2, 10, 4, 6);
    context.fillRect(24, 10, 4, 6);
    context.fillStyle = '#432f2b';
    context.fillRect(5, 11, 3, 3);
    context.fillRect(22, 11, 3, 3);
    context.fillStyle = '#18232a';
    context.fillRect(9, 10, 3, 4);
    context.fillRect(19, 10, 3, 4);
    context.fillRect(13, 16, 5, 2);
    context.fillStyle = '#e9d9c7';
    context.fillRect(9, 7, 3, 2);
    context.fillRect(19, 7, 3, 2);

    context.fillStyle = outline;
    context.fillRect(1, 0, 28, 5);
    context.fillRect(1, 3, 4, 19);
    context.fillRect(25, 3, 4, 19);
    context.fillRect(5, 21, 20, 4);
    context.fillStyle = '#c7d9db';
    context.fillRect(5, 2, 20, 2);
    context.fillRect(3, 5, 2, 13);
    context.fillRect(25, 5, 2, 13);
    context.fillStyle = '#55747d';
    context.fillRect(6, 4, 18, 2);
    context.fillStyle = '#d9f3f1';
    context.fillRect(8, 5, 4, 2);

    context.fillStyle = outline;
    context.fillRect(5, 24, 20, 15);
    context.fillStyle = suit;
    context.fillRect(7, 25, 16, 12);
    context.fillStyle = player.id === 'blue' ? '#a2e8ff' : '#ffc0a6';
    context.fillRect(10, 27, 10, 2);
    context.fillStyle = '#e9e7dc';
    context.fillRect(13, 30, 4, 4);
    context.fillStyle = '#26343b';
    context.fillRect(3, 27, 4, 9);
    context.fillRect(23, 27, 4, 9);
    context.fillStyle = outline;
    context.fillRect(7, 37, 6, 2 + Math.max(0, stride));
    context.fillRect(17, 37, 6, 2 + Math.max(0, -stride));
    context.fillStyle = '#e9e7dc';
    context.fillRect(7, 38 + Math.max(0, stride), 6, 2);
    context.fillRect(17, 38 + Math.max(0, -stride), 6, 2);
    context.fillStyle = '#d8f36b';
    context.fillRect(4, 30, 2, 3);
    context.restore();

    context.fillStyle = suit;
    context.font = '10px monospace';
    context.textAlign = 'center';
    context.fillText(player.name.slice(0, 13), player.centerX, player.gravity > 0 ? player.y - 8 : player.y + player.h + 15);
  }

  function drawExitProgress(progress) {
    const width = Math.min(120, progress / .5 * 120);
    context.fillStyle = '#0f171dcc';
    context.fillRect(580, 438, 120, 8);
    context.fillStyle = '#d8f36b';
    context.fillRect(580, 438, width, 8);
  }

  function frame(timestamp) {
    const elapsed = Math.min(.1, Math.max(0, (timestamp - (frame.last || timestamp)) / 1000));
    frame.last = timestamp;
    if (ui.state === 'playing') {
      frame.accumulator = Math.min(.1, (frame.accumulator || 0) + elapsed);
      while (frame.accumulator >= 1 / 60) {
        update(1 / 60);
        frame.accumulator -= 1 / 60;
      }
    } else {
      frame.accumulator = 0;
      if (ui.state === 'failure' && ui.failureUntil && timestamp >= ui.failureUntil) {
        ui.failureUntil = 0;
        restartLevel();
      }
    }
    draw();
    window.requestAnimationFrame(frame);
  }

  setState('selection');
  syncUI();
  window.requestAnimationFrame(frame);
}