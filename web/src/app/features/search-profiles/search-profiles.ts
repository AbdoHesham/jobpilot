import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CvService } from '../../core/cv.service';
import {
  COUNTRIES,
  DATE_WINDOWS,
  SearchProfileService,
  WORK_MODES,
  type DatePosted,
  type SearchProfile,
  type WorkMode,
} from '../../core/search-profile.service';

interface ProfileForm {
  title: string;
  location: string;
  workMode: WorkMode;
  country: string;
  datePosted: DatePosted;
  minSalary: string;
  keywords: string;
  cvId: string;
}

const EMPTY: ProfileForm = {
  title: '',
  location: '',
  workMode: 'any',
  country: 'us',
  datePosted: 'week',
  minSalary: '',
  keywords: '',
  cvId: '',
};

@Component({
  selector: 'app-search-profiles',
  imports: [
    FormField,
    FormRoot,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <header class="page-head">
      <div>
        <h1>Your searches</h1>
        <p class="muted">Tell JobPilot what you want to find. Refine it whenever you like.</p>
      </div>
      <span class="profile-count">{{ profiles().length }} saved</span>
    </header>

    @if (message(); as text) {
      <p class="banner" [class.ok]="messageIsOk()" role="status">{{ text }}</p>
    }

    <form class="composer" [formRoot]="fields" (submit)="onSubmit($event)">
      <div class="core-fields">
        <div class="field">
          <label for="title">What role are you looking for?</label>
          <input
            matInput
            id="title"
            type="text"
            placeholder="Product designer, frontend engineer…"
            [formField]="fields.title"
            [attr.aria-invalid]="showError()"
            aria-describedby="title-error"
          />
        </div>
        <div class="field">
          <label for="location">Where?</label>
          <input
            matInput
            id="location"
            type="text"
            placeholder="City or remote"
            [formField]="fields.location"
          />
        </div>
        <button matButton="filled" class="btn save" type="submit" [disabled]="busy()">
          {{ busy() ? 'Saving…' : editingId() ? 'Save search' : 'Create search' }}
        </button>
      </div>
      @if (showError()) {
        <p class="error" id="title-error">Enter a job title to continue.</p>
      }

      <mat-expansion-panel class="filters" [expanded]="!!editingId()">
        <mat-expansion-panel-header>
          <mat-panel-title>More filters</mat-panel-title>
          <mat-panel-description
            >Country, work mode, date, salary, skills and CV</mat-panel-description
          >
        </mat-expansion-panel-header>
        <div class="filter-grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Country</mat-label>
            <mat-select id="country" [formField]="fields.country">
              @for (country of countries; track country.value) {
                <mat-option [value]="country.value">{{ country.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Work mode</mat-label>
            <mat-select id="workMode" [formField]="fields.workMode">
              @for (mode of workModes; track mode.value) {
                <mat-option [value]="mode.value">{{ mode.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Posted within</mat-label>
            <mat-select id="datePosted" [formField]="fields.datePosted">
              @for (window of dateWindows; track window.value) {
                <mat-option [value]="window.value">{{ window.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Minimum salary</mat-label>
            <input
              matInput
              id="minSalary"
              type="number"
              step="1000"
              placeholder="No minimum"
              [formField]="fields.minSalary"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Skills or keywords</mat-label>
            <input
              matInput
              id="keywords"
              type="text"
              placeholder="React, TypeScript"
              [formField]="fields.keywords"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Match with CV</mat-label>
            <mat-select id="cvId" [formField]="fields.cvId">
              <mat-option value="">No CV selected</mat-option>
              @for (cv of cvService.cvs(); track cv.id) {
                <mat-option [value]="cv.id">{{ cv.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </mat-expansion-panel>

      @if (editingId()) {
        <div class="edit-actions">
          <span class="muted">Editing saved search</span>
          <button
            matButton="outlined"
            class="btn btn--ghost"
            type="button"
            [disabled]="busy()"
            (click)="cancelEdit()"
          >
            Cancel
          </button>
        </div>
      }
    </form>

    @if (!profiles().length) {
      <div class="card empty">
        <h2>No searches yet</h2>
        <p class="muted">Create your first search above. A title is all you need.</p>
      </div>
    } @else {
      <div class="section-title">
        <h2>Saved searches</h2>
        <p class="muted">Each search has its own job feed.</p>
      </div>
      <ul class="list">
        @for (profile of profiles(); track profile.id) {
          <li class="card item" [class.inactive]="!profile.active">
            <div class="head">
              <div>
                <div class="name-line">
                  <span
                    class="status-dot"
                    [class.paused]="!profile.active"
                    aria-hidden="true"
                  ></span>
                  <h3>{{ profile.title }}</h3>
                </div>
                <p class="muted meta">
                  {{ profile.location || 'Anywhere' }} · {{ countryLabel(profile.country) }} ·
                  {{ modeLabel(profile.work_mode) }} · {{ windowLabel(profile.date_posted) }}
                  @if (profile.min_salary) {
                    · from {{ profile.min_salary }}
                  }
                </p>
              </div>
              <div class="actions">
                <button
                  matButton="outlined"
                  class="btn btn--ghost"
                  type="button"
                  (click)="edit(profile)"
                >
                  Edit
                </button>
                <button
                  matButton="outlined"
                  class="btn btn--ghost"
                  type="button"
                  (click)="toggle(profile)"
                >
                  {{ profile.active ? 'Pause' : 'Resume' }}
                </button>
                <button
                  matButton="outlined"
                  class="btn btn--ghost danger"
                  type="button"
                  (click)="remove(profile)"
                >
                  Delete
                </button>
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
    :host {
      display: block;
    }
    .page-head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-end;
      margin-bottom: 1.5rem;
    }
    .page-head p {
      margin: 0.4rem 0 0;
      max-width: 38rem;
    }
    .profile-count {
      flex: 0 0 auto;
      color: var(--muted);
      background: var(--card);
      border: 1px solid var(--rule);
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      font-size: 0.82rem;
    }
    .composer {
      background: var(--card);
      border: 1px solid var(--rule);
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 1rem;
      margin-bottom: 2.5rem;
    }
    .core-fields {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(12rem, 0.8fr) auto;
      gap: 0.7rem;
      align-items: end;
    }
    .field {
      margin: 0;
    }
    .core-fields label {
      color: var(--ink);
      font-family: var(--font-display);
      font-size: 0.82rem;
      letter-spacing: 0;
      text-transform: none;
      font-weight: 600;
    }
    .core-fields input {
      min-height: 50px;
      border-color: transparent;
      background: var(--paper);
    }
    .save {
      min-height: 50px;
      padding-inline: 1.25rem;
    }
    .error {
      margin: 0.5rem 0 0;
    }
    .filters {
      --mat-expansion-container-background-color: transparent;
      --mat-expansion-container-text-color: var(--ink);
      --mat-expansion-header-text-color: var(--ink);
      --mat-expansion-header-description-color: var(--muted);
      --mat-expansion-header-indicator-color: var(--muted);

      margin-top: 0.85rem;
      border-top: 1px solid var(--rule);
      border-radius: 0;
      box-shadow: none;
    }
    mat-expansion-panel-header {
      min-height: 52px;
    }
    mat-panel-title {
      font-size: 0.88rem;
      font-weight: 600;
    }
    mat-panel-description {
      font-size: 0.82rem;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      padding-top: 0.35rem;
    }
    .filter-grid mat-form-field {
      width: 100%;
    }
    .edit-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--rule);
      margin-top: 1rem;
      padding-top: 1rem;
      font-size: 0.85rem;
    }
    .section-title {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.8rem;
    }
    .section-title p {
      margin: 0;
      font-size: 0.85rem;
    }
    .section-title h2 {
      font-size: 1.15rem;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .item {
      padding: 1.25rem;
      border-radius: 14px;
    }
    .item.inactive {
      opacity: 0.62;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .name-line {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .head h3 {
      font-size: 1.05rem;
      margin: 0;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok) 12%, transparent);
    }
    .status-dot.paused {
      background: var(--muted);
      box-shadow: none;
    }
    .meta {
      font-size: 0.82rem;
      margin: 0.3rem 0 0 1.1rem;
      text-transform: capitalize;
    }
    .actions {
      display: flex;
      gap: 0.45rem;
      flex-shrink: 0;
    }
    .danger {
      color: var(--danger);
    }
    .chips {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      padding: 0;
      margin: 0.8rem 0 0 1.1rem;
    }
    .chip {
      font-size: 0.78rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      color: var(--signal);
      background: var(--signal-wash);
    }
    .banner.ok {
      border-color: var(--ok);
      color: var(--ok);
    }
    @media (max-width: 760px) {
      .core-fields,
      .filter-grid {
        grid-template-columns: 1fr;
      }
      mat-panel-description {
        display: none;
      }
    }
    @media (max-width: 560px) {
      .page-head {
        align-items: flex-start;
      }
      .head {
        flex-direction: column;
      }
      .actions {
        width: 100%;
        flex-wrap: wrap;
      }
      .actions .btn {
        flex: 1;
      }
    }
  `,
})
export class SearchProfiles {
  private readonly service = inject(SearchProfileService);
  protected readonly cvService = inject(CvService);
  protected readonly workModes = WORK_MODES;
  protected readonly countries = COUNTRIES;
  protected readonly dateWindows = DATE_WINDOWS;
  protected readonly profiles = this.service.profiles;
  protected readonly model = signal<ProfileForm>({ ...EMPTY });
  protected readonly fields = form(this.model, (path) => required(path.title));
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsOk = signal(false);
  protected readonly editingId = signal<string | null>(null);

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
        const parsedSalary = Number.parseInt(value.minSalary, 10);
        const input = {
          title: value.title.trim(),
          location: value.location.trim() || null,
          work_mode: value.workMode,
          country: value.country,
          date_posted: value.datePosted,
          min_salary: Number.isFinite(parsedSalary) ? Math.max(0, parsedSalary) : null,
          keywords: SearchProfileService.parseKeywords(value.keywords),
          cv_id: value.cvId || null,
        };
        try {
          const editing = this.editingId();
          if (editing) {
            await this.service.update(editing, input);
            this.ok('Search updated.');
          } else {
            await this.service.create(input);
            this.ok('Search created.');
          }
          this.cancelEdit();
        } catch (error) {
          this.fail(error);
        }
      },
    });
    this.busy.set(false);
  }

  protected windowLabel(value: string): string {
    return this.dateWindows.find((item) => item.value === value)?.label.toLowerCase() ?? value;
  }
  protected countryLabel(value: string): string {
    return this.countries.find((item) => item.value === value)?.label ?? value.toUpperCase();
  }
  protected modeLabel(value: string): string {
    return this.workModes.find((item) => item.value === value)?.label ?? value;
  }

  protected edit(profile: SearchProfile): void {
    this.editingId.set(profile.id);
    this.model.set({
      title: profile.title,
      location: profile.location ?? '',
      workMode: profile.work_mode,
      country: profile.country,
      datePosted: profile.date_posted,
      minSalary: profile.min_salary?.toString() ?? '',
      keywords: profile.keywords.join(', '),
      cvId: profile.cv_id ?? '',
    });
    document.getElementById('title')?.focus();
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.model.set({ ...EMPTY });
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
