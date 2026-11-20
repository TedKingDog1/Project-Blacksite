import './styles.css';
import { Game } from './game/Game';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Application root element #app was not found.');
}

const game = new Game(root);
void game.start();

window.addEventListener('beforeunload', () => game.dispose());
