import { inject, Service, signal } from '@angular/core';

import { SupabaseService } from './supabase.service';

export interface ParsedCv {
  skills: string[];
  years_experience: number;
  roles: string[];
  education: string[];
  summary: string;
}

export interface Cv {
  id: string;
  label: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  parsed_json: ParsedCv | null;
  created_at: string;
}

export const ACCEPTED_CV_TYPES = '.pdf,.docx';
const MAX_BYTES = 10 * 1024 * 1024;

@Service()
export class CvService {
  private readonly supabase = inject(SupabaseService);

  private readonly items = signal<Cv[]>([]);
  private readonly loading = signal(false);

  readonly cvs = this.items.asReadonly();
  readonly isLoading = this.loading.asReadonly();

  async reload(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase.client
      .from('cvs')
      .select('id, label, storage_path, file_name, mime_type, parsed_json, created_at')
      .order('created_at', { ascending: false });
    this.loading.set(false);
    if (error) throw new Error(error.message);
    this.items.set((data ?? []) as Cv[]);
  }

  /**
   * Uploads to `cvs/<user_id>/…` — the storage policy authorises on that first
   * path segment — then inserts the row. Parsing is requested separately so a
   * missing Edge Function never costs you the upload.
   */
  async upload(file: File, label: string): Promise<Cv> {
    const userId = this.supabase.userId();
    if (!userId) throw new Error('Not signed in.');

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (extension !== 'pdf' && extension !== 'docx') {
      throw new Error('Only PDF and DOCX files are supported.');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('That file is larger than 10 MB.');
    }

    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const upload = await this.supabase.client.storage
      .from('cvs')
      .upload(path, file, { contentType: file.type || undefined });
    if (upload.error) throw new Error(upload.error.message);

    const { data, error } = await this.supabase.client
      .from('cvs')
      .insert({
        user_id: userId,
        label: label.trim() || file.name.replace(/\.[^.]+$/, ''),
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || (extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      })
      .select('id, label, storage_path, file_name, mime_type, parsed_json, created_at')
      .single();

    if (error) {
      // Don't leave an orphaned object behind if the row insert failed.
      await this.supabase.client.storage.from('cvs').remove([path]);
      throw new Error(error.message);
    }

    await this.reload();
    return data as Cv;
  }

  /**
   * Asks the parse-cv function to extract structured data. Optional by design:
   * the function needs an Anthropic key, and without one everything else still
   * works — the CV simply stays unparsed.
   */
  async requestParse(cvId: string): Promise<void> {
    try {
      await this.supabase.invokeFunction('parse-cv', { cv_id: cvId });
    } finally {
      // Reload either way: a partial parse still updates the row.
      await this.reload();
    }
  }

  async remove(cv: Cv): Promise<void> {
    await this.supabase.client.storage.from('cvs').remove([cv.storage_path]);
    const { error } = await this.supabase.client.from('cvs').delete().eq('id', cv.id);
    if (error) throw new Error(error.message);
    await this.reload();
  }

  /** Short-lived signed URL — the bucket is private, so no public URL exists. */
  async downloadUrl(cv: Cv): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from('cvs')
      .createSignedUrl(cv.storage_path, 60);
    if (error || !data) throw new Error(error?.message ?? 'Could not create a download link.');
    return data.signedUrl;
  }
}
