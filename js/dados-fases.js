const room = [
  { id: 'floor', x: 0, y: 646, w: 1280, h: 74, surface: 'floor' },
  { id: 'ceiling', x: 0, y: 74, w: 1280, h: 18, surface: 'ceiling' }
];

export const LEVELS = [
  {
    id: 1, name: 'Despertar', subtitle: 'Aprender a ajudar o parceiro',
    description: 'Uma placa no teto libera a passagem no piso. Ajude a outra pessoa a cruzar.',
    instruction: 'Vermelho: mantenha a placa do teto. Azul: atravesse a porta e siga à saída.',
    platforms: [...room, { id: 'step-a', x: 380, y: 525, w: 110, h: 18 }, { id: 'step-b', x: 765, y: 460, w: 120, h: 18 }],
    plates: [{ id: 'roof-switch', x: 300, w: 72, surface: 'ceiling', color: 'blue' }],
    doors: [{ id: 'floor-gate', x: 565, w: 42, surface: 'floor', plates: ['roof-switch'], latchWhen: 'blue' }],
    terminals: [], hazards: [], corePlates: [],
    exits: [{ player: 'blue', surface: 'floor', gravity: 1 }, { player: 'red', surface: 'ceiling', gravity: -1 }],
    requiredInversions: 0
  },
  {
    id: 2, name: 'Conexão', subtitle: 'Organizar a ordem das ações',
    description: 'Duas portas cruzadas. Uma pessoa abre a rota; a outra devolve o favor.',
    instruction: 'Vermelho ativa a placa no teto. Azul cruza a porta e ativa a placa do piso.',
    platforms: [...room, { id: 'step-a', x: 275, y: 548, w: 90, h: 18 }, { id: 'step-b', x: 700, y: 510, w: 120, h: 18 }, { id: 'step-c', x: 930, y: 460, w: 90, h: 18 }],
    plates: [
      { id: 'roof-switch', x: 300, w: 72, surface: 'ceiling', color: 'blue' },
      { id: 'floor-switch', x: 790, w: 72, surface: 'floor', color: 'red' }
    ],
    doors: [
      { id: 'floor-gate', x: 495, w: 40, surface: 'floor', plates: ['roof-switch'], latchWhen: 'blue' },
      { id: 'roof-gate', x: 905, w: 40, surface: 'ceiling', plates: ['floor-switch'], latchWhen: 'red' }
    ],
    terminals: [], hazards: [], corePlates: [],
    exits: [{ player: 'blue', surface: 'floor', gravity: 1 }, { player: 'red', surface: 'ceiling', gravity: -1 }],
    requiredInversions: 0
  },
  {
    id: 3, name: 'Inversão', subtitle: 'Trocar de superfície em conjunto',
    description: 'O terminal inverte os dois astronautas. Procurem um pouso seguro na outra face.',
    instruction: 'Alcancem o terminal central. Uma interação troca a gravidade da dupla.',
    platforms: [...room, { id: 'island-a', x: 340, y: 455, w: 150, h: 18 }, { id: 'island-b', x: 790, y: 350, w: 150, h: 18 }],
    plates: [], doors: [],
    terminals: [{ id: 'relay', x: 640, y: 344, radius: 104 }], hazards: [], corePlates: [],
    exits: [{ player: 'blue', surface: 'ceiling', gravity: -1 }, { player: 'red', surface: 'floor', gravity: 1 }],
    requiredInversions: 1
  },
  {
    id: 4, name: 'Sincronia', subtitle: 'Planejar os dois pousos',
    description: 'Portas, placas e campos elétricos fixos. Planejem onde cada um vai pousar.',
    instruction: 'Ativem as placas cruzadas, usem o terminal e evitem os campos elétricos.',
    platforms: [...room, { id: 'island-a', x: 290, y: 480, w: 120, h: 18 }, { id: 'island-b', x: 840, y: 400, w: 110, h: 18 }, { id: 'island-c', x: 555, y: 260, w: 150, h: 18 }],
    plates: [
      { id: 'roof-switch', x: 310, w: 72, surface: 'ceiling', color: 'blue' },
      { id: 'floor-switch', x: 775, w: 72, surface: 'floor', color: 'red' }
    ],
    doors: [
      { id: 'floor-gate', x: 455, w: 42, surface: 'floor', plates: ['roof-switch'], latchWhen: 'blue' },
      { id: 'roof-gate', x: 925, w: 42, surface: 'ceiling', plates: ['floor-switch'], latchWhen: 'red' }
    ],
    terminals: [{ id: 'relay', x: 640, y: 344, radius: 104 }],
    hazards: [{ id: 'arc-a', x: 505, y: 350, w: 78, h: 20 }, { id: 'arc-b', x: 780, y: 300, w: 84, h: 20 }], corePlates: [],
    exits: [{ player: 'blue', surface: 'ceiling', gravity: -1 }, { player: 'red', surface: 'floor', gravity: 1 }],
    requiredInversions: 1
  },
  {
    id: 5, name: 'Núcleo', subtitle: 'Restaurar a estação e escapar',
    description: 'Segurem as duas placas de manutenção para restaurar o núcleo. Depois, encontrem a nave.',
    instruction: 'Azul ocupa a placa do piso; Vermelho, a do teto. Mantenham ambas por meio segundo.',
    platforms: [...room, { id: 'island-a', x: 400, y: 510, w: 120, h: 18 }, { id: 'core-platform', x: 590, y: 375, w: 100, h: 18 }, { id: 'island-b', x: 810, y: 510, w: 120, h: 18 }],
    plates: [
      { id: 'maintenance-floor', x: 500, w: 78, surface: 'floor', color: 'red' },
      { id: 'maintenance-roof', x: 800, w: 78, surface: 'ceiling', color: 'blue' }
    ], doors: [],
    terminals: [{ id: 'relay', x: 1010, y: 344, radius: 100 }],
    hazards: [{ id: 'arc-a', x: 625, y: 300, w: 60, h: 18 }, { id: 'arc-b', x: 900, y: 430, w: 74, h: 18 }],
    corePlates: ['maintenance-floor', 'maintenance-roof'],
    exits: [{ player: 'blue', surface: 'ceiling', gravity: -1 }, { player: 'red', surface: 'floor', gravity: 1 }],
    requiredInversions: 1
  }
];