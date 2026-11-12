import { Resend } from 'resend';

export function createAuthEmailSender({ apiKey, from }) {
  const resend = apiKey ? new Resend(apiKey) : null;

  return {
    isConfigured: Boolean(resend && from),
    async sendCode({ to, code, purpose }) {
      if (!resend || !from) throw new Error('Servicio de correo no configurado.');
      const isReset = purpose === 'password_reset';
      const subject = isReset ? 'Restablecer contraseña de Shopp' : 'Verifica tu correo en Shopp';
      const action = isReset ? 'crear una contraseña nueva' : 'completar el registro';
      const description = isReset ? 'Tu código de recuperación es' : 'Tu código de verificación es';
      const { error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        text: [
          subject,
          '',
          `${description}: ${code}`,
          '',
          `Introduce este código en Shopp para ${action}.`,
          '',
          'Si no has solicitado esta operación, puedes ignorar este mensaje.',
        ].join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
            <h2>${subject}</h2>
            <p>${description}:</p>
            <div style="margin:24px 0;padding:16px;text-align:center;font-size:30px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;border-radius:10px">${code}</div>
            <p>Introduce el código en Shopp para ${action}.</p>
            <p>Si no has solicitado esta operación, puedes ignorar este mensaje.</p>
          </div>
        `,
      });
      if (error) throw new Error('Resend no pudo enviar el correo.');
    },
  };
}
