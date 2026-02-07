import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patients', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
    t.string('mrn', 100);
    t.binary('first_name_encrypted').notNullable();
    t.binary('last_name_encrypted').notNullable();
    t.binary('date_of_birth_encrypted').notNullable();
    t.binary('guardian_name_encrypted');
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('clinic_id', 'idx_patients_clinic');
  });

  await knex.raw(
    'CREATE UNIQUE INDEX idx_patients_clinic_mrn ON patients (clinic_id, mrn) WHERE mrn IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patients');
}
