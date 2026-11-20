export class HUD {
  private readonly root: HTMLDivElement;
  private readonly ammo = this.required('ammo-value');
  private readonly score = this.required('score-value');
  private readonly health = this.required('health-value');
  private readonly toast = this.required('toast');

  constructor(root: HTMLDivElement) {
    this.root = root;
  }

  setAmmo(current: number, capacity: number): void {
    this.ammo.textContent = String(current).padStart(2, '0') + ' / ' + String(capacity).padStart(2, '0');
  }

  setScore(value: number): void {
    this.score.textContent = String(value).padStart(5, '0');
  }

  setHealth(value: number): void {
    this.health.textContent = String(value).padStart(3, '0');
  }

  showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), 1000);
  }

  private toastTimer = 0;

  dispose(): void {
    window.clearTimeout(this.toastTimer);
    this.root.innerHTML = '';
  }

  private required(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>('#' + id);
    if (!element) throw new Error('Missing HUD element #' + id);
    return element;
  }
}
