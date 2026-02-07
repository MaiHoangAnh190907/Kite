import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('game_results', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('session_id').notNullable().references('id').inTable('sessions').onDelete('CASCADE');
    t.string('game_type', 50).notNullable();
    t.timestamp('started_at', { useTz: true }).notNullable();
    t.timestamp('completed_at', { useTz: true });
    t.integer('duration_ms');
    t.jsonb('raw_events').notNullable().defaultTo('[]');
    t.jsonb('computed_metrics').notNullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('session_id', 'idx_game_results_session');
    t.index('game_type', 'idx_game_results_type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('game_results');
}
