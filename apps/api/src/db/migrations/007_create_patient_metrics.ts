import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patient_metrics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    t.uuid('session_id').notNullable().references('id').inTable('sessions').onDelete('CASCADE');
    t.string('game_type', 50).notNullable();
    t.string('metric_name', 100).notNullable();
    t.decimal('metric_value', 10, 4).notNullable();
    t.integer('age_months').notNullable();
    t.decimal('percentile', 5, 2);
    t.timestamp('recorded_at', { useTz: true }).notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['patient_id', 'metric_name', 'recorded_at'], 'idx_patient_metrics_lookup');
    t.index(['metric_name', 'age_months'], 'idx_patient_metrics_normative');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patient_metrics');
}
