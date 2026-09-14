import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ACCEPTED_CV_TYPES, CvService, type Cv } from '../../core/cv.service';

@Component({
  selector: 'app-cvs',
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatInputModule],
  template: `
    <h1>Your CVs</h1>
    <p class="muted">
      Upload a PDF or DOCX for each kind of role you apply for, then pick one per search profile.
    </p>

    @if (message(); as text) {
      <p class="banner" [class.ok]="messageIsOk()" role="status">{{ text }}</p>
    }

    <mat-card appearance="outlined" class="card upload">
      <mat-card-content class="upload-content">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="label-field">
          <mat-label>CV label</mat-label>
          <input
            matInput
            id="label"
            type="text"
            placeholder="e.g. Frontend CV"
            [value]="label()"
            (input)="onLabel($event)"
          />
        </mat-form-field>
        <div class="file-picker">
          <input
            #fileInput
            class="file-input"
            id="file"
            type="file"
            [accept]="accepted"
            (change)="onFile($event)"
            [disabled]="busy()"
          />
          <button
            matButton="filled"
            class="btn"
            type="button"
            [disabled]="busy()"
            aria-describedby="file-help"
            (click)="fileInput.click()"
          >
            {{ busy() ? 'Uploading…' : 'Choose PDF or DOCX' }}
          </button>
          <p class="muted hint" id="file-help">
            Up to 10 MB. Uploading starts as soon as you choose a file.
          </p>
        </div>
      </mat-card-content>
    </mat-card>

    @if (cvService.isLoading() && !cvs().length) {
      <div class="card skeleton" aria-hidden="true"></div>
      <div class="card skeleton" aria-hidden="true"></div>
    } @else if (!cvs().length) {
      <mat-card appearance="outlined" class="card empty">
        <mat-card-content>
          <h2>No CVs yet</h2>
          <p class="muted">Upload your first one above.</p>
        </mat-card-content>
      </mat-card>
    } @else {
      <div class="list" role="list">
        @for (cv of cvs(); track cv.id) {
          <mat-card appearance="outlined" class="card item" role="listitem">
            <div class="head">
              <div>
                <h2>{{ cv.label }}</h2>
                <p class="muted meta">{{ cv.file_name }}</p>
              </div>
              <div class="actions">
                <button
                  matButton="outlined"
                  class="btn btn--ghost"
                  type="button"
                  (click)="download(cv)"
                >
                  Download
                </button>
                <button
                  matButton="outlined"
                  class="btn btn--ghost danger"
                  type="button"
                  (click)="remove(cv)"
                >
                  Delete
                </button>
              </div>
            </div>

            @if (cv.parsed_json; as parsed) {
              @if (parsed.summary) {
                <p class="summary">{{ parsed.summary }}</p>
              }
              @if (parsed.skills.length) {
                <mat-chip-set class="chips" aria-label="CV skills">
                  @for (skill of parsed.skills; track skill) {
                    <mat-chip>{{ skill }}</mat-chip>
                  }
                </mat-chip-set>
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
                <button
                  matButton="outlined"
                  class="btn btn--ghost"
                  type="button"
                  [disabled]="busy()"
                  (click)="parse(cv)"
                >
                  Extract skills
                </button>
              </div>
            }
          </mat-card>
        }
      </div>
    }
  `,
  styles: `
    .upload {
      margin-bottom: 1.5rem;
    }
    .upload-content {
      display: grid;
      gap: 1rem;
      padding: 1.25rem;
    }
    .label-field {
      width: 100%;
    }
    .file-picker {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-wrap: wrap;
    }
    .file-input {
      display: none;
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
      margin: 0.9rem 0 0.6rem;
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
      background: linear-gradient(90deg, var(--card), var(--rule), var(--card));
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
    }
    .banner.ok {
      border-color: var(--ok);
      color: var(--ok);
    }
    .danger {
      color: var(--danger);
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
