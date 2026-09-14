import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

import { SupabaseService } from '../../core/supabase.service';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

@Component({
  selector: 'app-report-issue',
  imports: [FormField, MatButtonModule, MatInputModule],
  template: `
    <button matButton="filled" class="report-button" type="button" (click)="open()">
      <span class="report-btn-content">

        <span class="report-icon" aria-hidden="true">!</span>
        <span class="report-label">Report an issue</span>
      </span>
    </button>

    <dialog #dialog (close)="reset()">
      <form (submit)="save($event)">
        <header>
          <div>
            <h2>Report an issue</h2>
            <p class="muted">Tell us what happened and what you expected.</p>
          </div>
          <button
            matButton="text"
            class="close"
            type="button"
            aria-label="Close"
            (click)="dialog.close()"
          >
            ×
          </button>
        </header>

        @if (message(); as text) {
          <p class="banner" [class.ok]="sent()" role="status">{{ text }}</p>
        }

        @if (!sent()) {
          <div class="field">
            <label for="issue-description">Description</label>
            <textarea
              matInput
              id="issue-description"
              rows="6"
              placeholder="What went wrong? Include the steps that led to it."
              [formField]="fields.description"
              aria-describedby="description-error"
            ></textarea>
            @if (showDescriptionError()) {
              <p class="error" id="description-error">Write at least 10 characters.</p>
            }
          </div>

          <div class="field">
            <label for="issue-image"
              >Screenshot
              <span class="optional">Optional · PNG, JPG or WebP · max 3 MB</span></label
            >
            <input
              id="issue-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              (change)="chooseImage($event)"
            />
          </div>

          <footer>
            <button
              matButton="outlined"
              class="btn btn--ghost"
              type="button"
              (click)="dialog.close()"
            >
              Cancel
            </button>
            <button matButton="filled" class="btn" type="submit" [disabled]="busy()">
              {{ busy() ? 'Sending…' : 'Send report' }}
            </button>
          </footer>
        } @else {
          <button matButton="filled" class="btn btn--block" type="button" (click)="dialog.close()">
            Done
          </button>
        }
      </form>
    </dialog>
  `,
  styles: `
    .report-button {
      --mat-button-filled-container-color: var(--ink);
      --mat-button-filled-label-text-color: var(--card);
      --mat-button-filled-container-shape: 999px;

      position: fixed;
      right: 1.25rem;
      bottom: 1.25rem;
      z-index: 4;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 44px;
      padding: 0.65rem 0.9rem;
      border: 1px solid var(--rule);
      border-radius: 999px;
      background: var(--ink);
      color: var(--card);
      box-shadow: 0 10px 30px rgb(18 24 38 / 18%);
      font-weight: 600;
      cursor: pointer;
      .report-btn-content{
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }
    .report-icon {
      display: grid;
      place-items: center;
      width: 19px;
      height: 19px;
      border: 1px solid currentColor;
      border-radius: 50%;
      font-size: 0.75rem;
    }
    dialog {
      width: min(560px, calc(100% - 2rem));
      padding: 0;
      color: var(--ink);
      background: var(--card);
      border: 1px solid var(--rule);
      border-radius: 18px;
      box-shadow: 0 28px 80px rgb(10 18 38 / 28%);
    }
    dialog::backdrop {
      background: rgb(13 17 27 / 58%);
      backdrop-filter: blur(3px);
    }
    form {
      padding: 1.4rem;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    header p {
      margin: 0.3rem 0 0;
    }
    .close {
      --mat-button-text-label-text-color: var(--muted);
      --mat-button-text-container-height: 36px;
      --mat-button-text-container-shape: 50%;

      min-width: 36px;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: var(--paper);
      color: var(--muted);
      font-size: 1.4rem;
      cursor: pointer;
    }
    textarea {
      resize: vertical;
    }
    .optional {
      color: var(--muted);
      font-family: var(--font-display);
      font-weight: 400;
      letter-spacing: 0;
      text-transform: none;
    }
    .error {
      margin: 0;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.6rem;
      margin-top: 1.2rem;
    }
    .banner.ok {
      border-color: var(--ok);
    }
    @media (max-width: 720px) {
      .report-button {
        right: 0.5rem;
        bottom: 1rem;
        width: 44px;
        min-width: 44px;
        min-height: 44px;
        padding: 0;
      }
      .report-label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      dialog {
        margin-bottom: 1rem;
      }
    }
  `,
})
export class ReportIssue {
  private readonly supabase = inject(SupabaseService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly model = signal({ description: '' });
  protected readonly fields = form(this.model, (path) => {
    required(path.description);
    minLength(path.description, 10);
    maxLength(path.description, 5000);
  });
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly sent = signal(false);
  private image: File | null = null;

  protected open(): void {
    this.dialog().nativeElement.showModal();
  }

  protected chooseImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.message.set(null);
    if (
      file &&
      (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > MAX_IMAGE_BYTES)
    ) {
      input.value = '';
      this.image = null;
      this.message.set('Choose a PNG, JPG or WebP image smaller than 3 MB.');
      return;
    }
    this.image = file;
  }

  protected showDescriptionError(): boolean {
    const state = this.fields.description();
    return state.touched() && !state.valid();
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.message.set(null);
    await submit(this.fields, async () => {
      this.busy.set(true);
      try {
        await this.supabase.invokeFunction('report-issue', {
          description: this.model().description.trim(),
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          image: this.image ? await this.toDataUrl(this.image) : null,
          image_name: this.image?.name ?? null,
        });
        this.sent.set(true);
        this.message.set('Issue sent. Thank you for helping improve JobPilot.');
      } catch (error) {
        this.message.set(error instanceof Error ? error.message : String(error));
      } finally {
        this.busy.set(false);
      }
    });
  }

  private toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not read the image.'));
      reader.readAsDataURL(file);
    });
  }

  protected reset(): void {
    this.model.set({ description: '' });
    this.image = null;
    this.message.set(null);
    this.sent.set(false);
  }
}
