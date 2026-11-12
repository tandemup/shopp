import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { StringDecoder } from 'node:string_decoder';
import { randomUUID } from 'node:crypto';
import { stdin, stdout } from 'node:process';
import { readConfig } from '../config.js';
import { createDatabase } from '../db.js';
import { migrateDatabase } from '../migrations.js';
import { hashPassword } from './passwords.js';

const bootstrapLockId = 731204612;

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function readSecret(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('La creación del administrador requiere una terminal interactiva.'));
  }

  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    let value = '';
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error = null) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      const input = decoder.write(chunk);
      for (const character of input) {
        if (character === '\u0003' || character === '\u0004') {
          finish(new Error('Operación cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          const characters = Array.from(value);
          if (characters.length) {
            characters.pop();
            value = characters.join('');
            stdout.write('\b \b');
          }
          continue;
        }
        if (character >= ' ' && character !== '\u007f') {
          value += character;
          stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  const config = readConfig();
  const pool = createDatabase(config.databaseUrl);
  try {
    await migrateDatabase(pool);
    const readline = createInterface({ input: stdin, output: stdout });
    let email;
    let name;
    try {
      email = normalizeEmail(await readline.question('Correo del administrador: '));
      name = (await readline.question('Nombre visible: ')).trim();
    } finally {
      readline.close();
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      throw new Error('Introduce una dirección de correo válida.');
    }
    if (!name || name.length > 120) throw new Error('El nombre debe tener entre 1 y 120 caracteres.');

    const password = await readSecret('Contraseña (no se mostrará): ');
    const confirmation = await readSecret('Repite la contraseña: ');
    if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [bootstrapLockId]);
      const existingAdmin = await client.query(
        "SELECT 1 FROM app_users WHERE role = 'admin' LIMIT 1",
      );
      if (existingAdmin.rowCount > 0) {
        throw new Error('Ya existe un administrador en PostgreSQL; no se ha creado ninguna cuenta.');
      }

      const inserted = await client.query(`
        INSERT INTO app_users (
          id, email, email_normalized, display_name, password_hash,
          email_verified_at, role, status, permissions
        )
        VALUES ($1, $2, $2, $3, $4, now(), 'admin', 'active', '{}'::jsonb)
        ON CONFLICT (email_normalized) DO NOTHING
        RETURNING id
      `, [randomUUID(), email, name, passwordHash]);
      if (inserted.rowCount !== 1) {
        throw new Error('Ya existe una cuenta con ese correo; no se ha modificado.');
      }

      await client.query('COMMIT');
      console.log(`Administrador creado: ${email}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || 'No se pudo crear el administrador.');
  process.exitCode = 1;
});
