import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('flags', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    t.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
    t.uuid('session_id').references('id').inTable('sessions').onDelete('SET NULL');
    t.string('flag_type', 50).notNullable();
    t.string('severity', 20).notNullable();
    t.string('metric_name', 100).notNullable();
    t.string('game_type', 50).notNullable();
    t.text('description').notNullable();
    t.decimal('current_value', 10, 4);
    t.decimal('threshold_value', 10, 4);
    t.boolean('is_dismissed').notNullable().defaultTo(false);
    t.uuid('dismissed_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('dismissed_at', { useTz: true });
    t.text('dismiss_reason');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    'CREATE INDEX idx_flags_patient_active ON flags (patient_id) WHERE is_dismissed = FALSE',
  );
  await knex.raw(
    'CREATE INDEX idx_flags_clinic_severity ON flags (clinic_id, severity) WHERE is_dismissed = FALSE',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('flags');
}
