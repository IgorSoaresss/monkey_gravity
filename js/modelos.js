export class Plataforma {
  constructor(data) { Object.assign(this, data); }
}

export class Jogador {
  constructor(id, name, x, y, gravity) {
    this.id = id;
    this.name = name;
    this.spawn = { x, y, gravity };
    this.reset();
  }

  reset() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.gravity = this.spawn.gravity;
    this.w = 30;
    this.h = 38;
    this.grounded = true;
    this.supportSurface = this.gravity > 0 ? 'floor' : 'ceiling';
    this.facing = 1;
    this.walkTime = 0;
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
}

export class PlacaPressao {
  constructor(data) {
    Object.assign(this, data);
    this.active = false;
    this.everActivated = false;
  }

  update(players) {
    const supportY = this.surface === 'floor' ? 646 : 92;
    this.active = players.some((player) => player.grounded
      && player.supportSurface === this.surface
      && Math.abs((player.centerX) - (this.x + this.w / 2)) < this.w / 2 + 8
      && Math.abs((this.surface === 'floor' ? player.y + player.h : player.y) - supportY) < 12);
    if (this.active && !this.everActivated) {
      this.everActivated = true;
      return true;
    }
    return false;
  }
}

export class Porta {
  constructor(data) {
    Object.assign(this, data);
    this.open = false;
    this.latched = false;
  }

  get bounds() {
    return { x: this.x, y: this.surface === 'floor' ? 496 : 82, w: this.w, h: 150 };
  }

  update(plates, players) {
    const active = this.plates.every((id) => plates.find((plate) => plate.id === id)?.active);
    const body = this.bounds;
    const occupied = players.some((player) => intersects(player, body));
    this.open = this.latched || active || occupied;
    const crossing = players.find((player) => player.id === this.latchWhen);
    if (active && crossing && crossing.centerX > this.x + this.w + 12) {
      this.latched = true;
      this.open = true;
    }
  }
}

export class TerminalGravidade {
  constructor(data) {
    Object.assign(this, data);
    this.readyAt = 0;
    this.uses = 0;
  }
}

export class CampoEletrico {
  constructor(data) { Object.assign(this, data); }
}

export class Saida {
  constructor(data) { Object.assign(this, data); }

  contains(player) {
    const surfaceY = this.surface === 'floor' ? 646 : 92;
    const playerSurfaceY = this.surface === 'floor' ? player.y + player.h : player.y;
    return player.id === this.player
      && player.gravity === this.gravity
      && player.grounded
      && player.supportSurface === this.surface
      && Math.abs(playerSurfaceY - surfaceY) < 12
      && player.centerX > 1100;
  }
}

export class SistemaPontuacao {
  constructor(awardedPhases = []) {
    this.totals = { blue: 0, red: 0 };
    this.awardedPhases = new Set(awardedPhases);
    this.resetAttempt();
  }

  resetAttempt() { this.provisional = { blue: 0, red: 0 }; }

  add(playerId, points, allowed) {
    if (!allowed) return 0;
    this.provisional[playerId] += points;
    return points;
  }

  complete(phaseId) {
    const repeated = this.awardedPhases.has(phaseId);
    if (!repeated) {
      this.add('blue', 100, true);
      this.add('red', 100, true);
      this.totals.blue += this.provisional.blue;
      this.totals.red += this.provisional.red;
      this.awardedPhases.add(phaseId);
    }
    const result = { blue: repeated ? 0 : this.provisional.blue, red: repeated ? 0 : this.provisional.red, repeated };
    this.resetAttempt();
    return result;
  }

  getScore(playerId) { return this.totals[playerId] + this.provisional[playerId]; }
}

export class ControladorEntrada {
  constructor() { this.held = new Set(); }
  press(key) { const fresh = !this.held.has(key); this.held.add(key); return fresh; }
  release(key) { this.held.delete(key); }
  clear() { this.held.clear(); }
}

export class Fase {
  constructor(data, names, scoring) {
    this.data = data;
    this.name = data.name;
    this.platforms = data.platforms.map((item) => new Plataforma(item));
    this.plates = data.plates.map((item) => new PlacaPressao(item));
    this.doors = data.doors.map((item) => new Porta(item));
    this.terminals = data.terminals.map((item) => new TerminalGravidade(item));
    this.hazards = data.hazards.map((item) => new CampoEletrico(item));
    this.exits = data.exits.map((item) => new Saida(item));
    this.players = [new Jogador('blue', names.blue, 116, 608, 1), new Jogador('red', names.red, 182, 92, -1)];
    this.coreHold = 0;
    this.coreRestored = false;
    this.exitHold = 0;
    this.inversionCount = 0;
    this.nextGravityAt = 0;
    this.scoring = scoring;
    this.elapsed = 0;
    this.events = [];
    this.failed = false;
    this.completed = false;
  }

  get solids() { return [...this.platforms, ...this.doors.filter((door) => !door.open).map((door) => new Plataforma({ ...door.bounds, id: door.id }))]; }

  step(delta, commands) {
    if (this.failed || this.completed) return;
    this.elapsed += delta;
    const solids = this.solids;
    for (const player of this.players) this.movePlayer(player, commands[player.id], delta, solids);

    for (const plate of this.plates) {
      if (plate.update(this.players)) {
        const points = this.scoring.add(plate.owner || this.playerOnPlate(plate)?.id || 'blue', 10, !this.scoring.awardedPhases.has(this.data.id));
        this.events.push({ type: 'plate', plate, points, player: this.playerOnPlate(plate) });
      }
    }
    for (const door of this.doors) {
      const previousOpen = door.open;
      door.update(this.plates, this.players);
      if (door.open && !previousOpen) this.events.push({ type: 'door', door });
    }

    if (this.data.corePlates.length && !this.coreRestored) {
      const allHeld = this.data.corePlates.every((id) => this.plates.find((plate) => plate.id === id)?.active);
      this.coreHold = allHeld ? this.coreHold + delta : 0;
      if (this.coreHold >= .5) {
        this.coreRestored = true;
        const allowed = !this.scoring.awardedPhases.has(this.data.id);
        const bluePoints = this.scoring.add('blue', 30, allowed);
        const redPoints = this.scoring.add('red', 30, allowed);
        this.events.push({ type: 'core', bluePoints, redPoints });
      }
    }

    if (this.players.some((player) => player.y < -95 || player.y > 800)
      || this.hazards.some((hazard) => this.players.some((player) => intersects(player, hazard)))) {
      this.failed = true;
      this.events.push({ type: 'failure' });
      return;
    }

    const exitsAllowed = this.data.requiredInversions <= this.inversionCount
      && this.doors.every((door) => door.latched)
      && (!this.data.corePlates.length || this.coreRestored);
    const bothHome = exitsAllowed && this.players.every((player) => this.exits.find((exit) => exit.player === player.id)?.contains(player));
    this.exitHold = bothHome ? this.exitHold + delta : 0;
    if (this.exitHold >= .5) {
      this.completed = true;
      const result = this.scoring.complete(this.data.id);
      this.events.push({ type: 'complete', result });
    }
  }

  movePlayer(player, command, delta, solids) {
    const direction = Number(command.right) - Number(command.left);
    player.vx = direction * 240;
    if (direction) player.facing = direction;
    if (direction) player.walkTime += delta * 11;

    const startX = player.x;
    player.x += player.vx * delta;
    for (const solid of solids) {
      if (intersects(player, solid)) {
        player.x = player.vx > 0 ? solid.x - player.w : solid.x + solid.w;
      }
    }
    player.x = Math.max(20, Math.min(1230 - player.w, player.x));

    const previousY = player.y;
    player.grounded = false;
    player.supportSurface = null;
    player.vy = Math.max(-700, Math.min(700, player.vy + player.gravity * 1500 * delta));
    player.y += player.vy * delta;
    for (const solid of solids) {
      if (player.x + player.w <= solid.x || player.x >= solid.x + solid.w) continue;
      if (player.vy >= 0 && previousY + player.h <= solid.y + 2 && player.y + player.h >= solid.y) {
        player.y = solid.y - player.h;
        player.vy = 0;
        if (player.gravity > 0 && solid.surface !== 'ceiling') {
          player.grounded = true;
          player.supportSurface = solid.surface || 'platform';
        }
      } else if (player.vy < 0 && previousY >= solid.y + solid.h - 2 && player.y <= solid.y + solid.h) {
        player.y = solid.y + solid.h;
        player.vy = 0;
        if (player.gravity < 0 && solid.surface !== 'floor') {
          player.grounded = true;
          player.supportSurface = solid.surface || 'platform';
        }
      }
    }
    if (Math.abs(player.vy) < 1 && !player.grounded) player.vy = 0;
    if (player.x !== startX && direction === 0) player.walkTime = Math.floor(player.walkTime);
  }

  jump(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    if (!player?.grounded || this.failed || this.completed) return false;
    player.vy = -player.gravity * 520;
    player.grounded = false;
    player.supportSurface = null;
    this.events.push({ type: 'jump', player });
    return true;
  }

  interact(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    const terminal = this.terminals.find((item) => player?.grounded && Math.abs(player.centerX - item.x) < item.radius);
    if (!terminal || this.elapsed < this.nextGravityAt || this.failed || this.completed) return false;
    const firstUse = terminal.uses === 0;
    terminal.uses += 1;
    this.nextGravityAt = this.elapsed + .8;
    this.inversionCount += 1;
    for (const crewMember of this.players) {
      crewMember.gravity *= -1;
      crewMember.vy = 0;
      crewMember.grounded = false;
      crewMember.supportSurface = null;
    }
    const allowed = !this.scoring.awardedPhases.has(this.data.id);
    const points = this.scoring.add(player.id, 10, allowed && firstUse);
    this.events.push({ type: 'gravity', player, points, terminal });
    return true;
  }

  playerOnPlate(plate) {
    return this.players.find((player) => player.grounded && player.supportSurface === plate.surface
      && Math.abs(player.centerX - (plate.x + plate.w / 2)) < plate.w / 2 + 8);
  }

  drainEvents() { const events = this.events; this.events = []; return events; }
}

export class Jogo {
  constructor(levels, names, scoring) {
    this.levels = levels;
    this.names = names;
    this.scoring = scoring;
    this.phase = null;
    this.start(1);
  }

  start(levelId) {
    const data = this.levels.find((item) => item.id === levelId);
    if (!data) return false;
    this.phase = new Fase(data, this.names, this.scoring);
    return true;
  }

  restart() {
    this.scoring.resetAttempt();
    return this.start(this.phase.data.id);
  }
}

export function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}