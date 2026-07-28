import { Component, inject, signal } from '@angular/core';

import { ACCEPTED_CV_TYPES, CvService, type Cv } from '../../core/cv.service';

@Component({
  selector: 'app-cvs',
  template: `
    <h1>Your CVs</h1>
    <p class="muted">
      Upload a PDF or DOCX for each kind of role you apply for, then pick one per search profile.
    </p>

    @if (message(); as text) {
      <p class="banner" [class.ok]="messageIsOk()" role="status">{{ text }}</p>
    }

    <div class="card upload">
      <div class="field">
        <label for="label">Label</label>
        <input id="label" type="text" placeholder="e.g. Frontend CV" [value]="label()" (input)="onLabel($event)" />
      </div>
      <div class="field">
        <label for="file">File</label>
        <input id="file" type="file" [accept]="accepted" (change)="onFile($event)" [disabled]="busy()" />
      </div>
      <p class="muted hint">PDF or DOCX, up to 10 MB. Uploading starts as soon as you choose a file.</p>
    </div>

    @if (cvService.isLoading() && !cvs().length) {
      <div class="card skeleton" aria-hidden="true"></div>
      <div class="card skeleton" aria-hidden="true"></div>
    } @else if (!cvs().length) {
      <div class="card empty">
        <h2>No CVs yet</h2>
        <p class="muted">Upload your first one above.</p>
      </div>
    } @else {
      <ul class="list">
        @for (cv of cvs(); track cv.id) {
          <li class="card item">
            <div class="head">
              <div>
                <h2>{{ cv.label }}</h2>
                <p class="muted meta">{{ cv.file_name }}</p>
              </div>
              <div class="actions">
                <button class="btn btn--ghost" type="button" (click)="download(cv)">Download</button>
                <button class="btn btn--ghost" type="button" (click)="remove(cv)">Delete</button>
              </div>
            </div>

            @if (cv.parsed_json; as parsed) {
              @if (parsed.summary) {
                <p class="summary">{{ parsed.summary }}</p>
              }
              @if (parsed.skills.length) {
                <ul class="chips">
                  @for (skill of parsed.skills; track skill) {
                    <li class="chip">{{ skill }}</li>
                  }
                </ul>
              }
              <p class="muted meta">
                {{ parsed.years_experience }} years · {{ parsed.roles.length }} roles ·
                {{ parsed.education.length }} qualifications
              </p>
            } @else {
              <div class="unparsed">
                <p class="muted">
                  Not parsed. Skills extraction is optional — it needs the parse-cv function and an
                  Anthropic key.
                </p>
                <button class="btn btn--ghost" type="button" [disabled]="busy()" (click)="parse(cv)">
                  Extract skills
                </button>
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .upload {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .hint {
      font-size: 0.8rem;
      margin: 0;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 1rem;
    }
    .item {
      padding: 1.25rem;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .head h2 {
      font-size: 1.05rem;
      margin: 0;
    }
    .meta {
      font-size: 0.8rem;
      margin: 0.15rem 0 0;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .summary {
      margin: 0.9rem 0 0;
    }
    .chips {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      padding: 0;
      margin: 0.9rem 0 0.6rem;
    }
    .chip {
      font-size: 0.78rem;
      padding: 0.15rem 0.55rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
    }
    .unparsed {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 0.9rem;
      flex-wrap: wrap;
    }
    .unparsed p {
      margin: 0;
      font-size: 0.85rem;
      flex: 1 1 16rem;
    }
    .empty {
      padding: 2.5rem;
      text-align: center;
    }
    .skeleton {
      height: 92px;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, var(--surface), var(--border), var(--surface));
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
    }
    .banner.ok {
      border-color: var(--success);
      color: var(--success);
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
  `,
})
export class Cvs {
  protected readonly cvService = inject(CvService);
  protected readonly accepted = ACCEPTED_CV_TYPES;

  protected readonly cvs = this.cvService.cvs;
  protected readonly busy = signal(false);
  protected readonly label = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsOk = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      await this.cvService.reload();
    } catch (error) {
      this.fail(error);
    }
  }

  protected onLabel(event: Event): void {
    this.label.set((event.target as HTMLInputElement).value);
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.busy.set(true);
    this.message.set(null);
    try {
      const cv = await this.cvService.upload(file, this.label());
      this.label.set('');
      input.value = '';
      this.ok(`Uploaded “${cv.label}”.`);
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async parse(cv: Cv): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      await this.cvService.requestParse(cv.id);
      this.ok('Skills extracted.');
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(cv: Cv): Promise<void> {
    this.busy.set(true);
    try {
      await this.cvService.remove(cv);
      this.ok(`Deleted “${cv.label}”.`);
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async download(cv: Cv): Promise<void> {
    try {
      window.open(await this.cvService.downloadUrl(cv), '_blank', 'noopener');
    } catch (error) {
      this.fail(error);
    }
  }

  private ok(text: string): void {
    this.messageIsOk.set(true);
    this.message.set(text);
  }

  private fail(error: unknown): void {
    this.messageIsOk.set(false);
    this.message.set(error instanceof Error ? error.message : String(error));
  }
}
