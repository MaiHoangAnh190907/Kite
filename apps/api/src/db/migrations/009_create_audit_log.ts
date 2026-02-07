import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_log', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('user_id');
    t.uuid('clinic_id');
    t.string('action', 100).notNullable();
    t.string('resource_type', 50);
    t.uuid('resource_id');
    t.specificType('ip_address', 'inet');
    t.text('user_agent');
    t.jsonb('details');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['user_id', 'created_at'], 'idx_audit_user_time');
    t.index(['clinic_id', 'created_at'], 'idx_audit_clinic_time');
    t.index(['action', 'created_at'], 'idx_audit_action');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log');
}
