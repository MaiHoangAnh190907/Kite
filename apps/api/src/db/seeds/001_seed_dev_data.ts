import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { randomBytes, createCipheriv } from 'node:crypto';

// Inline encryption for seeds (can't import from src easily in knex seed runner)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

function encrypt(plaintext: string): Buffer {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';

const ADMIN_ID = '22222222-2222-2222-2222-222222222222';
const CLINICIAN_ID = '33333333-3333-3333-3333-333333333333';
const STAFF_ID = '44444444-4444-4444-4444-444444444444';
const TABLET_ID = '55555555-5555-5555-5555-555555555555';

const PATIENT_IDS = [
  'aaaa1111-1111-1111-1111-111111111111',
  'aaaa2222-2222-2222-2222-222222222222',
  'aaaa3333-3333-3333-3333-333333333333',
  'aaaa4444-4444-4444-4444-444444444444',
];

const patients = [
  { id: PATIENT_IDS[0], firstName: 'Patrick', lastName: 'King', dob: '2020-08-08', guardian: 'James King', mrn: 'MRN-001' },
  { id: PATIENT_IDS[1], firstName: 'Anh', lastName: 'Mai', dob: '2020-02-08', guardian: 'Linh Mai', mrn: 'MRN-002' },
  { id: PATIENT_IDS[2], firstName: 'Matheus', lastName: 'Maldaner', dob: '2021-02-08', guardian: 'Lucas Maldaner', mrn: 'MRN-003' },
  { id: PATIENT_IDS[3], firstName: 'My', lastName: 'Pham', dob: '2021-08-08', guardian: 'Trang Pham', mrn: 'MRN-004' },
];

function ageMonthsAt(dob: string, date: string): number {
  const d1 = new Date(dob);
  const d2 = new Date(date);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

export async function seed(knex: Knex): Promise<void> {
  // Clean tables in reverse FK order
  await knex('refresh_tokens').del();
  await knex('audit_log').del();
  await knex('patient_metrics').del();
  await knex('flags').del();
  await knex('game_results').del();
  await knex('sessions').del();
  await knex('tablets').del();
  await knex('patients').del();
  await knex('users').del();
  await knex('clinics').del();

  // Clinic
  await knex('clinics').insert({
    id: CLINIC_ID,
    name: 'Sunny Pediatrics',
    address: '123 Main St, Springfield, IL 62701',
    subscription_tier: 'growth',
    subscription_status: 'active',
  });

  // Users
  const adminPassHash = await bcrypt.hash('admin123', 12);
  const doctorPassHash = await bcrypt.hash('doctor123', 12);
  const staffPinHash = await bcrypt.hash('1234', 12);

  await knex('users').insert([
    { id: ADMIN_ID, clinic_id: CLINIC_ID, email: 'admin@sunny.dev', password_hash: adminPassHash, role: 'admin', name: 'Admin User', mfa_enabled: false },
    { id: CLINICIAN_ID, clinic_id: CLINIC_ID, email: 'doctor@sunny.dev', password_hash: doctorPassHash, role: 'clinician', name: 'Dr. Smith', mfa_enabled: false },
    { id: STAFF_ID, clinic_id: CLINIC_ID, role: 'staff', name: 'Sarah', pin_hash: staffPinHash, mfa_enabled: false },
  ]);

  // Tablet
  const deviceTokenHash = await bcrypt.hash('dev-token-123', 12);
  await knex('tablets').insert({
    id: TABLET_ID,
    clinic_id: CLINIC_ID,
    device_token_hash: deviceTokenHash,
    device_name: 'Dev iPad',
    model: 'iPad 9th Gen',
    os_version: 'iPadOS 17.2',
    is_active: true,
  });

  // Patients
  for (const p of patients) {
    await knex('patients').insert({
      id: p.id,
      clinic_id: CLINIC_ID,
      mrn: p.mrn,
      first_name_encrypted: encrypt(p.firstName),
      last_name_encrypted: encrypt(p.lastName),
      date_of_birth_encrypted: encrypt(p.dob),
      guardian_name_encrypted: encrypt(p.guardian),
    });
  }

  // Historical sessions
  // Patrick & Anh: 3 sessions, Matheus & My: 5 sessions (for trend data)
  const sessionDates = ['2025-08-15', '2025-10-20', '2025-12-10', '2026-01-15', '2026-02-05'];
  const gameTypes = ['cloud_catch', 'star_sequence', 'sky_balance', 'breeze_spells'] as const;

  for (const patient of patients) {
    const numSessions = patient.firstName === 'Matheus' || patient.firstName === 'My' ? 5 : 3;
    const dates = sessionDates.slice(0, numSessions);

    for (let si = 0; si < dates.length; si++) {
      const sessionDate = dates[si]!;
      const age = ageMonthsAt(patient.dob, sessionDate);
      const sessionId = `bbbb${patient.id!.slice(4, 8)}-${String(si + 1).padStart(4, '0')}-0000-0000-000000000000`;

      await knex('sessions').insert({
        id: sessionId,
        patient_id: patient.id,
        clinic_id: CLINIC_ID,
        tablet_id: TABLET_ID,
        staff_user_id: STAFF_ID,
        consent_given_at: `${sessionDate}T14:00:00Z`,
        started_at: `${sessionDate}T14:01:00Z`,
        completed_at: `${sessionDate}T14:12:00Z`,
        status: 'completed',
        patient_age_months: age,
        games_completed: 4,
        total_duration_ms: 660000,
      });

      // Game results with realistic computed metrics
      for (let gi = 0; gi < gameTypes.length; gi++) {
        const gameType = gameTypes[gi]!;
        const gameId = `cccc${patient.id!.slice(4, 8)}-${String(si + 1).padStart(4, '0')}-${String(gi + 1).padStart(4, '0')}-0000-000000000000`;
        const metrics = generateRealisticMetrics(gameType, age, si, patient.firstName);

        await knex('game_results').insert({
          id: gameId,
          session_id: sessionId,
          game_type: gameType,
          started_at: `${sessionDate}T14:01:00Z`,
          completed_at: `${sessionDate}T14:03:30Z`,
          duration_ms: 150000,
          raw_events: JSON.stringify([]),
          computed_metrics: JSON.stringify(metrics),
        });

        // Store computed metrics
        for (const [metricName, value] of Object.entries(metrics)) {
          if (typeof value !== 'number') continue;
          await knex('patient_metrics').insert({
            patient_id: patient.id,
            session_id: sessionId,
            game_type: gameType,
            metric_name: metricName,
            metric_value: value,
            age_months: age,
            percentile: null,
            recorded_at: `${sessionDate}T14:01:00Z`,
          });
        }
      }
    }
  }

  // Flags for Matheus (attention & memory) and My (motor control)
  await knex('flags').insert([
    // Matheus: Red flag on max_sequence_length (3rd percentile)
    {
      patient_id: PATIENT_IDS[2],
      clinic_id: CLINIC_ID,
      session_id: null,
      flag_type: 'below_threshold',
      severity: 'red',
      metric_name: 'max_sequence_length',
      game_type: 'star_sequence',
      description: 'Maximum sequence length is in the 3rd percentile for age. This is a developmental pattern observation, not a clinical diagnosis.',
      current_value: 2,
      threshold_value: 5,
    },
    // Matheus: Amber on reaction_time_cv (11th percentile)
    {
      patient_id: PATIENT_IDS[2],
      clinic_id: CLINIC_ID,
      session_id: null,
      flag_type: 'below_threshold',
      severity: 'amber',
      metric_name: 'reaction_time_cv',
      game_type: 'cloud_catch',
      description: 'Reaction time variability is in the 11th percentile for age. This may indicate inconsistent attention. This is a developmental pattern observation, not a clinical diagnosis.',
      current_value: 0.42,
      threshold_value: 15,
    },
    // Matheus: Amber declining attention_accuracy trend
    {
      patient_id: PATIENT_IDS[2],
      clinic_id: CLINIC_ID,
      session_id: null,
      flag_type: 'declining_trend',
      severity: 'amber',
      metric_name: 'attention_accuracy',
      game_type: 'cloud_catch',
      description: 'Attention accuracy shows a declining trend across 5 sessions. This is a developmental pattern observation, not a clinical diagnosis.',
      current_value: 0.58,
      threshold_value: null,
    },
    // My: Red flag on balance_stability (4th percentile)
    {
      patient_id: PATIENT_IDS[3],
      clinic_id: CLINIC_ID,
      session_id: null,
      flag_type: 'below_threshold',
      severity: 'red',
      metric_name: 'balance_stability',
      game_type: 'sky_balance',
      description: 'Balance stability is in the 4th percentile for age. This is a developmental pattern observation, not a clinical diagnosis.',
      current_value: 0.45,
      threshold_value: 5,
    },
    // My: Amber on drop_rate (13th percentile)
    {
      patient_id: PATIENT_IDS[3],
      clinic_id: CLINIC_ID,
      session_id: null,
      flag_type: 'below_threshold',
      severity: 'amber',
      metric_name: 'drop_rate',
      game_type: 'sky_balance',
      description: 'Drop rate is in the 13th percentile for age. This is a developmental pattern observation, not a clinical diagnosis.',
      current_value: 22,
      threshold_value: 15,
    },
    // My: Amber on high tilt_variability
    {
      patient_id: PATIENT_IDS[3],
      clinic_id: CLINIC_ID,
      session_id: null,
      flag_type: 'high_variability',
      severity: 'amber',
      metric_name: 'tilt_variability',
      game_type: 'sky_balance',
      description: 'Tilt variability is unusually high for age. This is a developmental pattern observation, not a clinical diagnosis.',
      current_value: 0.35,
      threshold_value: null,
    },
  ]);
}

function generateRealisticMetrics(
  gameType: string,
  ageMonths: number,
  sessionIndex: number,
  patientName: string,
): Record<string, number> {
  const ageFactor = Math.min(1, (ageMonths - 48) / 36);
  const sessionFactor = sessionIndex * 0.02;

  // Patrick & Anh: healthy (40th-75th percentile range)
  // Matheus: poor cloud_catch and star_sequence (~5th-15th percentile)
  // My: poor sky_balance (~5th-15th percentile)
  const isMatheus = patientName === 'Matheus';
  const isMy = patientName === 'My';

  switch (gameType) {
    case 'cloud_catch':
      if (isMatheus) {
        // Matheus: declining attention, high variability
        return {
          attention_accuracy: clamp(0.62 - sessionIndex * 0.01, 0, 1),
          reaction_time_mean: clamp(850 - ageFactor * 100, 300, 1200),
          reaction_time_cv: clamp(0.42 + sessionIndex * 0.01, 0.05, 0.6),
          false_positive_rate: clamp(0.22 - ageFactor * 0.03, 0, 0.5),
          attention_decay: clamp(0.72 + ageFactor * 0.05, 0.5, 1.2),
        };
      }
      return {
        attention_accuracy: clamp(0.75 + ageFactor * 0.15 + sessionFactor, 0, 1),
        reaction_time_mean: clamp(650 - ageFactor * 180 - sessionFactor * 50, 300, 1200),
        reaction_time_cv: clamp(0.22 - ageFactor * 0.06 - sessionFactor * 0.02, 0.05, 0.6),
        false_positive_rate: clamp(0.08 - ageFactor * 0.04 - sessionFactor * 0.01, 0, 0.5),
        attention_decay: clamp(0.92 + ageFactor * 0.06 + sessionFactor, 0.5, 1.2),
      };
    case 'star_sequence':
      if (isMatheus) {
        // Matheus: poor sequence/memory metrics
        return {
          max_sequence_length: Math.round(clamp(2 + sessionIndex * 0.1, 1, 8)),
          memory_accuracy: clamp(0.38 + sessionIndex * 0.01, 0, 1),
          learning_rate: clamp(0.005 + sessionFactor * 0.002, -0.1, 0.2),
        };
      }
      return {
        max_sequence_length: Math.round(clamp(3 + ageFactor * 3 + sessionFactor * 5, 1, 8)),
        memory_accuracy: clamp(0.62 + ageFactor * 0.2 + sessionFactor, 0, 1),
        learning_rate: clamp(0.04 + sessionFactor * 0.01, -0.1, 0.2),
      };
    case 'sky_balance':
      if (isMy) {
        // My: poor balance/motor metrics
        return {
          balance_stability: clamp(0.45 + sessionIndex * 0.005, 0.02, 0.5),
          tilt_variability: clamp(0.35 + sessionIndex * 0.005, 0.02, 0.4),
          correction_smoothness: clamp(0.55 + sessionIndex * 0.005, 0.05, 0.8),
          max_balls_balanced: Math.round(clamp(2 + sessionIndex * 0.2, 1, 12)),
          avg_balls_balanced: clamp(1.0 + sessionIndex * 0.1, 0.5, 8),
          drop_rate: clamp(22 - sessionIndex * 0.5, 1, 30),
          avg_time_on_plank: clamp(4000 + sessionIndex * 200, 2000, 30000),
        };
      }
      return {
        balance_stability: clamp(0.18 - ageFactor * 0.08 - sessionFactor * 0.02, 0.02, 0.5),
        tilt_variability: clamp(0.12 - ageFactor * 0.04 - sessionFactor * 0.01, 0.02, 0.4),
        correction_smoothness: clamp(0.28 - ageFactor * 0.08 - sessionFactor * 0.02, 0.05, 0.8),
        max_balls_balanced: Math.round(clamp(4 + ageFactor * 4 + sessionFactor * 5, 1, 12)),
        avg_balls_balanced: clamp(2.5 + ageFactor * 2.5 + sessionFactor, 0.5, 8),
        drop_rate: clamp(8 - ageFactor * 3 - sessionFactor * 10, 1, 30),
        avg_time_on_plank: clamp(12000 + ageFactor * 6000 + sessionFactor * 2000, 2000, 30000),
      };
    case 'breeze_spells':
      return {
        gesture_accuracy: clamp(0.70 + ageFactor * 0.15 + sessionFactor, 0, 1),
        avg_cast_time: clamp(1800 - ageFactor * 400 - sessionFactor * 100, 500, 3000),
        spells_completed: Math.round(clamp(5 + ageFactor * 5 + sessionFactor * 10, 1, 20)),
      };
    default:
      return {};
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)) * 10000) / 10000;
}
