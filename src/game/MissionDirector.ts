export interface MissionSnapshot {
  wave: number;
  totalWaves: number;
  targetsTagged: number;
  targetsRequired: number;
  complete: boolean;
}

export class MissionDirector {
  private readonly totalWaves = 3;
  private readonly targetsPerWave = 6;
  private wave = 1;
  private targetsTagged = 0;
  private complete = false;
  private readonly onChange: (snapshot: MissionSnapshot) => void;
  private readonly onMessage: (message: string) => void;

  constructor(onChange: (snapshot: MissionSnapshot) => void, onMessage: (message: string) => void) {
    this.onChange = onChange;
    this.onMessage = onMessage;
    this.publish();
  }

  targetTagged(): void {
    if (this.complete) return;
    this.targetsTagged++;
    if (this.targetsTagged >= this.targetsPerWave) {
      if (this.wave >= this.totalWaves) {
        this.complete = true;
        this.onMessage('MISSION COMPLETE');
      } else {
        this.wave++;
        this.targetsTagged = 0;
        this.onMessage('WAVE ' + this.wave + ' INCOMING');
      }
    }
    this.publish();
  }

  reset(): void {
    this.wave = 1;
    this.targetsTagged = 0;
    this.complete = false;
    this.publish();
  }

  get isComplete(): boolean { return this.complete; }

  private publish(): void {
    this.onChange({
      wave: this.wave,
      totalWaves: this.totalWaves,
      targetsTagged: this.targetsTagged,
      targetsRequired: this.targetsPerWave,
      complete: this.complete
    });
  }
}
