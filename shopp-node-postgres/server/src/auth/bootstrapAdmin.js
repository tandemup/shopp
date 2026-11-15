import { pool } from '../db.js';
import { normalizeEmail, validateEmail } from '../security.js';

const email = normalizeEmail(process.argv[2]);
if (validateEmail(email)) {
  console.error('Uso: npm run auth:bootstrap-admin -- correo@dominio.com');
  process.exitCode = 2;
} else {
  try {
    const result = await pool.query(
      `UPDATE app_users SET role = 'admin'
       WHERE email = $1 AND email_verified_at IS NOT NULL AND status = 'active'
       RETURNING email, role`, [email],
    );
    if (!result.rowCount) {
      console.error('No existe una cuenta activa y verificada con ese correo.');
      process.exitCode = 1;
    } else {
      console.log(`Cuenta promovida a administradora: ${result.rows[0].email}`);
    }
  } catch (error) {
    console.error('No se pudo promover la cuenta:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
