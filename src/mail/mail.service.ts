import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailTemplatesService } from '../mail-templates/mail-templates.service';

export interface SendMailParams {
  to: string | undefined | null | (string | undefined | null)[];
  subject: string;
  html: string;
}

export type TemplateVars = Record<string, string | number | undefined | null>;

/** Replaces `{{var}}` placeholders in a template string with values from `vars`. */
function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly templates: MailTemplatesService,
  ) {
    const apiKey = this.config.get<string>('resend.apiKey');
    this.from = this.config.get<string>('resend.fromEmail')!;
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) this.logger.warn('RESEND_API_KEY not set — emails will be skipped');
  }

  async send(params: SendMailParams): Promise<void> {
    const to = [...new Set((Array.isArray(params.to) ? params.to : [params.to]).filter((e): e is string => !!e))];
    if (!to.length) return;

    if (!this.resend) {
      this.logger.warn(`Skipping email "${params.subject}" — Resend not configured`);
      return;
    }

    try {
      await this.resend.emails.send({ from: this.from, to, subject: params.subject, html: params.html });
    } catch (err) {
      this.logger.error(`Failed to send email "${params.subject}" to ${to.join(', ')}: ${(err as Error).message}`);
    }
  }

  /** Sends using an admin-editable template (see mail-templates module) with `{{placeholder}}` substitution. */
  async sendTemplate(key: string, vars: TemplateVars, to: SendMailParams['to']): Promise<void> {
    const tpl = await this.templates.getByKey(key).catch(() => null);
    if (!tpl) {
      this.logger.warn(`Mail template "${key}" not found — skipping email`);
      return;
    }
    if (!tpl.isActive) return;

    await this.send({
      to,
      subject: renderTemplate(tpl.subject, vars),
      html: renderTemplate(tpl.html, vars),
    });
  }
}
