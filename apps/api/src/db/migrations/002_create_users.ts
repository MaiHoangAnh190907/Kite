import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
    t.string('email', 255).unique();
    t.string('password_hash', 255);
    t.binary('mfa_secret_encrypted');
    t.boolean('mfa_enabled').notNullable().defaultTo(false);
    t.string('pin_hash', 255);
    t.string('role', 50).notNullable();
    t.string('name', 255).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('clinic_id', 'idx_users_clinic');
  });

  await knex.raw(
    'CREATE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
