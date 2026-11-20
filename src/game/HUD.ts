export class HUD {
  private readonly root: HTMLDivElement;
  private readonly ammo: HTMLElement;
  private readonly score: HTMLElement;
  private readonly health: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.ammo = this.required('ammo-value');
    this.score = this.required('score-value');
    this.health = this.required('health-value');
    this.toast = this.required('toast');
  }

  setAmmo(current: number, capacity: number): void {
    this.ammo.textContent = String(current).padStart(2, '0') + ' / ' + String(capacity).padStart(2, '0');
  }

  setScore(value: number): void {
    this.score.textContent = String(value).padStart(5, '0');
  }

  setHealth(value: number): void {
    this.health.textContent = String(value).padStart(3, '0');
    this.health.style.color = value <= 30 ? '#ef806b' : '#d8e5e8';
  }

  showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('visible'), 1000);
  }

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
