import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tablets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
    t.string('device_token_hash', 255).notNullable().unique();
    t.string('device_name', 255);
    t.string('model', 100);
    t.string('os_version', 50);
    t.timestamp('last_seen_at', { useTz: true });
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('registered_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('clinic_id', 'idx_tablets_clinic');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tablets');
}
