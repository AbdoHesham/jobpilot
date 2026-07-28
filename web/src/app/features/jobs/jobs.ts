import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-jobs',
  imports: [RouterLink],
  template: `
    <h1>Jobs</h1>
    <div class="card empty">
      <h2>No search profiles yet</h2>
      <p class="muted">
        Once you create a search profile, matching jobs from LinkedIn and other boards appear here.
        You apply on the employer's own posting — JobPilot never applies for you.
      </p>
      <p class="muted">Start by <a routerLink="/cvs">uploading a CV</a>.</p>
    </div>
  `,
  styles: `
    .empty {
      padding: 2.5rem;
      text-align: center;
    }
  `,
})
export class Jobs {}
