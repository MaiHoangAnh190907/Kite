import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    t.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
    t.uuid('tablet_id').notNullable().references('id').inTable('tablets').onDelete('CASCADE');
    t.uuid('staff_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('consent_given_at', { useTz: true }).notNullable();
    t.timestamp('started_at', { useTz: true }).notNullable();
    t.timestamp('completed_at', { useTz: true });
    t.string('status', 50).notNullable().defaultTo('in_progress');
    t.integer('patient_age_months').notNullable();
    t.integer('games_completed').notNullable().defaultTo(0);
    t.integer('total_duration_ms');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('patient_id', 'idx_sessions_patient');
    t.index(['clinic_id', 'started_at'], 'idx_sessions_clinic_date');
  });

  await knex.raw(
    `CREATE INDEX idx_sessions_status ON sessions (status) WHERE status = 'in_progress'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sessions');
}
