import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required, submit } from '@angular/forms/signals';

import { CvService } from '../../core/cv.service';
import {
  SearchProfileService,
  WORK_MODES,
  type SearchProfile,
  type WorkMode,
} from '../../core/search-profile.service';

interface ProfileForm {
  title: string;
  location: string;
  workMode: WorkMode;
  minSalary: string;
  keywords: string;
  cvId: string;
}

const EMPTY: ProfileForm = {
  title: '',
  location: '',
  workMode: 'any',
  minSalary: '',
  keywords: '',
  cvId: '',
};

@Component({
  selector: 'app-search-profiles',
  imports: [FormField, FormRoot],
  template: `
    <h1>Search profiles</h1>
    <p class="muted">
      Each profile is one saved job search. The jobs feed is refreshed per profile.
    </p>

    @if (message(); as text) {
      <p class="banner" [class.ok]="messageIsOk()" role="status">{{ text }}</p>
    }

    <form class="card panel" [formRoot]="fields" (submit)="onSubmit($event)">
      <div class="field">
        <label for="title">Job title</label>
        <input
          id="title"
          type="text"
          placeholder="Senior Frontend Developer"
          [formField]="fields.title"
          [attr.aria-invalid]="showError()"
          aria-describedby="title-error"
        />
        @if (showError()) {
          <p class="error" id="title-error">A job title is required.</p>
        }
      </div>

      <div class="row">
        <div class="field">
          <label for="location">Location</label>
          <input id="location" type="text" placeholder="Berlin, or leave blank" [formField]="fields.location" />
        </div>
        <div class="field">
          <label for="workMode">Work mode</label>
          <select id="workMode" [formField]="fields.workMode">
            @for (mode of workModes; track mode.value) {
              <option [value]="mode.value">{{ mode.label }}</option>
            }
          </select>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label for="minSalary">Minimum salary</label>
          <input id="minSalary" type="number" step="1000" placeholder="Optional" [formField]="fields.minSalary" />
        </div>
        <div class="field">
          <label for="cvId">CV to use</label>
          <select id="cvId" [formField]="fields.cvId">
            <option value="">None</option>
            @for (cv of cvService.cvs(); track cv.id) {
              <option [value]="cv.id">{{ cv.label }}</option>
            }
          </select>
        </div>
      </div>

      <div class="field">
        <label for="keywords">Keywords</label>
        <input id="keywords" type="text" placeholder="react, typescript, graphql" [formField]="fields.keywords" />
        <p class="muted hint">Comma-separated. Used for ranking when a CV has not been parsed.</p>
      </div>

      <button class="btn" type="submit" [disabled]="busy()">
        {{ busy() ? 'Saving…' : 'Create search profile' }}
      </button>
    </form>

    @if (!profiles().length) {
      <div class="card empty">
        <h2>No search profiles yet</h2>
        <p class="muted">Create one above to start collecting matching jobs.</p>
      </div>
    } @else {
      <ul class="list">
        @for (profile of profiles(); track profile.id) {
          <li class="card item" [class.inactive]="!profile.active">
            <div class="head">
              <div>
                <h2>{{ profile.title }}</h2>
                <p class="muted meta">
                  {{ profile.location || 'Anywhere' }} · {{ profile.work_mode }}
                  @if (profile.min_salary) {
                    · from {{ profile.min_salary }}
                  }
                </p>
              </div>
              <div class="actions">
                <button class="btn btn--ghost" type="button" (click)="toggle(profile)">
                  {{ profile.active ? 'Pause' : 'Resume' }}
                </button>
                <button class="btn btn--ghost" type="button" (click)="remove(profile)">Delete</button>
              </div>
            </div>
            @if (profile.keywords.length) {
              <ul class="chips">
                @for (keyword of profile.keywords; track keyword) {
                  <li class="chip">{{ keyword }}</li>
                }
              </ul>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .panel {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 560px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
    .hint {
      font-size: 0.78rem;
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
      padding: 1.15rem;
    }
    .item.inactive {
      opacity: 0.6;
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
      text-transform: capitalize;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .chips {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      padding: 0;
      margin: 0.8rem 0 0;
    }
    .chip {
      font-size: 0.78rem;
      padding: 0.15rem 0.55rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
    }
    .empty {
      padding: 2.5rem;
      text-align: center;
    }
    .banner.ok {
      border-color: var(--success);
      color: var(--success);
    }
  `,
})
export class SearchProfiles {
  private readonly service = inject(SearchProfileService);
  protected readonly cvService = inject(CvService);

  protected readonly workModes = WORK_MODES;
  protected readonly profiles = this.service.profiles;

  protected readonly model = signal<ProfileForm>({ ...EMPTY });
  protected readonly fields = form(this.model, (path) => {
    required(path.title);
  });

  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsOk = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      await Promise.all([this.service.reload(), this.cvService.reload()]);
    } catch (error) {
      this.fail(error);
    }
  }

  protected showError(): boolean {
    const state = this.fields.title();
    return state.touched() && !state.valid();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.message.set(null);
    this.busy.set(true);

    await submit(this.fields, {
      action: async () => {
        const value = this.model();
        // Signal Forms manages validation attributes, so `min` can't live on the
        // input — clamp here instead of rejecting a negative outright.
        const parsedSalary = Number.parseInt(value.minSalary, 10);
        const salary = Number.isFinite(parsedSalary) ? Math.max(0, parsedSalary) : Number.NaN;
        try {
          await this.service.create({
            title: value.title.trim(),
            location: value.location.trim() || null,
            work_mode: value.workMode,
            min_salary: Number.isFinite(salary) ? salary : null,
            keywords: SearchProfileService.parseKeywords(value.keywords),
            cv_id: value.cvId || null,
          });
          this.model.set({ ...EMPTY });
          this.ok('Search profile created.');
        } catch (error) {
          this.fail(error);
        }
      },
    });

    this.busy.set(false);
  }

  protected async toggle(profile: SearchProfile): Promise<void> {
    try {
      await this.service.update(profile.id, { active: !profile.active });
    } catch (error) {
      this.fail(error);
    }
  }

  protected async remove(profile: SearchProfile): Promise<void> {
    try {
      await this.service.remove(profile.id);
      this.ok(`Deleted “${profile.title}”.`);
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
