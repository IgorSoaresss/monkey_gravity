# Monkey Gravity

Jogo de plataforma cooperativo para duas pessoas no mesmo teclado. Ajude os astronautas Azul e Vermelho a atravessar uma estação espacial, alternar a gravidade e escapar juntos.

## Executar

O jogo usa HTML, CSS e JavaScript nativos, sem bibliotecas ou serviços externos. Pode ser aberto por um servidor estático:

```powershell
python -m http.server 8000
```

Abra `http://localhost:8000`. Para executar os testes das regras, instale apenas o Node.js e rode `npm test`; não há pacotes de runtime ou dependências para instalar.

## Controles

| Ação | Azul | Vermelho |
| --- | --- | --- |
| Mover | A / D | Setas esquerda / direita |
| Pular | W | Seta para cima |
| Interagir com terminal | E | Enter |
| Pausar / retomar | Esc | Esc |
| Reiniciar tentativa | R | R |

Os atalhos, o volume e a redução de animações podem ser alterados em Configurações e ficam salvos no navegador. Uma tecla não pode ser atribuída a dois comandos.

## Estrutura

- `index.html` identifica a dupla e apresenta instruções e configurações.
- `jogo.html` hospeda o Canvas, placar, histórico e canal de acontecimentos.
- `css/` contém os estilos externos e os layouts responsivos.
- `js/dados-fases.js` descreve as cinco fases.
- `js/modelos.js` contém física, entidades, mecanismos e pontuação.
- `js/jogo.js` conecta entrada, simulação, renderização e interface.
- `tests/modelos.test.js` valida as regras principais sem framework de terceiros.

## Regras de pontuação

Placas e terminais concedem 10 pontos na primeira ativação; restaurar o núcleo concede 30 pontos a cada pessoa; concluir uma fase concede 100 pontos a cada pessoa. Pontos obtidos durante a tentativa são provisórios e desaparecem ao reiniciar. Uma fase já pontuada pode ser repetida, mas não concede pontos adicionais na mesma sessão. Excluir linhas do histórico não altera o placar nem o progresso salvo.

O navegador guarda preferências e fases liberadas em `localStorage`. A pontuação pertence à sessão atual e não é persistida. Os mapas são construídos por Canvas, sem imagens, fontes ou áudio remotos. O som usa Web Audio; se o navegador não oferecer áudio, o jogo permanece funcional.