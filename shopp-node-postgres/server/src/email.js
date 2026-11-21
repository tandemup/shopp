import { config } from './config.js';

export async function sendAuthCode({ email, code, purpose }) {
  const isReset = purpose === 'reset_password';
  const isEmailChange = purpose === 'change_email';
  const instruction = isReset
    ? 'Usa este código para restablecer tu contraseña.'
    : isEmailChange
      ? 'Usa este código para confirmar el cambio de correo de tu cuenta Shopp.'
      : 'Usa este código para verificar tu correo y activar tu cuenta.';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: isReset
        ? 'Código para restablecer tu contraseña de Shopp'
        : isEmailChange ? 'Confirma el cambio de correo de Shopp' : 'Verifica tu correo de Shopp',
      text: `${instruction}\n\nCódigo: ${code}\nCaduca en 15 minutos. Si no lo has solicitado, ignora este correo.`,
      html: `<p>${instruction}</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Caduca en 15 minutos. Si no lo has solicitado, ignora este correo.</p>`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Resend devolvió HTTP ${response.status}`);
}
